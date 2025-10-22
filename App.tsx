import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ApiKeyScreen } from './src/screens/ApiKeyScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { zaiService } from './src/services/zaiService';
import { chatMemoryService } from './src/services/chatMemoryService';

export default function App() {
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    checkApiKey();
    // Initialize chat memory service
    chatMemoryService.init().catch(console.error);
  }, []);

  const checkApiKey = () => {
    setHasApiKey(zaiService.hasApiKey);
  };

  const handleApiKeySet = () => {
    setHasApiKey(true);
  };

  const handleLogout = () => {
    setHasApiKey(false);
  };

  return (
    <>
      <StatusBar style="auto" />
      {hasApiKey ? (
        <ChatScreen onLogout={handleLogout} />
      ) : (
        <ApiKeyScreen onApiKeySet={handleApiKeySet} />
      )}
    </>
  );
}