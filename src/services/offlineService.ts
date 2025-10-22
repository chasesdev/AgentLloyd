import { cacheService } from './cacheService';
import { errorHandlerService } from './errorHandlerService';
import { zaiService } from './zaiService';
import { chatMemoryService } from './chatMemoryService';
import NetInfo from '@react-native-community/netinfo';

export interface OfflineQueueItem {
  id: string;
  type: 'message' | 'file_analysis' | 'code_execution' | 'github_operation';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface OfflineConfig {
  enableOfflineMode: boolean;
  maxQueueSize: number;
  syncInterval: number; // in milliseconds
  retryDelay: number; // in milliseconds
}

export interface SyncStatus {
  isOnline: boolean;
  queueSize: number;
  lastSync: Date | null;
  pendingOperations: string[];
}

export class OfflineService {
  private static instance: OfflineService;
  private config: OfflineConfig;
  private queue: OfflineQueueItem[] = [];
  private isOnline: boolean = true;
  private syncTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(status: SyncStatus) => void> = new Set();

  private constructor() {
    this.config = {
      enableOfflineMode: true,
      maxQueueSize: 100,
      syncInterval: 30000, // 30 seconds
      retryDelay: 5000 // 5 seconds
    };

    this.setupConnectivityMonitoring();
    this.startSyncTimer();
  }

  static getInstance(): OfflineService {
    if (!OfflineService.instance) {
      OfflineService.instance = new OfflineService();
    }
    return OfflineService.instance;
  }

  /**
   * Setup connectivity monitoring
   */
  private setupConnectivityMonitoring(): void {
    // Use React Native NetInfo for real connectivity monitoring
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      if (!wasOnline && this.isOnline) {
        // Came back online
        console.log('Back online, starting sync...');
        this.processQueue();
      } else if (wasOnline && !this.isOnline) {
        // Went offline
        console.log('Went offline, enabling offline mode');
      }
      
      this.notifyListeners();
    });

    // Additional connectivity validation with periodic checks
    const validateConnectivity = async () => {
      if (this.isOnline) {
        try {
          // Validate actual internet connectivity
          const response = await fetch('https://api.github.com/rate_limit', {
            method: 'HEAD',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000)
          });
          
          if (!response.ok) {
            // Network is connected but no internet access
            const wasOnline = this.isOnline;
            this.isOnline = false;
            
            if (wasOnline) {
              console.log('Network connected but no internet access');
              this.notifyListeners();
            }
          }
        } catch (error) {
          // Network connectivity issue
          const wasOnline = this.isOnline;
          this.isOnline = false;
          
          if (wasOnline) {
            console.log('Network connectivity issue detected');
            this.notifyListeners();
          }
        }
      }
    };

    // Validate connectivity every 60 seconds
    setInterval(validateConnectivity, 60000);
    
    // Initial validation
    setTimeout(validateConnectivity, 5000);
  }

  /**
   * Start sync timer
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.isOnline && this.queue.length > 0) {
        this.processQueue();
      }
    }, this.config.syncInterval);
  }

  /**
   * Add item to offline queue
   */
  async addToQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    if (!this.config.enableOfflineMode) {
      return;
    }

    if (this.queue.length >= this.config.maxQueueSize) {
      // Remove oldest item
      const removed = this.queue.shift();
      console.warn('Queue full, removed oldest item:', removed.id);
    }

    const queueItem: OfflineQueueItem = {
      ...item,
      id: this.generateId(),
      timestamp: Date.now(),
      retryCount: 0
    };

    this.queue.push(queueItem);
    console.log('Added to offline queue:', queueItem.type, queueItem.id);
    
    // Try to process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }

    this.notifyListeners();
  }

  /**
   * Process offline queue
   */
  private async processQueue(): Promise<void> {
    if (!this.isOnline || this.queue.length === 0) {
      return;
    }

    console.log(`Processing offline queue (${this.queue.length} items)`);
    
    const itemsToProcess = [...this.queue];
    const failedItems: OfflineQueueItem[] = [];

    for (const item of itemsToProcess) {
      try {
        await this.processQueueItem(item);
        
        // Remove from queue on success
        const index = this.queue.findIndex(i => i.id === item.id);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        
        console.log('Successfully processed queue item:', item.id);
        
      } catch (error) {
        console.error('Failed to process queue item:', item.id, error);
        
        item.retryCount++;
        
        if (item.retryCount < item.maxRetries) {
          failedItems.push(item);
        } else {
          console.error('Max retries exceeded for queue item:', item.id);
        }
      }
    }

    // Re-add failed items
    this.queue.push(...failedItems);
    this.notifyListeners();
  }

  /**
   * Process individual queue item
   */
  private async processQueueItem(item: OfflineQueueItem): Promise<void> {
    switch (item.type) {
      case 'message':
        await this.processMessage(item);
        break;
      case 'file_analysis':
        await this.processFileAnalysis(item);
        break;
      case 'code_execution':
        await this.processCodeExecution(item);
        break;
      case 'github_operation':
        await this.processGitHubOperation(item);
        break;
      default:
        throw new Error(`Unknown queue item type: ${item.type}`);
    }
  }

  /**
   * Process queued message
   */
  private async processMessage(item: OfflineQueueItem): Promise<void> {
    const { messages, model, thinkingEnabled } = item.data;
    
    const response = await zaiService.sendMessage(
      messages,
      model,
      thinkingEnabled
    );

    // Cache the response
    await cacheService.set(
      `message_response_${item.id}`,
      response,
      60 * 60 * 1000, // 1 hour
      ['message', 'response']
    );

    // Save to chat memory if needed
    if (item.data.saveToMemory && item.data.chatId) {
      await chatMemoryService.saveMessage(response);
    }
  }

  /**
   * Process queued file analysis
   */
  private async processFileAnalysis(item: OfflineQueueItem): Promise<void> {
    const { fileUri, fileName, analysisType } = item.data;
    
    // This would use the file analyzer service
    // For now, we'll simulate it
    const result = {
      success: true,
      fileName,
      fileType: analysisType,
      size: 1024,
      analysis: {
        summary: 'File analyzed successfully',
        contentType: analysisType,
        keyPoints: ['Analysis completed'],
        entities: []
      }
    };

    // Cache the result
    await cacheService.set(
      `file_analysis_${item.id}`,
      result,
      60 * 60 * 1000, // 1 hour
      ['file', 'analysis']
    );
  }

  /**
   * Process queued code execution
   */
  private async processCodeExecution(item: OfflineQueueItem): Promise<void> {
    const { code, language } = item.data;
    
    // This would use the code interpreter service
    // For now, we'll simulate it
    const result = {
      success: true,
      output: 'Code executed successfully',
      executionTime: 100
    };

    // Cache the result
    await cacheService.set(
      `code_execution_${item.id}`,
      result,
      30 * 60 * 1000, // 30 minutes
      ['code', 'execution']
    );
  }

  /**
   * Process queued GitHub operation
   */
  private async processGitHubOperation(item: OfflineQueueItem): Promise<void> {
    const { operation, data } = item.data;
    
    // This would use the GitHub service
    // For now, we'll simulate it
    const result = {
      success: true,
      operation,
      data: 'GitHub operation completed'
    };

    // Cache the result
    await cacheService.set(
      `github_operation_${item.id}`,
      result,
      60 * 60 * 1000, // 1 hour
      ['github', 'operation']
    );
  }

  /**
   * Get cached response for message
   */
  async getCachedResponse(messageId: string): Promise<any | null> {
    return await cacheService.get(`message_response_${messageId}`);
  }

  /**
   * Get cached file analysis
   */
  async getCachedFileAnalysis(fileId: string): Promise<any | null> {
    return await cacheService.get(`file_analysis_${fileId}`);
  }

  /**
   * Get cached code execution result
   */
  async getCachedCodeExecution(executionId: string): Promise<any | null> {
    return await cacheService.get(`code_execution_${executionId}`);
  }

  /**
   * Get cached GitHub operation result
   */
  async getCachedGitHubOperation(operationId: string): Promise<any | null> {
    return await cacheService.get(`github_operation_${operationId}`);
  }

  /**
   * Add status change listener
   */
  addListener(listener: (status: SyncStatus) => void): void {
    this.listeners.add(listener);
  }

  /**
   * Remove status change listener
   */
  removeListener(listener: (status: SyncStatus) => void): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      queueSize: this.queue.length,
      lastSync: this.queue.length > 0 ? new Date(Math.max(...this.queue.map(item => item.timestamp))) : null,
      pendingOperations: this.queue.map(item => item.type)
    };
  }

  /**
   * Force sync now
   */
  async forceSync(): Promise<void> {
    if (this.isOnline) {
      await this.processQueue();
    } else {
      console.log('Cannot sync while offline');
    }
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue = [];
    this.notifyListeners();
    console.log('Offline queue cleared');
  }

  /**
   * Configure offline settings
   */
  configure(config: Partial<OfflineConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart sync timer with new interval
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.startSyncTimer();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): OfflineConfig {
    return { ...this.config };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Destroy offline service
   */
  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.queue = [];
    this.listeners.clear();
  }
}

export const offlineService = OfflineService.getInstance();