import AsyncStorage from '@react-native-async-storage/async-storage';

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
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.settings = this.getDefaultSettings();
    this.initPromise = this.loadSettings();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
  }

  private getDefaultSettings(): Settings {
    return {
      apiKey: '',
      apiUrl: 'https://api.z.ai/api/paas/v4',
      modelName: '',
      githubEnabled: false,
      gistEnabled: false
    };
  }
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      this.initialized = true;
      this.initPromise = null;
    }
  }
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
  async getSettings(): Promise<Settings> {
    await this.ensureInitialized();
    return { ...this.settings };
  }
  async updateApiKey(apiKey: string): Promise<void> {
    await this.ensureInitialized();
    this.settings.apiKey = apiKey;
    await this.saveSettings();
  }
  async updateApiUrl(apiUrl: string): Promise<void> {
    await this.ensureInitialized();
    this.settings.apiUrl = apiUrl;
    await this.saveSettings();
  }
  async updateModelName(modelName: string): Promise<void> {
    await this.ensureInitialized();
    this.settings.modelName = modelName;
    await this.saveSettings();
  }
  async updateGitHubEnabled(enabled: boolean): Promise<void> {
    await this.ensureInitialized();
    this.settings.githubEnabled = enabled;
    await this.saveSettings();
  }
  async updateGistEnabled(enabled: boolean): Promise<void> {
    await this.ensureInitialized();
    this.settings.gistEnabled = enabled;
    await this.saveSettings();
  }
  isUsingLMStudio(): boolean {
    return !this.settings.apiKey &&
           !!this.settings.modelName &&
           !!this.settings.apiUrl &&
           this.settings.apiUrl !== 'https://api.z.ai/api/paas/v4';
  }
  getModelConfig(): { apiKey: string; apiUrl: string; modelName: string } {
    return {
      apiKey: this.settings.apiKey,
      apiUrl: this.settings.apiUrl,
      modelName: this.settings.modelName
    };
  }
  validateSettings(): { valid: boolean; error?: string } {
    if (this.isUsingLMStudio()) {
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
      if (!this.settings.apiKey) {
        return { valid: false, error: 'API key is required' };
      }
    }
    return { valid: true };
  }
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }
  async importSettings(settingsJson: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ensureInitialized();
      const imported = JSON.parse(settingsJson);
      if (typeof imported !== 'object' || imported === null) {
        return { success: false, error: 'Invalid settings format' };
      }
      this.settings = { ...this.settings, ...imported };
      await this.saveSettings();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to import settings' };
    }
  }
  async resetToDefaults(): Promise<void> {
    await this.ensureInitialized();
    this.settings = this.getDefaultSettings();
    await this.saveSettings();
  }
}
export const settingsService = new SettingsService();
export type { Settings };