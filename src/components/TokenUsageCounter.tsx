import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tokenUsageService } from '../services/tokenUsageService';
interface TokenUsageCounterProps {
  model: string;
}
export const TokenUsageCounter: React.FC<TokenUsageCounterProps> = ({ model }) => {
  const [usage, setUsage] = useState(tokenUsageService.getCurrentChatUsage());
  useEffect(() => {
    const interval = setInterval(() => {
      setUsage(tokenUsageService.getCurrentChatUsage());
    }, 1000); 
    return () => clearInterval(interval);
  }, []);
  if (usage.totalTokens === 0) {
    return null;
  }
  return (
    <View style={styles.container}>
      <Ionicons name="analytics-outline" size={14} color="#666" />
      <Text style={styles.tokenText}>
        {tokenUsageService.formatTokens(usage.totalTokens)} tokens
      </Text>
      <Text style={styles.costText}>
        ({tokenUsageService.formatCost(usage.cost)})
      </Text>
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  tokenText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  costText: {
    fontSize: 11,
    color: '#666',
    fontStyle: 'italic',
  },
});