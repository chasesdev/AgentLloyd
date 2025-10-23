import * as SecureStore from 'expo-secure-store';

export class SecureStorage {
  /**
   * Store data securely (SecureStore uses native iOS Keychain/Android Keystore encryption)
   */
  static async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`Failed to store data for key ${key}:`, error);
      throw new Error(`Failed to store data securely: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve data securely
   */
  static async getItem(key: string): Promise<string | null> {
    try {
      const value = await SecureStore.getItemAsync(key);
      return value;
    } catch (error) {
      console.error(`Failed to retrieve data for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove an item from secure storage
   */
  static async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Failed to remove data for key ${key}:`, error);
      throw new Error('Failed to remove data');
    }
  }

  /**
   * Check if a key exists
   */
  static async hasItem(key: string): Promise<boolean> {
    try {
      const value = await this.getItem(key);
      return value !== null;
    } catch (error) {
      console.error(`Failed to check if key exists for ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all secure storage (use with caution)
   */
  static async clear(): Promise<void> {
    try {
      // Get all keys (this is a limitation - SecureStore doesn't provide a way to list keys)
      // We'll need to manually clear known keys
      const knownKeys = [
        'zai_api_key',
        'github_token',
        'user_preferences',
        'encryption_version'
      ];

      for (const key of knownKeys) {
        await this.removeItem(key);
      }
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
      throw new Error('Failed to clear secure storage');
    }
  }

  /**
   * Validate API key format before storing
   */
  static validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    const trimmedKey = apiKey.trim();

    if (trimmedKey.length < 20) {
      return false;
    }

    const apiKeyPattern = /^[a-zA-Z0-9\-_.]+$/;
    return apiKeyPattern.test(trimmedKey);
  }

  /**
   * Store API key with validation
   */
  static async setApiKey(key: string, apiKey: string): Promise<void> {
    if (!this.validateApiKey(apiKey)) {
      throw new Error('Invalid API key format');
    }

    await this.setItem(key, apiKey);
  }

  /**
   * Get API key with validation
   */
  static async getApiKey(key: string): Promise<string | null> {
    try {
      const apiKey = await this.getItem(key);
      
      if (!apiKey) {
        return null;
      }

      // Validate the retrieved key
      if (!this.validateApiKey(apiKey)) {
        console.warn(`Invalid API key format found for ${key}, removing...`);
        await this.removeItem(key);
        return null;
      }

      return apiKey;
    } catch (error) {
      console.error(`Failed to get API key for ${key}:`, error);
      return null;
    }
  }

}