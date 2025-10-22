// Environment configuration
export const ENVIRONMENT = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.z.ai/api/paas/v4',
  GITHUB_API_BASE_URL: process.env.EXPO_PUBLIC_GITHUB_API_BASE_URL || 'https://api.github.com',
  APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
  BUILD_NUMBER: process.env.EXPO_PUBLIC_BUILD_NUMBER || '1',
  
  // Development settings
  DEBUG_MODE: process.env.EXPO_PUBLIC_DEBUG_MODE === 'true',
  LOG_LEVEL: process.env.EXPO_PUBLIC_LOG_LEVEL || 'info',
  
  // API settings
  API_TIMEOUT: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '60000'),
  API_RETRY_ATTEMPTS: parseInt(process.env.EXPO_PUBLIC_API_RETRY_ATTEMPTS || '3'),
  
  // Security settings
  MAX_INPUT_LENGTH: parseInt(process.env.EXPO_PUBLIC_MAX_INPUT_LENGTH || '10000'),
  SESSION_TIMEOUT: parseInt(process.env.EXPO_PUBLIC_SESSION_TIMEOUT || '86400000'), // 24 hours
  
  // Cache settings
  CACHE_MAX_SIZE: parseInt(process.env.EXPO_PUBLIC_CACHE_MAX_SIZE || '52428800'), // 50MB
  CACHE_DEFAULT_TTL: parseInt(process.env.EXPO_PUBLIC_CACHE_DEFAULT_TTL || '3600000'), // 1 hour
  
  // Rate limiting
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.EXPO_PUBLIC_RATE_LIMIT_MAX_REQUESTS || '100'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.EXPO_PUBLIC_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  
  // Auto updater settings
  AUTO_UPDATE_ENABLED: process.env.EXPO_PUBLIC_AUTO_UPDATE_ENABLED !== 'false',
  AUTO_UPDATE_CHECK_INTERVAL: parseInt(process.env.EXPO_PUBLIC_AUTO_UPDATE_CHECK_INTERVAL || '3600000'), // 1 hour
  AUTO_UPDATE_ENDPOINT: process.env.EXPO_PUBLIC_AUTO_UPDATE_ENDPOINT || '/api/updates/check',
  AUTO_UPDATE_DOWNLOAD_ENDPOINT: process.env.EXPO_PUBLIC_AUTO_UPDATE_DOWNLOAD_ENDPOINT || '/api/updates/download',
  
  // App Store settings
  APP_STORE_ID: process.env.EXPO_PUBLIC_APP_STORE_ID,
  APP_STORE_URL: process.env.EXPO_PUBLIC_APP_STORE_URL,
  PLAY_STORE_URL: process.env.EXPO_PUBLIC_PLAY_STORE_URL,
  
  // Feature flags
  FEATURES: {
    CODE_INTERPRETER: process.env.EXPO_PUBLIC_FEATURE_CODE_INTERPRETER !== 'false',
    FILE_ANALYZER: process.env.EXPO_PUBLIC_FEATURE_FILE_ANALYZER !== 'false',
    OFFLINE_MODE: process.env.EXPO_PUBLIC_FEATURE_OFFLINE_MODE !== 'false',
    GITHUB_INTEGRATION: process.env.EXPO_PUBLIC_FEATURE_GITHUB_INTEGRATION !== 'false',
    PULL_REQUESTS: process.env.EXPO_PUBLIC_FEATURE_PULL_REQUESTS !== 'false',
    GIST_CREATION: process.env.EXPO_PUBLIC_FEATURE_GIST_CREATION !== 'false',
    CODESPACE_SUPPORT: process.env.EXPO_PUBLIC_FEATURE_CODESPACE_SUPPORT !== 'false',
    SEMANTIC_SEARCH: process.env.EXPO_PUBLIC_FEATURE_SEMANTIC_SEARCH !== 'false',
    TOKEN_TRACKING: process.env.EXPO_PUBLIC_FEATURE_TOKEN_TRACKING !== 'false',
    ERROR_REPORTING: process.env.EXPO_PUBLIC_FEATURE_ERROR_REPORTING !== 'false',
    LOADING_STATES: process.env.EXPO_PUBLIC_FEATURE_LOADING_STATES !== 'false',
    PERMISSIONS: process.env.EXPO_PUBLIC_FEATURE_PERMISSIONS !== 'false',
    APP_STATE_TRACKING: process.env.EXPO_PUBLIC_FEATURE_APP_STATE !== 'false',
  },
  
  // Analytics
  ANALYTICS_ENABLED: process.env.EXPO_PUBLIC_ANALYTICS_ENABLED !== 'false',
  ANALYTICS_ENDPOINT: process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT,
  
  // External services
  SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
  GOOGLE_ANALYTICS_ID: process.env.EXPO_PUBLIC_GA_ID,
  
  // Development tools
  FLIPPER_ENABLED: process.env.EXPO_PUBLIC_FLIPPER_ENABLED === 'true',
  REACTotron_ENABLED: process.env.EXPO_PUBLIC_REACTOTRON_ENABLED === 'true',
};

// Validation
export const validateEnvironment = (): boolean => {
  const required = [
    'API_BASE_URL',
    'APP_VERSION',
  ];

  const missing = required.filter(key => !process.env[`EXPO_PUBLIC_${key}`]);
  
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing);
    return false;
  }

  // Validate URLs
  try {
    new URL(ENVIRONMENT.API_BASE_URL);
    new URL(ENVIRONMENT.GITHUB_API_BASE_URL);
  } catch (error) {
    console.error('Invalid URL in environment variables:', error);
    return false;
  }

  // Validate numeric values
  const numericFields = [
    'API_TIMEOUT',
    'API_RETRY_ATTEMPTS',
    'MAX_INPUT_LENGTH',
    'SESSION_TIMEOUT',
    'CACHE_MAX_SIZE',
    'CACHE_DEFAULT_TTL',
    'RATE_LIMIT_MAX_REQUESTS',
    'RATE_LIMIT_WINDOW_MS',
  ];

  for (const field of numericFields) {
    const value = parseInt(process.env[`EXPO_PUBLIC_${field}`] || '0');
    if (isNaN(value) || value < 0) {
      console.error(`Invalid numeric value for ${field}:`, value);
      return false;
    }
  }

  return true;
};

// Environment helpers
export const isDevelopment = (): boolean => ENVIRONMENT.NODE_ENV === 'development';
export const isProduction = (): boolean => ENVIRONMENT.NODE_ENV === 'production';
export const isTest = (): boolean => ENVIRONMENT.NODE_ENV === 'test';

// Feature flag helpers
export const isFeatureEnabled = (feature: keyof typeof ENVIRONMENT.FEATURES): boolean => {
  return ENVIRONMENT.FEATURES[feature];
};

// Debug helpers
export const debugLog = (message: string, ...args: any[]): void => {
  if (ENVIRONMENT.DEBUG_MODE) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
};

export const warnLog = (message: string, ...args: any[]): void => {
  if (ENVIRONMENT.LOG_LEVEL === 'warn' || ENVIRONMENT.LOG_LEVEL === 'error') {
    console.warn(`[WARN] ${message}`, ...args);
  }
};

export const errorLog = (message: string, ...args: any[]): void => {
  if (ENVIRONMENT.LOG_LEVEL === 'error') {
    console.error(`[ERROR] ${message}`, ...args);
  }
};

// Export environment for easy access
export default ENVIRONMENT;