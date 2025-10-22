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
import { validationService } from '../services/validationService';
interface Props {
  onApiKeySet: () => void;
}
export const ApiKeyScreen: React.FC<Props> = ({ onApiKeySet }) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);
  useEffect(() => {
    checkExistingKey();
  }, []);
  const checkExistingKey = async () => {
    if (zaiService.hasApiKey) {
      onApiKeySet();
    }
  };
  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Error', 'Please enter an API key');
      return;
    }
    const validation = validationService.validateAndSanitize(apiKey, 'text');
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }
    if (validation.warnings.length > 0) {
      console.warn('API key validation warnings:', validation.warnings);
    }
    const sanitizedKey = validation.sanitized;
    setIsLoading(true);
    try {
      const isValid = await zaiService.validateApiKey(sanitizedKey);
      if (isValid) {
        await zaiService.setApiKey(sanitizedKey);
        Alert.alert('Success', 'API key saved successfully!', [
          { text: 'OK', onPress: onApiKeySet }
        ]);
      } else {
        Alert.alert('Error', 'Invalid API key. Please check and try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to validate API key. Please try again.');
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
          <Text style={styles.title}>Welcome to Z.AI Chat</Text>
          <Text style={styles.subtitle}>
            Enter your API key to start chatting with advanced AI models
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
          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>How to get your API key:</Text>
            <Text style={styles.helpText}>
              1. Visit {'https:
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