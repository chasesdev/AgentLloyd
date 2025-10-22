import { ENVIRONMENT, debugLog, errorLog, warnLog } from '@/config/environment';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Updates from 'expo-updates';

// Types for update information
export interface UpdateInfo {
  version: string;
  buildNumber: string;
  releaseNotes?: string;
  downloadUrl?: string;
  isMandatory: boolean;
  publishedAt: string;
  size?: number;
  checksum?: string;
  isOTA?: boolean;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  updateInfo?: UpdateInfo;
  isOTA: boolean;
  currentVersion: string;
  currentBuildNumber: string;
}

export interface UpdateProgress {
  bytesWritten: number;
  totalBytes: number;
  progress: number; // 0-100
}

export type UpdateListener = (result: UpdateCheckResult) => void;
export type ProgressListener = (progress: UpdateProgress) => void;
export type ErrorListener = (error: Error) => void;

class AutoUpdaterService {
  private static instance: AutoUpdaterService;
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;
  private isDownloading = false;
  
  // Listeners
  private updateListeners: UpdateListener[] = [];
  private progressListeners: ProgressListener[] = [];
  private errorListeners: ErrorListener[] = [];

  private constructor() {
    this.initialize();
  }

  static getInstance(): AutoUpdaterService {
    if (!AutoUpdaterService.instance) {
      AutoUpdaterService.instance = new AutoUpdaterService();
    }
    return AutoUpdaterService.instance;
  }

  private async initialize(): Promise<void> {
    if (!ENVIRONMENT.AUTO_UPDATE_ENABLED) {
      debugLog('Auto updater is disabled');
      return;
    }

    // Start periodic checks
    this.startPeriodicChecks();
    
    // Check for updates on app start
    setTimeout(() => {
      this.checkForUpdates();
    }, 5000); // Wait 5 seconds after app start
  }

  // Public methods
  async checkForUpdates(): Promise<UpdateCheckResult> {
    if (this.isChecking) {
      throw new Error('Update check already in progress');
    }

    this.isChecking = true;
    debugLog('Checking for updates...');

    try {
      const currentVersion = ENVIRONMENT.APP_VERSION;
      const currentBuildNumber = ENVIRONMENT.BUILD_NUMBER;

      // For Expo apps, use expo-updates for OTA updates
      if (Updates.isEnabled) {
        const expoResult = await this.checkExpoUpdates(currentVersion, currentBuildNumber);
        if (expoResult.hasUpdate) {
          this.notifyUpdateListeners(expoResult);
          return expoResult;
        }
      }

      // Check for store updates as fallback
      const storeResult = await this.checkStoreUpdates(currentVersion, currentBuildNumber);
      this.notifyUpdateListeners(storeResult);
      
      return storeResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error during update check');
      errorLog('Update check failed:', err);
      this.notifyErrorListeners(err);
      throw err;
    } finally {
      this.isChecking = false;
    }
  }

  async downloadUpdate(updateInfo: UpdateInfo): Promise<void> {
    if (this.isDownloading) {
      throw new Error('Update download already in progress');
    }

    this.isDownloading = true;
    debugLog('Starting update download...');

    try {
      if (Updates.isEnabled && updateInfo.isOTA) {
        // Use expo-updates for OTA updates
        await this.downloadExpoUpdate(updateInfo);
      } else {
        // For store updates, redirect to app store
        await this.redirectToStore(updateInfo);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error during download');
      errorLog('Update download failed:', err);
      this.notifyErrorListeners(err);
      throw err;
    } finally {
      this.isDownloading = false;
    }
  }

  async installUpdate(): Promise<void> {
    debugLog('Installing update...');
    
    try {
      if (Updates.isEnabled) {
        // Use expo-updates to reload the app with new update
        await Updates.reloadAsync();
      } else {
        warnLog('Updates not enabled, cannot install OTA update');
        throw new Error('Updates not enabled');
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error during installation');
      errorLog('Update installation failed:', err);
      this.notifyErrorListeners(err);
      throw err;
    }
  }

  async skipUpdate(updateInfo: UpdateInfo): Promise<void> {
    try {
      const skippedUpdates = await this.getSkippedUpdates();
      skippedUpdates.add(`${updateInfo.version}-${updateInfo.buildNumber}`);
      await AsyncStorage.setItem('skipped_updates', JSON.stringify([...skippedUpdates]));
      debugLog(`Skipped update ${updateInfo.version}-${updateInfo.buildNumber}`);
    } catch (error) {
      errorLog('Failed to skip update:', error);
    }
  }

  // Event listeners
  onUpdateAvailable(listener: UpdateListener): void {
    this.updateListeners.push(listener);
  }

  onDownloadProgress(listener: ProgressListener): void {
    this.progressListeners.push(listener);
  }

  onError(listener: ErrorListener): void {
    this.errorListeners.push(listener);
  }

  removeUpdateListener(listener: UpdateListener): void {
    this.updateListeners = this.updateListeners.filter(l => l !== listener);
  }

  removeProgressListener(listener: ProgressListener): void {
    this.progressListeners = this.progressListeners.filter(l => l !== listener);
  }

  removeErrorListener(listener: ErrorListener): void {
    this.errorListeners = this.errorListeners.filter(l => l !== listener);
  }

  // Private methods
  private startPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      if (!this.isChecking) {
        this.checkForUpdates().catch(error => {
          errorLog('Periodic update check failed:', error);
        });
      }
    }, ENVIRONMENT.AUTO_UPDATE_CHECK_INTERVAL);

    debugLog(`Started periodic update checks (interval: ${ENVIRONMENT.AUTO_UPDATE_CHECK_INTERVAL}ms)`);
  }

  private async checkExpoUpdates(currentVersion: string, currentBuildNumber: string): Promise<UpdateCheckResult> {
    try {
      debugLog('Checking for Expo OTA updates...');
      
      // Use expo-updates to check for updates
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        debugLog('Expo OTA update available');
        
        return {
          hasUpdate: true,
          updateInfo: {
            version: update.manifest?.version || 'unknown',
            buildNumber: update.manifest?.extra?.expoClient?.extra?.eas?.buildNumber || 'unknown',
            releaseNotes: update.manifest?.extra?.releaseNotes || 'New update available',
            isMandatory: update.manifest?.extra?.isMandatory || false,
            publishedAt: update.manifest?.createdAt || new Date().toISOString(),
            isOTA: true,
          },
          isOTA: true,
          currentVersion,
          currentBuildNumber,
        };
      }
      
      return {
        hasUpdate: false,
        isOTA: true,
        currentVersion,
        currentBuildNumber,
      };
    } catch (error) {
      errorLog('Expo update check failed:', error);
      return {
        hasUpdate: false,
        isOTA: true,
        currentVersion,
        currentBuildNumber,
      };
    }
  }

  private async checkStoreUpdates(currentVersion: string, currentBuildNumber: string): Promise<UpdateCheckResult> {
    try {
      debugLog('Checking for App Store updates...');
      
      let storeUrl: string | undefined;
      if (Platform.OS === 'ios' && ENVIRONMENT.APP_STORE_URL) {
        storeUrl = ENVIRONMENT.APP_STORE_URL;
      } else if (Platform.OS === 'android' && ENVIRONMENT.PLAY_STORE_URL) {
        storeUrl = ENVIRONMENT.PLAY_STORE_URL;
      }

      if (!storeUrl) {
        debugLog('No store URL configured for current platform');
        return {
          hasUpdate: false,
          isOTA: false,
          currentVersion,
          currentBuildNumber,
        };
      }

      // In a real implementation, this would check the App Store/Play Store API
      // For demo purposes, we'll simulate this check
      const response = await this.mockStoreUpdateCheck(currentVersion, currentBuildNumber);
      
      return {
        hasUpdate: response.hasUpdate,
        updateInfo: response.updateInfo,
        isOTA: false,
        currentVersion,
        currentBuildNumber,
      };
    } catch (error) {
      errorLog('Store update check failed:', error);
      return {
        hasUpdate: false,
        isOTA: false,
        currentVersion,
        currentBuildNumber,
      };
    }
  }

  private async downloadExpoUpdate(updateInfo: UpdateInfo): Promise<void> {
    try {
      debugLog('Downloading Expo OTA update...');
      
      // expo-updates handles downloading automatically when we fetch the update
      // The actual download happens during checkForUpdateAsync
      debugLog('Expo OTA update ready for installation');
      
      // Save update info for installation
      await this.saveUpdateState(updateInfo);
    } catch (error) {
      errorLog('Expo update download failed:', error);
      throw error;
    }
  }

  private async redirectToStore(updateInfo: UpdateInfo): Promise<void> {
    try {
      let storeUrl: string | undefined;
      
      if (Platform.OS === 'ios' && ENVIRONMENT.APP_STORE_URL) {
        storeUrl = ENVIRONMENT.APP_STORE_URL;
      } else if (Platform.OS === 'android' && ENVIRONMENT.PLAY_STORE_URL) {
        storeUrl = ENVIRONMENT.PLAY_STORE_URL;
      }

      if (storeUrl) {
        debugLog('Redirecting to app store...');
        // In a real implementation, you would use Linking.openURL(storeUrl)
        warnLog(`Would open store URL: ${storeUrl}`);
      } else {
        throw new Error('No store URL available for current platform');
      }
    } catch (error) {
      errorLog('Failed to redirect to store:', error);
      throw error;
    }
  }

  private async mockStoreUpdateCheck(currentVersion: string, currentBuildNumber: string): Promise<{ hasUpdate: boolean; updateInfo?: UpdateInfo }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Mock update check logic
    const mockNewVersion = '1.1.0';
    const mockNewBuildNumber = '10';

    // Simulate finding a store update
    if (this.compareVersions(currentVersion, mockNewVersion) < 0) {
      return {
        hasUpdate: true,
        updateInfo: {
          version: mockNewVersion,
          buildNumber: mockNewBuildNumber,
          releaseNotes: 'Major new features and improvements!',
          isMandatory: false,
          publishedAt: new Date().toISOString(),
          isOTA: false,
        },
      };
    }

    return { hasUpdate: false };
  }

  private async saveUpdateState(updateInfo?: UpdateInfo): Promise<void> {
    const state = {
      pendingUpdate: updateInfo || null,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem('update_state', JSON.stringify(state));
  }

  private async getSkippedUpdates(): Promise<Set<string>> {
    try {
      const skipped = await AsyncStorage.getItem('skipped_updates');
      return new Set(JSON.parse(skipped || '[]'));
    } catch {
      return new Set();
    }
  }

  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  private notifyUpdateListeners(result: UpdateCheckResult): void {
    this.updateListeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        errorLog('Error in update listener:', error);
      }
    });
  }

  private notifyProgressListeners(progress: UpdateProgress): void {
    this.progressListeners.forEach(listener => {
      try {
        listener(progress);
      } catch (error) {
        errorLog('Error in progress listener:', error);
      }
    });
  }

  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (error) {
        errorLog('Error in error listener:', error);
      }
    });
  }

  // Cleanup
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.updateListeners = [];
    this.progressListeners = [];
    this.errorListeners = [];
    
    debugLog('Auto updater service destroyed');
  }
}

// Export singleton instance
export const autoUpdaterService = AutoUpdaterService.getInstance();

// Export types and service class
export { AutoUpdaterService };
export default autoUpdaterService;