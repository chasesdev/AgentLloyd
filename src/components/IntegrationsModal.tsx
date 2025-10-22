'use client';

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Alert,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { settingsService } from '@/services/settingsService';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children?: React.ReactNode;
}

function IntegrationCard({ title, description, icon, enabled, onToggle, children }: IntegrationCardProps) {
  return (
    <View style={styles.integrationCard}>
      <View style={styles.integrationHeader}>
        <View style={styles.integrationInfo}>
          <Ionicons name={icon as any} size={24} color="#374151" />
          <View style={styles.integrationText}>
            <Text style={styles.integrationTitle}>{title}</Text>
            <Text style={styles.integrationDescription}>{description}</Text>
          </View>
        </View>
        <Switch
          value={enabled}
          onValueChange={onToggle}
          trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
          thumbColor={enabled ? '#ffffff' : '#ffffff'}
        />
      </View>
      {enabled && children && (
        <View style={styles.integrationContent}>
          {children}
        </View>
      )}
    </View>
  );
}

export function IntegrationsModal({ isOpen, onClose }: IntegrationsModalProps) {
  const [githubEnabled, setGithubEnabled] = useState(false);
  const [gistEnabled, setGistEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = () => {
    const settings = settingsService.getSettings();
    setGithubEnabled(settings.githubEnabled);
    setGistEnabled(settings.gistEnabled);
  };

  const handleGitHubToggle = (enabled: boolean) => {
    setGithubEnabled(enabled);
    settingsService.updateGitHubEnabled(enabled);
    
    if (enabled) {
      Alert.alert(
        'GitHub Integration',
        'GitHub integration enabled! You can now manage repositories, create codespaces, and handle pull requests.'
      );
    }
  };

  const handleGistToggle = (enabled: boolean) => {
    setGistEnabled(enabled);
    settingsService.updateGistEnabled(enabled);
    
    if (enabled) {
      Alert.alert(
        'Gist Integration',
        'Gist integration enabled! Your planning sessions will be automatically formatted as markdown gists.'
      );
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="extension-puzzle-outline" size={24} color="#333" />
            <Text style={styles.headerTitle}>Integrations</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* GitHub Integration */}
          <IntegrationCard
            title="GitHub"
            description="Connect to GitHub for repository management, codespaces, and pull requests"
            icon="logo-github"
            enabled={githubEnabled}
            onToggle={handleGitHubToggle}
          >
            <View style={styles.integrationSettings}>
              <Text style={styles.settingsText}>
                GitHub integration enables:
              </Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.featureText}>Repository management</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.featureText}>Codespace creation</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.featureText}>Pull request workflows</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.featureText}>Branch management</Text>
                </View>
              </View>
            </View>
          </IntegrationCard>

          {/* Gist Integration */}
          <IntegrationCard
            title="GitHub Gist"
            description="Create and manage GitHub gists for sharing planning and documentation"
            icon="document-text-outline"
            enabled={gistEnabled}
            onToggle={handleGistToggle}
          >
            <View style={styles.integrationSettings}>
              <Text style={styles.settingsText}>
                Gist integration enables:
              </Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.featureText}>Markdown formatting</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.featureText}>Structured documentation</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.featureText}>Shareable planning gists</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.featureText}>Template-based generation</Text>
                </View>
              </View>
            </View>
          </IntegrationCard>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>About Integrations</Text>
            <Text style={styles.infoText}>
              Integrations enhance your chat experience by connecting to external services. Enable the ones you need to customize your workflow.
            </Text>
            <Text style={styles.infoText}>
              Each integration can be toggled on/off independently. Some features may require additional authentication.
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, styles.footerCloseButton]}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Close</Text>
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
  integrationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  integrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  integrationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  integrationText: {
    marginLeft: 12,
    flex: 1,
  },
  integrationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  integrationDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  integrationContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  integrationSettings: {
    gap: 12,
  },
  settingsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  featureList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
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
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  footerCloseButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
});