import { SecureStorage } from '../utils/secureStorage';
import { chatDatabase } from './chatDatabase';

export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: Date;
  userAgent?: string;
  userId?: string;
  appVersion?: string;
  context?: Record<string, any>;
  resolved: boolean;
}

export interface ErrorContext {
  screen?: string;
  action?: string;
  data?: Record<string, any>;
}

export class ErrorHandlerService {
  private static instance: ErrorHandlerService;
  private errorQueue: ErrorReport[] = [];
  private isOnline: boolean = true;
  private maxQueueSize: number = 50;
  private retryAttempts: number = 3;
  private retryDelay: number = 5000; // 5 seconds

  private constructor() {
    this.setupGlobalHandlers();
    this.checkConnectivity();
  }

  static getInstance(): ErrorHandlerService {
    if (!ErrorHandlerService.instance) {
      ErrorHandlerService.instance = new ErrorHandlerService();
    }
    return ErrorHandlerService.instance;
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.handleError(new Error(event.reason), {
          context: { type: 'unhandled_promise_rejection' }
        });
      });

      // Handle global errors
      window.onerror = (message, source, lineno, colno, error) => {
        this.handleError(error || new Error(String(message)), {
          context: { source, lineno, colno }
        });
      };
    }

    // React Native error handling would be setup differently
    // This is a basic setup for web environment
  }

  /**
   * Check network connectivity
   */
  private async checkConnectivity(): Promise<void> {
    try {
      // Basic connectivity check
      const response = await fetch('https://api.github.com/rate_limit', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      this.isOnline = response.ok;
    } catch (error) {
      this.isOnline = false;
    }

    // Process queued errors when coming back online
    if (this.isOnline && this.errorQueue.length > 0) {
      this.processErrorQueue();
    }
  }

  /**
   * Handle and log errors
   */
  async handleError(
    error: Error | string,
    context?: ErrorContext,
    shouldReport: boolean = true
  ): Promise<void> {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      message: errorObj.message,
      stack: errorObj.stack,
      componentStack: context?.data?.componentStack,
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'React Native',
      context: {
        screen: context?.screen,
        action: context?.action,
        ...context?.data
      },
      resolved: false
    };

    // Log to console
    console.error('ErrorHandlerService:', errorReport);

    // Store locally
    await this.storeErrorLocally(errorReport);

    // Report to external service if online
    if (shouldReport && this.isOnline) {
      await this.reportError(errorReport);
    } else if (shouldReport) {
      // Queue for later reporting
      this.queueError(errorReport);
    }

    // Check for critical errors that require immediate action
    await this.handleCriticalErrors(errorReport);
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store error locally in database
   */
  private async storeErrorLocally(errorReport: ErrorReport): Promise<void> {
    try {
      await chatDatabase.saveSetting(
        `error_${errorReport.id}`,
        JSON.stringify(errorReport),
        'error'
      );
    } catch (error) {
      console.error('Failed to store error locally:', error);
    }
  }

  /**
   * Queue error for later reporting
   */
  private queueError(errorReport: ErrorReport): void {
    this.errorQueue.push(errorReport);
    
    // Limit queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift(); // Remove oldest error
    }
  }

  /**
   * Process queued errors
   */
  private async processErrorQueue(): Promise<void> {
    const errorsToProcess = [...this.errorQueue];
    this.errorQueue = [];

    for (const error of errorsToProcess) {
      try {
        await this.reportError(error);
      } catch (reportError) {
        console.error('Failed to report queued error:', reportError);
        // Re-queue if reporting fails
        if (this.retryAttempts > 0) {
          this.queueError(error);
          this.retryAttempts--;
          await this.delay(this.retryDelay);
        }
      }
    }
  }

  /**
   * Report error to external service
   */
  private async reportError(errorReport: ErrorReport): Promise<void> {
    try {
      // In a production app, you would send this to an error reporting service
      // like Sentry, Bugsnag, or your own backend
      
      const payload = {
        ...errorReport,
        timestamp: errorReport.timestamp.toISOString(),
        appVersion: '1.0.0', // Get from app config
        platform: typeof navigator !== 'undefined' ? 'web' : 'react-native'
      };

      // Example: Send to your backend
      const response = await fetch('https://your-error-reporting-service.com/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Error reporting failed: ${response.statusText}`);
      }

      // Mark as resolved if successfully reported
      errorReport.resolved = true;
      await this.storeErrorLocally(errorReport);

    } catch (error) {
      console.error('Failed to report error:', error);
      throw error;
    }
  }

  /**
   * Handle critical errors that require immediate action
   */
  private async handleCriticalErrors(errorReport: ErrorReport): Promise<void> {
    const criticalErrors = [
      'Network request failed',
      'Authentication failed',
      'Database connection failed',
      'Storage quota exceeded'
    ];

    const isCritical = criticalErrors.some(criticalError =>
      errorReport.message.toLowerCase().includes(criticalError.toLowerCase())
    );

    if (isCritical) {
      console.warn('Critical error detected:', errorReport.message);
      
      // Take appropriate action based on error type
      if (errorReport.message.includes('Authentication')) {
        // Clear stored tokens and force re-authentication
        await SecureStorage.removeItem('zai_api_key');
        await SecureStorage.removeItem('github_token');
      }

      if (errorReport.message.includes('Storage')) {
        // Clear old data to free up space
        await this.cleanupOldErrors();
      }
    }
  }

  /**
   * Clean up old error reports
   */
  private async cleanupOldErrors(): Promise<void> {
    try {
      const allSettings = await chatDatabase.getAllSettings();
      const errorKeys = Object.keys(allSettings).filter(key => key.startsWith('error_'));
      
      // Keep only the most recent 100 errors
      const sortedErrors = errorKeys
        .map(key => ({
          key,
          error: JSON.parse(allSettings[key].value) as ErrorReport
        }))
        .sort((a, b) => new Date(b.error.timestamp).getTime() - new Date(a.error.timestamp).getTime());

      const errorsToDelete = sortedErrors.slice(100);
      
      for (const { key } of errorsToDelete) {
        await chatDatabase.saveSetting(key, '', 'error'); // Clear the error
      }

      console.log(`Cleaned up ${errorsToDelete.length} old error reports`);
    } catch (error) {
      console.error('Failed to cleanup old errors:', error);
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(): Promise<{
    total: number;
    recent: number;
    critical: number;
    byType: Record<string, number>;
  }> {
    try {
      const allSettings = await chatDatabase.getAllSettings();
      const errorKeys = Object.keys(allSettings).filter(key => key.startsWith('error_'));
      
      const errors = errorKeys.map(key => 
        JSON.parse(allSettings[key].value) as ErrorReport
      );

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recent = errors.filter(error => 
        new Date(error.timestamp) > oneDayAgo
      ).length;

      const criticalErrors = [
        'Network request failed',
        'Authentication failed',
        'Database connection failed'
      ];

      const critical = errors.filter(error =>
        criticalErrors.some(criticalError =>
          error.message.toLowerCase().includes(criticalError.toLowerCase())
        )
      ).length;

      const byType: Record<string, number> = {};
      errors.forEach(error => {
        const errorType = this.getErrorType(error.message);
        byType[errorType] = (byType[errorType] || 0) + 1;
      });

      return {
        total: errors.length,
        recent,
        critical,
        byType
      };
    } catch (error) {
      console.error('Failed to get error stats:', error);
      return {
        total: 0,
        recent: 0,
        critical: 0,
        byType: {}
      };
    }
  }

  /**
   * Categorize error by type
   */
  private getErrorType(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
      return 'Network';
    }
    if (lowerMessage.includes('auth') || lowerMessage.includes('token')) {
      return 'Authentication';
    }
    if (lowerMessage.includes('database') || lowerMessage.includes('storage')) {
      return 'Database';
    }
    if (lowerMessage.includes('parse') || lowerMessage.includes('json')) {
      return 'Parsing';
    }
    if (lowerMessage.includes('permission') || lowerMessage.includes('access')) {
      return 'Permission';
    }
    
    return 'General';
  }

  /**
   * Clear all error reports
   */
  async clearAllErrors(): Promise<void> {
    try {
      const allSettings = await chatDatabase.getAllSettings();
      const errorKeys = Object.keys(allSettings).filter(key => key.startsWith('error_'));
      
      for (const key of errorKeys) {
        await chatDatabase.saveSetting(key, '', 'error');
      }
      
      this.errorQueue = [];
      console.log('All error reports cleared');
    } catch (error) {
      console.error('Failed to clear errors:', error);
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test error reporting (for development)
   */
  async testErrorReporting(): Promise<void> {
    if (__DEV__) {
      await this.handleError(
        new Error('Test error for debugging'),
        { screen: 'Test', action: 'test_error' }
      );
    }
  }
}

export const errorHandlerService = ErrorHandlerService.getInstance();