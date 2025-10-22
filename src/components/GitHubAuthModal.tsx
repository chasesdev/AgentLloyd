import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface GitHubAuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  detectedCommands: string[];
}

export const GitHubAuthModal: React.FC<GitHubAuthModalProps> = ({
  visible,
  onClose,
  onSuccess,
  detectedCommands,
}) => {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleAuthenticate = async () => {
    if (!token.trim()) {
      Alert.alert('Error', 'Please enter a GitHub token');
      return;
    }

    setIsLoading(true);
    try {
      const { githubService } = await import('../services/githubService');
      const success = await githubService.setToken(token.trim());
      
      if (success) {
        Alert.alert('Success', 'GitHub authentication successful!');
        onSuccess();
        setToken('');
        setShowInstructions(false);
      } else {
        Alert.alert('Error', 'Invalid GitHub token. Please check and try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to authenticate with GitHub');
    } finally {
      setIsLoading(false);
    }
  };

  const openGitHubTokenPage = () => {
    Linking.openURL('https://github.com/settings/tokens');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>GitHub Authentication</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {detectedCommands.length > 0 && (
            <View style={styles.detectedSection}>
              <Text style={styles.detectedTitle}>Detected GitHub references:</Text>
              {detectedCommands.map((command, index) => (
                <Text key={index} style={styles.detectedCommand}>
                  • {command}
                </Text>
              ))}
            </View>
          )}

          <Text style={styles.description}>
            GitHub access requires a personal access token. This allows the app to interact with GitHub repositories on your behalf.
          </Text>

          <TouchableOpacity
            style={styles.instructionsButton}
            onPress={() => setShowInstructions(!showInstructions)}
          >
            <Ionicons 
              name={showInstructions ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="#007AFF" 
            />
            <Text style={styles.instructionsButtonText}>
              {showInstructions ? 'Hide' : 'Show'} Setup Instructions
            </Text>
          </TouchableOpacity>

          {showInstructions && (
            <View style={styles.instructionsBox}>
              <Text style={styles.instructionsTitle}>How to create a GitHub token:</Text>
              <Text style={styles.instructionsText}>
                1. Go to https://github.com/settings/tokens
              </Text>
              <Text style={styles.instructionsText}>
                2. Click "Generate new token (classic)"
              </Text>
              <Text style={styles.instructionsText}>
                3. Give it a name (e.g., "Chat App")
              </Text>
              <Text style={styles.instructionsText}>
                4. Select these scopes:
              </Text>
              <Text style={styles.instructionsText}>
                • repo (Full control of private repositories)
              </Text>
              <Text style={styles.instructionsText}>
                • read:org (Read org and team membership)
              </Text>
              <Text style={styles.instructionsText}>
                • read:user (Read all user profile data)
              </Text>
              <Text style={styles.instructionsText}>
                5. Click "Generate token"
              </Text>
              <Text style={styles.instructionsText}>
                6. Copy the token and paste it below
              </Text>
              
              <TouchableOpacity
                style={styles.openGitHubButton}
                onPress={openGitHubTokenPage}
              >
                <Ionicons name="open-outline" size={16} color="#fff" />
                <Text style={styles.openGitHubButtonText}>Open GitHub Token Page</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.tokenSection}>
            <Text style={styles.tokenLabel}>GitHub Personal Access Token:</Text>
            <TextInput
              style={styles.tokenInput}
              value={token}
              onChangeText={setToken}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              placeholderTextColor="#999"
              secureTextEntry
              multiline
              numberOfLines={3}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={16} color="#666" />
            <Text style={styles.securityNoteText}>
              Your token is stored securely on your device and never shared
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.authenticateButton, isLoading && styles.disabledButton]}
            onPress={handleAuthenticate}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.authenticateButtonText}>Authenticating...</Text>
            ) : (
              <Text style={styles.authenticateButtonText}>Authenticate</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  detectedSection: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  detectedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  detectedCommand: {
    fontSize: 14,
    color: '#856404',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 16,
  },
  instructionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionsButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  instructionsBox: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  openGitHubButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    justifyContent: 'center',
  },
  openGitHubButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  tokenSection: {
    marginBottom: 16,
  },
  tokenLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  tokenInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    backgroundColor: '#f8f9fa',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  securityNoteText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  authenticateButton: {
    backgroundColor: '#007AFF',
  },
  authenticateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});