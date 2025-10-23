import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { zaiService } from '../services/zaiService';
import { appleAIService } from '../services/appleAIService';
import { validationService } from '../services/validationService';
interface Props {
  onApiKeySet: () => void;
}
export const ApiKeyScreen: React.FC<Props> = ({ onApiKeySet }) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [appleAIAvailable, setAppleAIAvailable] = useState(false);
  const [appleAIMessage, setAppleAIMessage] = useState('');
  useEffect(() => {
    checkExistingKey();
    checkAppleIntelligence();
  }, []);
  const checkExistingKey = async () => {
    if (zaiService.hasApiKey) {
      onApiKeySet();
    }
  };
  const checkAppleIntelligence = async () => {
    const available = await appleAIService.checkAvailability();
    setAppleAIAvailable(available);
    setAppleAIMessage(appleAIService.getAvailabilityMessage());
  };
  const handleSkip = () => {
    if (appleAIAvailable) {
      onApiKeySet();
    }
  };
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }
    const validation = validationService.validateApiKey(apiKey.trim());
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }
    if (validation.warnings.length > 0) {
      console.warn('API key validation warnings:', validation.warnings);
    }
    const sanitizedKey = apiKey.trim();
    setIsLoading(true);
    try {
      await zaiService.setApiKey(sanitizedKey);
      Alert.alert('Success', 'API key saved successfully!', [
        { text: 'OK', onPress: onApiKeySet }
      ]);
    } catch (error) {
      console.error('Error saving API key:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save API key. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to AgentLloyd</Text>
          <Text style={styles.subtitle}>
            {appleAIAvailable
              ? 'Use Apple Intelligence on-device or enter your Z.AI API key for cloud AI'
              : 'Enter your Z.AI API key to start chatting with advanced AI models'}
          </Text>
        </View>
        <View style={styles.form}>
          <Text style={styles.label}>API Key</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, showKey ? styles.inputVisible : styles.inputHidden]}
              value={apiKey}
              onChangeText={setApiKey}
              placeholder="Enter your Z.AI API key"
              placeholderTextColor="#999"
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setShowKey(!showKey)}
            >
              <Text style={styles.toggleText}>
                {showKey ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSaveApiKey}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save API Key</Text>
            )}
          </TouchableOpacity>
          {appleAIAvailable && (
            <TouchableOpacity
              style={styles.skipButton}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>Skip - Use Apple Intelligence</Text>
              <Text style={styles.skipButtonSubtext}>On-device AI, no internet required</Text>
            </TouchableOpacity>
          )}
          {!appleAIAvailable && (
            <View style={styles.appleAIInfo}>
              <Text style={styles.appleAIInfoText}>{appleAIMessage}</Text>
            </View>
          )}
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>How to get your API key:</Text>
            <Text style={styles.helpText}>
              1. Visit https://z.ai to create an account
            </Text>
            <Text style={styles.helpText}>
              2. Register or login to your account
            </Text>
            <Text style={styles.helpText}>
              3. Navigate to API Keys section
            </Text>
            <Text style={styles.helpText}>
              4. Create and copy your API key
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  inputVisible: {
    fontFamily: 'monospace',
  },
  inputHidden: {
    letterSpacing: 2,
  },
  toggleButton: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 6,
  },
  toggleText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  skipButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  skipButtonSubtext: {
    color: '#666',
    fontSize: 12,
  },
  appleAIInfo: {
    backgroundColor: '#fff3cd',
    borderWidth: 1,
    borderColor: '#ffc107',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  appleAIInfoText: {
    color: '#856404',
    fontSize: 13,
    textAlign: 'center',
  },
  helpSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
});