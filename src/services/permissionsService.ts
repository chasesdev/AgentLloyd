import { Platform, PermissionsAndroid, PermissionsIOS } from 'react-native';
import { Alert, Linking } from 'react-native';
import { errorHandlerService } from './errorHandlerService';

export type PermissionType = 
  | 'camera'
  | 'photos' 
  | 'microphone'
  | 'storage'
  | 'notifications'
  | 'location'
  | 'contacts'
  | 'calendar'
  | 'camera_roll'
  | 'record_audio'
  'read_storage'
  'write_storage';

export interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: 'granted' | 'denied' | 'blocked' | 'unavailable';
  platform: string;
}

export interface PermissionRequest {
  type: PermissionType;
  title: string;
  message: string;
  rationale?: string;
  options?: any;
}

export interface PermissionConfig {
  [key: PermissionType]: {
    title: string;
    message: string;
    rationale?: string;
    options?: any;
  };
}

export class PermissionsService {
  private static instance: PermissionsService;
  private config: PermissionConfig;
  private permissionCache: Map<PermissionType, PermissionStatus> = new Map();

  private constructor() {
    this.config = {
      camera: {
        title: 'Camera Access',
        message: 'This app needs access to your camera to take photos and videos.',
        rationale: 'Camera access is required for image analysis features.'
      },
      photos: {
        title: 'Photo Library Access',
        message: 'This app needs access to your photo library to select images for analysis.',
        rationale: 'Photo library access is required for image selection.'
      },
      storage: {
        title: 'Storage Access',
        message: 'This app needs storage access to save data and cache.',
        rationale: 'Storage access is required for saving chat history and preferences.'
      },
      notifications: {
        title: 'Notifications',
        message: 'This app needs notification permissions.',
        rationale: 'Notifications are used for important updates and alerts.'
      },
      location: {
        title: 'Location Access',
        message: 'This app needs location access for location-based features.',
        rationale: 'Location access is used for location-aware features.'
      },
      microphone: {
        title: 'Microphone Access',
        message: 'This app needs microphone access for audio input.',
        rationale: 'Microphone access is required for voice input features.'
      }
    };
  }

  static getInstance(): PermissionsService {
    if (!PermissionsService.instance) {
      PermissionsService.instance = new PermissionsService();
    }
    return PermissionsService.instance;
  }

  /**
   * Check permission status
   */
  async checkPermission(type: PermissionType): Promise<PermissionStatus> {
    try {
      // Check cache first
      if (this.permissionCache.has(type)) {
        return this.permissionCache.get(type)!;
      }

      let status: PermissionStatus;

      if (Platform.OS === 'ios') {
        status = await this.checkIOSPermission(type);
      } else if (Platform.OS === 'android') {
        status = await this.checkAndroidPermission(type);
      } else {
        // Web platform - assume granted
        status = {
          granted: true,
          canAskAgain: true,
          status: 'granted',
          platform: Platform.OS
        };
      }

      // Cache the result
      this.permissionCache.set(type, status);
      return status;

    } catch (error) {
      console.error(`Permission check failed for ${type}:`, error);
      
      await errorHandlerService.handleError(error as Error, {
        screen: 'PermissionsService',
        action: 'check_permission',
        data: { type }
      });

      return {
        granted: false,
        canAskAgain: true,
        status: 'unavailable',
        platform: Platform.OS
      };
    }
  }

  /**
   * Check iOS permission
   */
  private async checkIOSPermission(type: PermissionType): Promise<PermissionStatus> {
    try {
      const permission = this.getIOSPermissionType(type);
      const result = await PermissionsIOS.checkAsync(permission);
      
      return {
        granted: result.granted,
        canAskAgain: result.canAskAgain,
        status: result.status,
        platform: 'ios'
      };
    } catch (error) {
      console.error('iOS permission check failed:', error);
      return {
        granted: false,
        canAskAgain: true,
        status: 'unavailable',
        platform: 'ios'
      };
    }
  }

  /**
   * Check Android permission
   */
  private async checkAndroidPermission(type: PermissionType): Promise<PermissionStatus> {
    try {
      const permission = this.getAndroidPermissionType(type);
      const result = await PermissionsAndroid.check(permission);
      
      return {
        granted: result === 'granted',
        canAskAgain: result === 'denied',
        status: result,
        platform: 'android'
      };
    } catch (error) {
      console.error('Android permission check failed:', error);
      return {
        granted: false,
        canAskAgain: true,
        status: 'unavailable',
        platform: 'android'
      };
    }
  }

  /**
   * Get iOS permission type
   */
  private getIOSPermissionType(type: PermissionType): string {
    const iosPermissions: Record<PermissionType, string> = {
      camera: 'camera',
      photos: 'photos',
      storage: 'read_storage',
      notifications: 'notifications',
      location: 'location',
      microphone: 'microphone'
    };
    
    return iosPermissions[type] || 'unknown';
  }

  /**
   * Get Android permission type
   */
  private getAndroidPermissionType(type: PermissionType): string {
    const androidPermissions: Record<PermissionType, string> = {
      camera: 'android.permission.CAMERA',
      photos: 'android.permission.READ_EXTERNAL_STORAGE',
      storage: 'android.permission.READ_EXTERNAL_STORAGE',
      notifications: 'android.permission.POST_NOTIFICATIONS',
      location: 'android.permission.ACCESS_FINE_LOCATION',
      microphone: 'android.permission.RECORD_AUDIO'
    };
    
    return androidPermissions[type] || 'android.permission.UNKNOWN';
  }

  /**
   * Request permission
   */
  async requestPermission(request: PermissionRequest): Promise<boolean> {
    try {
      const config = this.config[request.type];
      
      let granted = false;
      
      if (Platform.OS === 'ios') {
        granted = await this.requestIOSPermission(request);
      } else if (Platform.OS === 'android') {
        granted = await this.requestAndroidPermission(request);
      } else {
        // Web platform - assume granted
        granted = true;
      }

      // Update cache
      const status: PermissionStatus = {
        granted,
        canAskAgain: true,
        status: granted ? 'granted' : 'denied',
        platform: Platform.OS
      };
      
      this.permissionCache.set(request.type, status);
      
      return granted;

    } catch (error) {
      console.error('Permission request failed:', error);
      
      await errorHandlerService.handleError(error as Error, {
        screen: 'PermissionsService',
        action: 'request_permission',
        data: { type: request.type }
      });
      
      return false;
    }
  }

  /**
   * Request iOS permission
   */
  private async requestIOSPermission(request: PermissionRequest): Promise<boolean> {
    try {
      const permission = this.getIOSPermissionType(request.type);
      
      const result = await PermissionsIOS.requestAsync([
        permission,
        {
          title: request.title,
          message: request.message,
          ...(request.rationale && { alert: true }),
        },
        ...(request.options || {})
      ]);

      return result.granted;
    } catch (error) {
      console.error('iOS permission request failed:', error);
      return false;
    }
  }

  /**
   * Request Android permission
   */
  private async requestAndroidPermission(request: PermissionRequest): Promise<boolean> {
    try {
      const permission = this.getAndroidPermissionType(request.type);
      
      const result = await PermissionsAndroid.requestAsync([
        permission,
        {
          title: request.title,
          message: request.message,
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow'
        },
        ...(request.options || {})
      ]);

      return result === 'granted';
    } catch (error) {
      console.error('Android permission request failed:', error);
      return false;
    }
  }

  /**
   * Show permission rationale dialog
   */
  showPermissionRationale(type: PermissionType): void {
    const config = this.config[type];
    
    Alert.alert(
      config.title,
      config.message,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Settings',
          style: 'default'
        }
      ],
      { cancelable: false }
    );
  }

  /**
   * Open app settings
   */
  openSettings(): void {
    try {
      if (Platform.OS === 'ios') {
        Linking.openSettings();
      } else if (Platform.OS === 'android') {
        Linking.openSettings();
      } else {
        console.log('Settings not available on this platform');
      }
    } catch (error) {
      console.error('Failed to open settings:', error);
    }
  }

  /**
   * Get all permissions status
   */
  async getAllPermissionsStatus(): Promise<Record<PermissionType, PermissionStatus>> {
    const permissions: Record<PermissionType, PermissionStatus> = {} as any;
    
    const permissionTypes: PermissionType[] = [
      'camera', 'photos', 'microphone', 'storage', 'notifications', 'location'
    ];

    for (const type of permissionTypes) {
      permissions[type] = await this.checkPermission(type);
    }

    return permissions;
  }

  /**
   * Check if all required permissions are granted
   */
  async checkRequiredPermissions(requiredPermissions: PermissionType[]): Promise<boolean> {
    const results = await Promise.all(
      requiredPermissions.map(permission => this.checkPermission(permission))
    );
    
    return results.every(result => result.granted);
  }

  /**
   * Get missing permissions
   */
  async getMissingPermissions(requiredPermissions: PermissionType[]): Promise<PermissionType[]> {
    const results = await this.checkRequiredPermissions(requiredPermissions);
    const missing = requiredPermissions.filter((_, index) => !results[index].granted);
    
    return missing;
  }

  /**
   * Request multiple permissions
   */
  async requestMultiplePermissions(permissions: PermissionRequest[]): Promise<boolean[]> {
    const results = await Promise.all(
      permissions.map(permission => this.requestPermission(permission))
    );
    
    return results;
  }

  /**
   * Check if specific permissions are available
   */
  async arePermissionsAvailable(permissions: PermissionType[]): Promise<boolean> {
    const results = await this.checkRequiredPermissions(permissions);
    return results.every(result => result.granted);
  }

  /**
   * Get permission configuration
   */
  getConfig(): PermissionConfig {
    return { ...this.config };
  }

  /**
   * Configure permission settings
   */
  configure(config: Partial<PermissionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear permission cache
   */
  clearCache(): void {
    this.permissionCache.clear();
    console.log('Permission cache cleared');
  }

  /**
   * Get permission cache status
   */
  getCacheStatus(): Record<string, PermissionStatus> {
    const cache: Record<string, PermissionStatus> = {} as any;
    
    for (const [key, value] of this.permissionCache.entries()) {
      cache[key] = value;
    }
    
    return cache;
  }

  /**
   * Check if permission is permanently denied
   */
  async isPermanentlyDenied(type: PermissionType): Promise<boolean> {
    const status = await this.checkPermission(type);
    return status.status === 'denied' && !status.canAskAgain;
  }

  /**
   * Get permission health status
   */
  async getPermissionHealth(): Promise<{
    totalPermissions: number;
    granted: number;
    denied: number;
    blocked: number;
    unavailable: number;
    platform: string;
  }> {
    const status = await this.getAllPermissionsStatus();
    
    const stats = {
      totalPermissions: Object.keys(status).length,
      granted: Object.values(status).filter(s => s.granted).length,
      denied: Object.values(status).filter(s => s.status === 'denied').length,
      blocked: Object.values(status).filter(s => s.status === 'blocked').length,
      unavailable: Object.values(status).filter(s => s.status === 'unavailable').length,
      platform: Platform.OS
    };

    return stats;
  }

  /**
   * Get platform-specific permission recommendations
   */
  getPlatformRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (Platform.OS === 'ios') {
      recommendations.push(
        'Consider using Info.plist for declarative permissions',
        'Use NSLocationWhenInUse or requestWhenInUse for location',
        'Use NSCameraUsageDescription for camera permissions'
      );
    } else if (Platform.OS === 'android') {
      return [
        'Consider using manifest for declarative permissions',
        'Use requestPermissions() for runtime permissions',
        'Check Android version for permission requirements'
      ];
    } else {
      recommendations.push(
        'Check browser compatibility for permissions',
        'Use Permissions API for web platforms'
      );
    }

    return recommendations;
  }
}

export const permissionsService = PermissionsService.getInstance();