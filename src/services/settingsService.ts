interface Settings {
  apiKey: string;
  apiUrl: string;
  modelName: string;
  githubEnabled: boolean;
  gistEnabled: boolean;
}

class SettingsService {
  private settings: Settings;
  private readonly STORAGE_KEY = 'z-ai-chat-settings';

  constructor() {
    this.settings = this.getDefaultSettings();
    this.loadSettings();
  }

  private getDefaultSettings(): Settings {
    return {
      apiKey: '',
      apiUrl: 'https://api.z-ai.dev',
      modelName: '',
      githubEnabled: false,
      gistEnabled: false
    };
  }

  // Load settings from storage
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  // Save settings to storage
  private saveSettings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  // Get all settings
  getSettings(): Settings {
    return { ...this.settings };
  }

  // Update API key
  updateApiKey(apiKey: string): void {
    this.settings.apiKey = apiKey;
    this.saveSettings();
  }

  // Update API URL
  updateApiUrl(apiUrl: string): void {
    this.settings.apiUrl = apiUrl;
    this.saveSettings();
  }

  // Update model name
  updateModelName(modelName: string): void {
    this.settings.modelName = modelName;
    this.saveSettings();
  }

  // Update GitHub integration
  updateGitHubEnabled(enabled: boolean): void {
    this.settings.githubEnabled = enabled;
    this.saveSettings();
  }

  // Update Gist integration
  updateGistEnabled(enabled: boolean): void {
    this.settings.gistEnabled = enabled;
    this.saveSettings();
  }

  // Check if using LM Studio (blank API key with custom URL)
  isUsingLMStudio(): boolean {
    return !this.settings.apiKey && 
           this.settings.modelName && 
           this.settings.apiUrl && 
           this.settings.apiUrl !== 'https://api.z-ai.dev';
  }

  // Get model configuration for API calls
  getModelConfig(): { apiKey: string; apiUrl: string; modelName: string } {
    return {
      apiKey: this.settings.apiKey,
      apiUrl: this.settings.apiUrl,
      modelName: this.settings.modelName
    };
  }

  // Validate settings
  validateSettings(): { valid: boolean; error?: string } {
    if (this.isUsingLMStudio()) {
      // LM Studio mode - validate URL and model name
      if (!this.settings.apiUrl) {
        return { valid: false, error: 'API URL is required for LM Studio' };
      }
      if (!this.settings.modelName) {
        return { valid: false, error: 'Model name is required for LM Studio' };
      }
      try {
        new URL(this.settings.apiUrl);
      } catch {
        return { valid: false, error: 'Invalid API URL format' };
      }
    } else {
      // Z-AI mode - validate API key
      if (!this.settings.apiKey) {
        return { valid: false, error: 'API key is required' };
      }
    }
    return { valid: true };
  }

  // Export settings
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  // Import settings
  importSettings(settingsJson: string): { success: boolean; error?: string } {
    try {
      const imported = JSON.parse(settingsJson);
      
      // Validate imported settings
      if (typeof imported !== 'object' || imported === null) {
        return { success: false, error: 'Invalid settings format' };
      }

      // Merge with current settings
      this.settings = { ...this.settings, ...imported };
      this.saveSettings();
      
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to import settings' };
    }
  }

  // Reset to defaults
  resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.saveSettings();
  }
}

export const settingsService = new SettingsService();
export type { Settings };