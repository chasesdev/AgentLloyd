import { AppState, AppStateStatus } from 'react-native';
import { offlineService } from './offlineService';
import { errorHandlerService } from './errorHandlerService';

export interface AppStateConfig {
  enableBackgroundSync: boolean;
  enableAutoSave: boolean;
  autoSaveInterval: number; // in milliseconds
  enableCrashReporting: boolean;
  enableAnalytics: boolean;
}

export interface AppStateInfo {
  currentState: AppStateStatus;
  isBackground: boolean;
  lastActiveTime: Date | null;
  crashCount: number;
  lastCrashTime: Date | null;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  networkStatus: {
    isOnline: boolean;
    lastChecked: Date | null;
    type: string;
  };
}

export class AppStateService {
  private static instance: AppStateService;
  private config: AppStateConfig;
  private listeners: Set<(state: AppStateInfo) => void> = new Set();
  private currentState: AppStateStatus = 'active';
  private isBackground = false;
  private lastActiveTime: Date | null = null;
  private crashCount = 0;
  private lastCrashTime: Date | null = null;
  private memoryCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.config = {
      enableBackgroundSync: true,
      enableAutoSave: true,
      autoSaveInterval: 60000, // 1 minute
      enableCrashReporting: true,
      enableAnalytics: true
    };

    this.setupAppStateHandling();
    this.startMemoryMonitoring();
  }

  static getInstance(): AppStateService {
    if (!AppStateService.instance) {
      AppStateService.instance = new AppStateService();
    }
    return AppStateService.instance;
  }

  /**
   * Setup React Native app state handling
   */
  private setupAppStateHandling(): void {
    // Handle app state changes
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    
    // Handle memory warnings
    AppState.addEventListener('memoryWarning', this.handleMemoryWarning.bind(this));
    
    // Handle app errors
    AppState.addEventListener('error', this.handleError.bind(this));
    
    // Handle app state changes for background/foreground
    AppState.addEventListener('blur', this.handleAppBlur.bind(this));
    AppState.addEventListener('focus', this.handleAppFocus.bind(this));
    
    console.log('App state handling initialized');
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextState: AppStateStatus): void {
    const previousState = this.currentState;
    this.currentState = nextState;
    this.isBackground = nextState === 'background' || nextState === 'inactive';
    
    console.log(`App state changed: ${previousState} -> ${nextState}`);
    
    // Notify listeners
    this.notifyListeners();
    
    // Handle background/foreground transitions
    if (previousState === 'active' && (nextState === 'background' || nextState === 'inactive')) {
      this.handleAppBackground();
    } else if ((previousState === 'background' || previousState === 'inactive') && nextState === 'active') {
      this.handleAppForeground();
    }
  }

  /**
   * Handle app going to background
   */
  private handleAppBackground(): void {
    this.lastActiveTime = new Date();
    console.log('App went to background');
    
    // Trigger background sync if enabled
    if (this.config.enableBackgroundSync) {
      this.performBackgroundSync();
    }
    
    // Notify offline service about background state
    offlineService.configure({
      enableOfflineMode: true,
      syncInterval: this.config.autoSaveInterval * 2 // Longer intervals when background
    });
  }

  /**
   * Handle app coming to foreground
   */
  private handleAppForeground(): void {
    const now = new Date();
    const timeInBackground = this.lastActiveTime ? now.getTime() - this.lastActiveTime.getTime() : 0;
    
    console.log(`App came to foreground (was in background for ${timeInBackground}ms)`);
    
    // Reset last active time
    this.lastActiveTime = now;
    
    // Restore normal sync interval
    if (this.config.enableBackgroundSync) {
      offlineService.configure({
        enableOfflineMode: true,
        syncInterval: this.config.autoSaveInterval
      });
    }
    
    // Process any queued operations
    if (this.isOnline) {
      offlineService.forceSync();
    }
  }

  /**
   * Handle app blur (losing focus)
   */
  private handleAppBlur(): void {
    this.isBackground = true;
    this.lastActiveTime = new Date();
  }

  /**
   * Handle app focus (gaining focus)
   */
  private handleAppFocus(): void {
    this.isBackground = false;
    this.lastActiveTime = new Date();
  }

  /**
   * Handle memory warnings
   */
  private handleMemoryWarning(warning: any): {
    console.warn('Memory warning:', warning);
    
    const memoryUsage = this.getMemoryUsage();
    
    // Log memory usage for analytics
    if (this.config.enableAnalytics) {
      console.log('Memory usage:', memoryUsage);
    }
    
    // Trigger cleanup if needed
    if (memoryUsage.percentage > 80) {
      this.performMemoryCleanup();
    }
  }

  /**
   * Handle app errors
   */
  private handleError(error: any): void {
    console.error('App error:', error);
    
    this.crashCount++;
    this.lastCrashTime = new Date();
    
    // Report crash if enabled
    if (this.config.enableCrashReporting) {
      this.reportCrash(error);
    }
    
    // Notify error handler service
    errorHandlerService.handleError(error as Error, {
      screen: 'App',
      action: 'app_error',
      data: {
        crashCount: this.crashCount,
        memoryUsage: this.getMemoryUsage(),
        appState: this.currentState
      }
    });
  }

  /**
   * Perform background sync
   */
  private async performBackgroundSync(): Promise<void> {
    try {
      console.log('Performing background sync...');
      
      // This would trigger the offline service to process queue
      await offlineService.forceSync();
      
      console.log('Background sync completed');
    } catch (error) {
      console.error('Background sync failed:', error);
    }
  }

  /**
   * Perform memory cleanup
   */
  private performMemoryCleanup(): void {
    try {
      // Clear cache if memory usage is high
      const cacheStats = cacheService.getStats();
      
      if (cacheStats.totalSize > 30 * 1024 * 1024) { // 30MB
        console.log('Clearing cache due to memory pressure');
        cacheService.clear();
      }
      
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      console.log('Memory cleanup completed');
    } catch (error) {
      console.error('Memory cleanup failed:', error);
    }
  }

  /**
   * Get current app state info
   */
  getStateInfo(): AppStateInfo {
    return {
      currentState: this.currentState,
      isBackground: this.isBackground,
      lastActiveTime: this.lastActiveTime,
      crashCount: this.crashCount,
      lastCrashTime: this.lastCrashTime,
      memoryUsage: this.getMemoryUsage(),
      networkStatus: {
        isOnline: offlineService.getStatus().isOnline,
        lastChecked: new Date(),
        type: 'unknown'
      }
    };
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): { used: number; total: number; percentage: number } {
    // In React Native, we can get basic memory info
    // This is a simplified implementation
    const used = 0; // Would use native modules in production
    const total = 100 * 1024 * 1024; // 100MB estimated
    const percentage = (used / total) * 100;
    
    return { used, total, percentage };
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    this.memoryCheckInterval = setInterval(() => {
      const memoryUsage = this.getMemoryUsage();
      
      if (memoryUsage.percentage > 70) {
        console.warn('High memory usage detected:', memoryUsage);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Add app state listener
   */
  addListener(listener: (state: AppStateInfo) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove app state listener
   */
  removeListener(listener: (state: AppStateInfo) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const stateInfo = this.getStateInfo();
    this.listeners.forEach(listener => listener(stateInfo));
  }

  /**
   * Configure app state settings
   */
  configure(config: Partial<AppStateConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart timers with new intervals
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.startMemoryMonitoring();
    }
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.startSyncTimer();
    }
  }

  /**
   * Start sync timer for background operations
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.syncTimer = setInterval(() => {
      if (this.isBackground && this.config.enableBackgroundSync) {
        this.performBackgroundSync();
      }
    }, this.config.autoSaveInterval);
  }

  /**
   * Check if app is in background
   */
  isInBackground(): boolean {
    return this.isBackground;
  }

  /**
   * Check if app is active
   */
  isActive(): boolean {
    return this.currentState === 'active';
  }

  /**
   * Get crash statistics
   */
  getCrashStats(): {
    return {
      totalCrashes: this.crashCount,
      lastCrashTime: this.lastCrashTime,
      crashRate: this.crashCount > 0 ? (this.crashCount / 100) * 100 : 0
    };
  }

  /**
   * Report crash to analytics
   */
  private reportCrash(error: any): void {
    try {
      const crashData = {
        message: error.message || 'Unknown error',
        stack: error.stack,
        timestamp: new Date().toISOString(),
        appState: this.currentState,
        memoryUsage: this.getMemoryUsage(),
        platform: 'react-native',
        version: '1.0.0'
      };

      // In production, you would send this to your analytics service
      console.log('Crash report:', crashData);
      
    } catch (error) {
      console.error('Failed to report crash:', error);
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    return {
      memoryUsage: this.getMemoryUsage(),
      appState: this.getStateInfo(),
      crashStats: this.getCrashStats(),
      uptime: this.lastActiveTime ? Date.now() - (this.lastActiveTime?.getTime() || 0) : 0
    };
  }

  /**
   * Destroy app state service
   */
  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    
    this.listeners.clear();
    
    // Remove app state listeners
    AppState.removeEventListener('change', this.handleAppStateChange);
    AppState.removeEventListener('memoryWarning', this.handleMemoryWarning);
    AppState.removeEventListener('error', this.handleError);
    AppState.removeEventListener('blur', this.handleAppBlur);
    AppState.removeEventListener('focus', this.handleAppFocus);
    
    console.log('App state service destroyed');
  }
}

export const appStateService = AppStateService.getInstance();