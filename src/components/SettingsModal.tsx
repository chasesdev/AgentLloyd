'use client';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { settingsService } from '@/services/settingsService';
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [modelName, setModelName] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);
  const loadSettings = () => {
    const settings = settingsService.getSettings();
    setApiKey(settings.apiKey);
    setApiUrl(settings.apiUrl);
    setModelName(settings.modelName);
  };
  const handleSave = () => {
    const validation = settingsService.validateSettings();
    if (!validation.valid) {
      Alert.alert('Invalid Settings', validation.error);
      return;
    }
    settingsService.updateApiKey(apiKey);
    settingsService.updateApiUrl(apiUrl);
    settingsService.updateModelName(modelName);
    Alert.alert('Success', 'Settings saved successfully');
    onClose();
  };
  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: () => {
            settingsService.resetToDefaults();
            loadSettings();
            Alert.alert('Success', 'Settings reset to defaults');
          }
        }
      ]
    );
  };
  const handleExport = () => {
    const settingsJson = settingsService.exportSettings();
    console.log('Export settings:', settingsJson);
    Alert.alert('Export', 'Settings exported to console (dev mode)');
  };
  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="settings-outline" size={24} color="#333" />
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>API Configuration</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>API Key</Text>
              <Text style={styles.inputHint}>
                Leave blank and set Model Name + URL for LM Studio
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.textInput, styles.passwordInput]}
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="Enter your API key (optional)"
                  placeholderTextColor="#999"
                  secureTextEntry={!showApiKey}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowApiKey(!showApiKey)}
                >
                  <Ionicons 
                    name={showApiKey ? "eye-off" : "eye"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Model Name</Text>
              <Text style={styles.inputHint}>
                Required for LM Studio (e.g., "llama-3-8b-instruct")
              </Text>
              <TextInput
                style={styles.textInput}
                value={modelName}
                onChangeText={setModelName}
                placeholder="llama-3-8b-instruct"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>API URL</Text>
              <Text style={styles.inputHint}>
                Z-AI API or LM Studio URL (e.g., http:
              </Text>
              <TextInput
                style={styles.textInput}
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="https:
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>
            {}
            <View style={styles.modeInfo}>
              <Ionicons name="information-circle-outline" size={16} color="#3b82f6" />
              <Text style={styles.modeInfoText}>
                {apiKey ? 'Z-AI Mode' : 'LM Studio Mode'} - 
                {apiKey 
                  ? ' Using Z-AI API with your key' 
                  : ' Using local LM Studio instance'
                }
              </Text>
            </View>
          </View>
          {}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Danger Zone</Text>
            <TouchableOpacity style={styles.dangerButton} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={20} color="#dc2626" />
              <Text style={styles.dangerButtonText}>Reset to Defaults</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
              <Ionicons name="download-outline" size={20} color="#059669" />
              <Text style={styles.exportButtonText}>Export Settings</Text>
            </TouchableOpacity>
          </View>
          {}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>About</Text>
            <Text style={styles.infoText}>
              Z-AI Chat App v1.0.0
            </Text>
            <Text style={styles.infoText}>
              Configure your API settings to connect to your Z-AI instance.
            </Text>
          </View>
        </ScrollView>
        {}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.footerButton, styles.saveButton]}
            onPress={handleSave}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  inputHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  eyeButton: {
    padding: 8,
    marginLeft: 8,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  modeInfoText: {
    fontSize: 12,
    color: '#1e40af',
    marginLeft: 6,
    flex: 1,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#dc2626',
    marginLeft: 8,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#059669',
    marginLeft: 8,
  },
  infoSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
});