'use client';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Clipboard,
  Linking,
  StyleSheet,
  Dimensions
} from 'react-native';
import { shareService, type ShareResult } from '@/services/shareService';
import { localRepoService } from '@/services/localRepoService';
import { Ionicons } from '@expo/vector-icons';
interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'fullstack' | 'code' | 'reasoning' | 'general';
  chatId: string;
  messages: any[];
  currentRepo?: string;
  currentBranch?: string;
}
interface SharePreview {
  type: 'pr' | 'gist' | 'link';
  title: string;
  description: string;
  url: string;
  changes?: string[];
}
const { width: screenWidth } = Dimensions.get('window');
export function ShareModal({ 
  isOpen, 
  onClose, 
  mode, 
  chatId, 
  messages, 
  currentRepo,
  currentBranch 
}: ShareModalProps) {
  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(currentRepo || '');
  const [selectedBranch, setSelectedBranch] = useState(currentBranch || 'main');
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SharePreview | null>(null);
  useEffect(() => {
    if (isOpen) {
      setShareTitle('');
      setShareDescription('');
      setSelectedRepo(currentRepo || '');
      setSelectedBranch(currentBranch || 'main');
      setShareResult(null);
      setError(null);
      setCopied(false);
      generatePreview();
    }
  }, [isOpen, mode, chatId, messages, currentRepo, currentBranch]);
  const generatePreview = async () => {
    try {
      let previewData: SharePreview | null = null;
      switch (mode) {
        case 'fullstack':
          previewData = {
            type: 'pr',
            title: shareTitle || `Changes from chat ${chatId.slice(-8)}`,
            description: shareDescription || `Pull request with ${messages.length} messages from Full-Stack mode`,
            url: '',
            changes: ['File changes from codespace']
          };
          break;
        case 'code':
          if (selectedRepo) {
            const [owner, repo] = selectedRepo.split('/');
            const repoId = `${owner}/${repo}/${selectedBranch}`;
            const changes = localRepoService.getTrackedChanges(repoId);
            previewData = {
              type: 'pr',
              title: shareTitle || localRepoService.generateCommitMessage(repoId),
              description: shareDescription || `Pull request with ${changes.length} changes from Code mode`,
              url: '',
              changes: changes.map(c => `${c.type}: ${c.file}`)
            };
          }
          break;
        case 'reasoning':
          previewData = {
            type: 'gist',
            title: shareTitle || `Planning from chat ${chatId.slice(-8)}`,
            description: shareDescription || `Gist containing ${messages.length} reasoning messages`,
            url: ''
          };
          break;
        default:
          previewData = {
            type: 'link',
            title: shareTitle || `Chat ${chatId.slice(-8)}`,
            description: shareDescription || `Share link to chat with ${messages.length} messages`,
            url: `https://share.agentlloyd.app/${chatId}`
          };
      }
      setPreview(previewData);
    } catch (err) {
      console.error('Preview generation failed:', err);
    }
  };
  useEffect(() => {
    generatePreview();
  }, [shareTitle, shareDescription, selectedRepo, selectedBranch, mode]);
  const handleShare = async () => {
    setIsSharing(true);
    setError(null);
    try {
      const result = await shareService.shareContent({
        mode,
        chatId,
        messages,
        title: shareTitle,
        description: shareDescription,
        repoName: selectedRepo,
        branch: selectedBranch
      });
      setShareResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sharing failed');
    } finally {
      setIsSharing(false);
    }
  };
  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setString(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };
  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Failed to open link:', err);
    }
  };
  const getShareIcon = (type: string) => {
    switch (type) {
      case 'pr': return 'git-branch-outline';
      case 'gist': return 'document-text-outline';
      default: return 'share-outline';
    }
  };
  const getShareTypeLabel = (type: string) => {
    switch (type) {
      case 'pr': return 'Pull Request';
      case 'gist': return 'Gist';
      default: return 'Share Link';
    }
  };
  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'fullstack': return '#10b981';
      case 'code': return '#3b82f6';
      case 'reasoning': return '#8b5cf6';
      default: return '#f59e0b';
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
        {}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="share-outline" size={24} color="#333" />
            <Text style={styles.headerTitle}>Share Chat</Text>
            <View style={[styles.modeBadge, { backgroundColor: getModeColor(mode) }]}>
              <Text style={styles.modeBadgeText}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {}
          {preview && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons 
                  name={getShareIcon(preview.type) as any} 
                  size={16} 
                  color="#666" 
                />
                <Text style={styles.previewTitle}>
                  {getShareTypeLabel(preview.type)} Preview
                </Text>
              </View>
              <View style={styles.previewContent}>
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Title</Text>
                  <Text style={styles.previewValue}>{preview.title}</Text>
                </View>
                <View style={styles.previewItem}>
                  <Text style={styles.previewLabel}>Description</Text>
                  <Text style={styles.previewValue}>{preview.description}</Text>
                </View>
                {preview.changes && preview.changes.length > 0 && (
                  <View style={styles.previewItem}>
                    <Text style={styles.previewLabel}>Changes</Text>
                    <ScrollView style={styles.changesList} nestedScrollEnabled>
                      {preview.changes.map((change, idx) => (
                        <Text key={idx} style={styles.changeItem}>
                          {change}
                        </Text>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>
          )}
          {}
          <View style={styles.configSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Title (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={shareTitle}
                onChangeText={setShareTitle}
                placeholder={preview?.title}
                placeholderTextColor="#999"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={shareDescription}
                onChangeText={setShareDescription}
                placeholder={preview?.description}
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>
            {}
            {(mode === 'code' || mode === 'fullstack') && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Repository</Text>
                  <TextInput
                    style={styles.textInput}
                    value={selectedRepo}
                    onChangeText={setSelectedRepo}
                    placeholder="owner/repo"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Branch</Text>
                  <TextInput
                    style={styles.textInput}
                    value={selectedBranch}
                    onChangeText={setSelectedBranch}
                    placeholder="main"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                  />
                </View>
              </>
            )}
          </View>
          {}
          {error && (
            <View style={styles.errorCard}>
              <View style={styles.errorContent}>
                <Ionicons name="alert-circle" size={16} color="#dc2626" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </View>
          )}
          {}
          {shareResult && (
            <View style={styles.successCard}>
              <View style={styles.successHeader}>
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text style={styles.successTitle}>Share Successful!</Text>
              </View>
              <View style={styles.successContent}>
                <Text style={styles.urlLabel}>Share URL</Text>
                <View style={styles.urlContainer}>
                  <TextInput
                    style={styles.urlInput}
                    value={shareResult.url}
                    readOnly
                    multiline
                  />
                  <View style={styles.urlActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => copyToClipboard(shareResult.url)}
                    >
                      <Ionicons 
                        name={copied ? "checkmark-circle" : "copy"} 
                        size={16} 
                        color="#666" 
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openLink(shareResult.url)}
                    >
                      <Ionicons name="open-outline" size={16} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
        {}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.footerButton, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>
              {shareResult ? 'Close' : 'Cancel'}
            </Text>
          </TouchableOpacity>
          {!shareResult && (
            <TouchableOpacity
              style={[styles.footerButton, styles.shareButton, isSharing && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={isSharing}
            >
              {isSharing ? (
                <View style={styles.loadingContent}>
                  <Text style={styles.shareButtonText}>Sharing...</Text>
                </View>
              ) : (
                <View style={styles.shareContent}>
                  <Ionicons name="share-outline" size={16} color="white" />
                  <Text style={styles.shareButtonText}>Share</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
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
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  previewCard: {
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
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
  },
  previewContent: {
    gap: 12,
  },
  previewItem: {
    gap: 4,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  previewValue: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  changesList: {
    maxHeight: 80,
  },
  changeItem: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  configSection: {
    gap: 16,
    marginBottom: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2937',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  errorCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    marginLeft: 8,
    flex: 1,
  },
  successCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16a34a',
    marginLeft: 8,
  },
  successContent: {
    gap: 8,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  urlContainer: {
    gap: 8,
  },
  urlInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#6b7280',
  },
  urlActions: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'flex-start',
  },
  actionButton: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    padding: 8,
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
  shareButton: {
    backgroundColor: '#3b82f6',
  },
  shareButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
  shareContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});