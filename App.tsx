import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ApiKeyScreen } from './src/screens/ApiKeyScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LoadingSpinner } from './src/components/LoadingSpinner';
import { LoadingProvider } from './src/contexts/LoadingContext';
import { zaiService } from './src/services/zaiService';
import { chatMemoryService } from './src/services/chatMemoryService';
import { errorHandlerService } from './src/services/errorHandlerService';

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await zaiService.initialize();
      await chatMemoryService.init();
      await checkApiKey();
    } catch (error) {
      await errorHandlerService.handleError(error as Error, {
        screen: 'App',
        action: 'initialization'
      });
    }
  };

  const checkApiKey = async () => {
    try {
      setHasApiKey(zaiService.hasApiKey);
    } catch (error) {
      await errorHandlerService.handleError(error as Error, {
        screen: 'App',
        action: 'check_api_key'
      });
    }
  };

  const handleApiKeySet = () => {
    setHasApiKey(true);
  };

  const handleLogout = () => {
    setHasApiKey(false);
  };

  return (
    <ErrorBoundary>
      <LoadingProvider>
        <StatusBar style="auto" />
        <LoadingSpinner overlay={true} />
        {hasApiKey ? (
          <ChatScreen onLogout={handleLogout} />
        ) : (
          <ApiKeyScreen onApiKeySet={handleApiKeySet} />
        )}
      </LoadingProvider>
    </ErrorBoundary>
  );
}