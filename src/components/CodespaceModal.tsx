import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Codespace, codespaceService } from '../services/codespaceService';
interface CodespaceModalProps {
  visible: boolean;
  onClose: () => void;
  currentProject?: string;
  onCodespaceCreated: (codespace: Codespace) => void;
}
export const CodespaceModal: React.FC<CodespaceModalProps> = ({
  visible,
  onClose,
  currentProject,
  onCodespaceCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'current' | 'create' | 'existing'>('current');
  const [currentCodespace, setCurrentCodespace] = useState<Codespace | null>(null);
  const [existingCodespaces, setExistingCodespaces] = useState<Codespace[]>([]);
  const [loading, setLoading] = useState(false);
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('main');
  const [displayName, setDisplayName] = useState('');
  const [hasCodespacesAccess, setHasCodespacesAccess] = useState<boolean | null>(null);
  useEffect(() => {
    if (visible) {
      loadCodespaces();
      checkCodespacesAccess();
      if (currentProject) {
        const repo = codespaceService.extractRepositoryFromMessage(currentProject);
        if (repo) {
          setRepository(repo);
        } else {
          setDisplayName(currentProject);
        }
      }
    }
  }, [visible, currentProject]);
  const checkCodespacesAccess = async () => {
    try {
      const access = await codespaceService.hasCodespacesAccess();
      setHasCodespacesAccess(access);
    } catch (error) {
      setHasCodespacesAccess(false);
    }
  };
  const loadCodespaces = async () => {
    setLoading(true);
    try {
      const current = await codespaceService.getCurrentCodespace();
      setCurrentCodespace(current);
      const existing = await codespaceService.getCodespaces();
      setExistingCodespaces(existing.filter(cs => cs.id !== current?.id));
    } catch (error) {
      console.error('Failed to load codespaces:', error);
    } finally {
      setLoading(false);
    }
  };
  const handleCreateCodespace = async () => {
    if (!repository.trim()) {
      Alert.alert('Error', 'Please enter a repository (owner/repo)');
      return;
    }
    setLoading(true);
    try {
      const options = {
        repository: repository.trim(),
        branch: branch.trim() || undefined,
        display_name: displayName.trim() || undefined,
      };
      const newCodespace = await codespaceService.createCodespace(options);
      if (newCodespace) {
        await codespaceService.setCurrentCodespace(newCodespace);
        onCodespaceCreated(newCodespace);
        Alert.alert('Success', 'Codespace created successfully!');
        onClose();
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create codespace');
    } finally {
      setLoading(false);
    }
  };
  const handleStartCodespace = async (codespace: Codespace) => {
    setLoading(true);
    try {
      const started = await codespaceService.startCodespace(codespace.id);
      if (started) {
        await codespaceService.setCurrentCodespace(started);
        setCurrentCodespace(started);
        setExistingCodespaces(prev => prev.filter(cs => cs.id !== started.id));
        Alert.alert('Success', 'Codespace started successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start codespace');
    } finally {
      setLoading(false);
    }
  };
  const handleStopCodespace = async (codespace: Codespace) => {
    Alert.alert(
      'Stop Codespace',
      'Are you sure you want to stop this codespace? Any unsaved work will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const success = await codespaceService.stopCodespace(codespace.id);
              if (success) {
                if (codespace.id === currentCodespace?.id) {
                  setCurrentCodespace(null);
                } else {
                  setExistingCodespaces(prev => prev.filter(cs => cs.id !== codespace.id));
                }
                Alert.alert('Success', 'Codespace stopped successfully!');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to stop codespace');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };
  const handleDeleteCodespace = async (codespace: Codespace) => {
    Alert.alert(
      'Delete Codespace',
      'Are you sure you want to delete this codespace? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const success = await codespaceService.deleteCodespace(codespace.id);
              if (success) {
                if (codespace.id === currentCodespace?.id) {
                  setCurrentCodespace(null);
                } else {
                  setExistingCodespaces(prev => prev.filter(cs => cs.id !== codespace.id));
                }
                Alert.alert('Success', 'Codespace deleted successfully!');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete codespace');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };
  const handleOpenCodespace = (codespace: Codespace) => {
    if (codespace.web_url) {
      Linking.openURL(codespace.web_url);
    }
  };
  const handleCreateRepository = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a project name');
      return;
    }
    setLoading(true);
    try {
      const fullName = await codespaceService.suggestRepositoryCreation(displayName.trim());
      setRepository(fullName);
      Alert.alert('Success', `Repository ${fullName} created successfully!`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create repository');
    } finally {
      setLoading(false);
    }
  };
  const renderCodespaceItem = (codespace: Codespace, isCurrent: boolean = false) => (
    <View key={codespace.id} style={[styles.codespaceItem, isCurrent && styles.currentCodespaceItem]}>
      <View style={styles.codespaceInfo}>
        <Text style={styles.codespaceName}>
          {codespace.display_name || codespace.name}
          {isCurrent && <Text style={styles.currentBadge}> • Current</Text>}
        </Text>
        <Text style={styles.codespaceRepo}>{codespace.repository.full_name}</Text>
        <Text style={styles.codespaceStatus}>
          {codespaceService.formatCodespaceStatus(codespace)}
        </Text>
        <Text style={styles.codespaceMachine}>
          Machine: {codespace.machine.display_name}
        </Text>
      </View>
      <View style={styles.codespaceActions}>
        {codespace.state === 'available' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleOpenCodespace(codespace)}
          >
            <Ionicons name="open-outline" size={20} color="#007AFF" />
          </TouchableOpacity>
        )}
        {codespace.state === 'shutdown' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleStartCodespace(codespace)}
          >
            <Ionicons name="play-outline" size={20} color="#34C759" />
          </TouchableOpacity>
        )}
        {codespace.state === 'available' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleStopCodespace(codespace)}
          >
            <Ionicons name="stop-outline" size={20} color="#FF9500" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteCodespace(codespace)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );
  if (hasCodespacesAccess === false) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
            <Text style={styles.title}>GitHub Codespaces</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.noAccessContainer}>
            <Ionicons name="alert-circle-outline" size={64} color="#FF9500" />
            <Text style={styles.noAccessTitle}>Codespaces Not Available</Text>
            <Text style={styles.noAccessText}>
              GitHub Codespaces are not available for your account. This feature requires a GitHub Pro, Team, or Enterprise account, or you may need to enable Codespaces in your organization settings.
            </Text>
            <TouchableOpacity
              style={styles.learnMoreButton}
              onPress={() => Linking.openURL('https://github.com/features/codespaces')}
            >
              <Text style={styles.learnMoreButtonText}>Learn More</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
          <Text style={styles.title}>GitHub Codespaces</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'current' && styles.activeTab]}
            onPress={() => setActiveTab('current')}
          >
            <Text style={[styles.tabText, activeTab === 'current' && styles.activeTabText]}>
              Current
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'create' && styles.activeTab]}
            onPress={() => setActiveTab('create')}
          >
            <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>
              Create
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'existing' && styles.activeTab]}
            onPress={() => setActiveTab('existing')}
          >
            <Text style={[styles.tabText, activeTab === 'existing' && styles.activeTabText]}>
              Existing
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          )}
          {!loading && (
            <>
              {activeTab === 'current' && (
                <View>
                  {currentCodespace ? (
                    renderCodespaceItem(currentCodespace, true)
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="cube-outline" size={64} color="#CCC" />
                      <Text style={styles.emptyText}>No active codespace</Text>
                      <Text style={styles.emptySubtext}>
                        Create a new codespace or select an existing one to get started
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {activeTab === 'create' && (
                <View style={styles.createContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Repository *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={repository}
                      onChangeText={setRepository}
                      placeholder="owner/repo"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Branch</Text>
                    <TextInput
                      style={styles.textInput}
                      value={branch}
                      onChangeText={setBranch}
                      placeholder="main"
                      placeholderTextColor="#999"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Display Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={displayName}
                      onChangeText={setDisplayName}
                      placeholder="My Project Codespace"
                      placeholderTextColor="#999"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.createRepoButton}
                    onPress={handleCreateRepository}
                  >
                    <Ionicons name="add-outline" size={20} color="#007AFF" />
                    <Text style={styles.createRepoButtonText}>Create New Repository</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.createButton]}
                    onPress={handleCreateCodespace}
                    disabled={loading}
                  >
                    <Text style={styles.createButtonText}>Create Codespace</Text>
                  </TouchableOpacity>
                </View>
              )}
              {activeTab === 'existing' && (
                <View>
                  {existingCodespaces.length > 0 ? (
                    existingCodespaces.map(codespace => renderCodespaceItem(codespace))
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="folder-open-outline" size={64} color="#CCC" />
                      <Text style={styles.emptyText}>No other codespaces</Text>
                      <Text style={styles.emptySubtext}>
                        Your existing codespaces will appear here
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  codespaceItem: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  currentCodespaceItem: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  codespaceInfo: {
    marginBottom: 12,
  },
  codespaceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  currentBadge: {
    color: '#007AFF',
    fontWeight: '600',
  },
  codespaceRepo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  codespaceStatus: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  codespaceMachine: {
    fontSize: 12,
    color: '#999',
  },
  codespaceActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  createContainer: {
    paddingVertical: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  createRepoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginBottom: 20,
  },
  createRepoButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  noAccessTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  noAccessText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  learnMoreButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  learnMoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});