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
      apiUrl: 'https:
      modelName: '',
      githubEnabled: false,
      gistEnabled: false
    };
  }
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
  private saveSettings(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
  getSettings(): Settings {
    return { ...this.settings };
  }
  updateApiKey(apiKey: string): void {
    this.settings.apiKey = apiKey;
    this.saveSettings();
  }
  updateApiUrl(apiUrl: string): void {
    this.settings.apiUrl = apiUrl;
    this.saveSettings();
  }
  updateModelName(modelName: string): void {
    this.settings.modelName = modelName;
    this.saveSettings();
  }
  updateGitHubEnabled(enabled: boolean): void {
    this.settings.githubEnabled = enabled;
    this.saveSettings();
  }
  updateGistEnabled(enabled: boolean): void {
    this.settings.gistEnabled = enabled;
    this.saveSettings();
  }
  isUsingLMStudio(): boolean {
    return !this.settings.apiKey && 
           this.settings.modelName && 
           this.settings.apiUrl && 
           this.settings.apiUrl !== 'https:
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
  importSettings(settingsJson: string): { success: boolean; error?: string } {
    try {
      const imported = JSON.parse(settingsJson);
      if (typeof imported !== 'object' || imported === null) {
        return { success: false, error: 'Invalid settings format' };
      }
      this.settings = { ...this.settings, ...imported };
      this.saveSettings();
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to import settings' };
    }
  }
  resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.saveSettings();
  }
}
export const settingsService = new SettingsService();
export type { Settings };