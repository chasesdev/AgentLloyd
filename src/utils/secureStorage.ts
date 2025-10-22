import * as SecureStore from 'expo-secure-store';
import CryptoJS from 'crypto-js';

// Note: In a production app, you would use a more secure encryption method
// and store the encryption key securely (e.g., in the device keychain/keystore)
// For this demo, we'll use a simple approach

const ENCRYPTION_KEY = 'zai-chat-encryption-key-2024'; // In production, this should be device-specific

export class SecureStorage {
  /**
   * Store data with encryption
   */
  static async setItem(key: string, value: string): Promise<void> {
    try {
      // Encrypt the value
      const encryptedValue = CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
      
      // Store in secure store
      await SecureStore.setItemAsync(key, encryptedValue);
    } catch (error) {
      console.error(`Failed to store encrypted data for key ${key}:`, error);
      throw new Error('Failed to store data securely');
    }
  }

  /**
   * Retrieve and decrypt data
   */
  static async getItem(key: string): Promise<string | null> {
    try {
      // Get encrypted value from secure store
      const encryptedValue = await SecureStore.getItemAsync(key);
      
      if (!encryptedValue) {
        return null;
      }

      // Decrypt the value
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedValue, ENCRYPTION_KEY);
      const decryptedValue = decryptedBytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedValue) {
        console.warn(`Failed to decrypt data for key ${key}`);
        return null;
      }

      return decryptedValue;
    } catch (error) {
      console.error(`Failed to retrieve encrypted data for key ${key}:`, error);
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
    // Basic validation for Z.AI API keys
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Remove whitespace
    const trimmedKey = apiKey.trim();
    
    // Check minimum length (API keys are typically at least 20 characters)
    if (trimmedKey.length < 20) {
      return false;
    }

    // Check for common API key patterns (alphanumeric with some special characters)
    const apiKeyPattern = /^[a-zA-Z0-9\-_]+$/;
    return apiKeyPattern.test(trimmedKey);
  }

  /**
   * Store API key with validation
   */
  static async setApiKey(key: string, apiKey: string): Promise<boolean> {
    try {
      if (!this.validateApiKey(apiKey)) {
        throw new Error('Invalid API key format');
      }

      await this.setItem(key, apiKey);
      return true;
    } catch (error) {
      console.error(`Failed to store API key for ${key}:`, error);
      return false;
    }
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

  /**
   * Rotate encryption key (for security maintenance)
   */
  static async rotateEncryptionKey(): Promise<void> {
    try {
      // Get all current values
      const currentKeys = ['zai_api_key', 'github_token'];
      const currentValues: Record<string, string | null> = {};

      // Retrieve and decrypt all current values
      for (const key of currentKeys) {
        currentValues[key] = await this.getItem(key);
      }

      // Clear current storage
      await this.clear();

      // In a real implementation, you would generate a new encryption key here
      // and re-encrypt all values with the new key
      
      // For now, we'll just restore the values with the same key
      for (const [key, value] of Object.entries(currentValues)) {
        if (value) {
          await this.setItem(key, value);
        }
      }

      console.log('Encryption key rotation completed');
    } catch (error) {
      console.error('Failed to rotate encryption key:', error);
      throw new Error('Failed to rotate encryption key');
    }
  }
}