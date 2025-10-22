import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMemory } from '../types';
import { chatMemoryService } from '../services/chatMemoryService';

interface Props {
  visible: boolean;
  onClose: () => void;
  chat: ChatMemory | null;
}

export const ChatDetailsModal: React.FC<Props> = ({ visible, onClose, chat }) => {
  const [showFullSummary, setShowFullSummary] = useState(false);

  if (!chat) return null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExportChat = async () => {
    try {
      const exportData = await chatMemoryService.exportChat(chat.id);
      // In a real app, you would share this data or save it to a file
      Alert.alert('Export Complete', 'Chat data has been prepared for export');
    } catch (error) {
      Alert.alert('Export Failed', 'Failed to export chat data');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Chat Details</Text>
          <TouchableOpacity onPress={handleExportChat} style={styles.exportButton}>
            <Ionicons name="share-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chat Information</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Title:</Text>
              <Text style={styles.infoValue}>{chat.title}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Created:</Text>
              <Text style={styles.infoValue}>{formatDate(chat.createdAt)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Last Updated:</Text>
              <Text style={styles.infoValue}>{formatDate(chat.lastMessageAt)}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Messages:</Text>
              <Text style={styles.infoValue}>{chat.messages.length}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summaryText}>
              {showFullSummary ? chat.summary : chat.summary.slice(0, 200)}
              {chat.summary.length > 200 && !showFullSummary && '...'}
            </Text>
            {chat.summary.length > 200 && (
              <TouchableOpacity
                onPress={() => setShowFullSummary(!showFullSummary)}
                style={styles.showMoreButton}
              >
                <Text style={styles.showMoreText}>
                  {showFullSummary ? 'Show Less' : 'Show More'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {chat.tags.length > 0 ? (
                chat.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noTagsText}>No tags available</Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Terms</Text>
            <View style={styles.termsContainer}>
              {chat.keyTerms.length > 0 ? (
                chat.keyTerms.map((term, index) => (
                  <View key={index} style={styles.term}>
                    <Text style={styles.termText}>{term}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noTermsText}>No key terms available</Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message Breakdown</Text>
            <View style={styles.messageStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {chat.messages.filter(m => m.role === 'user').length}
                </Text>
                <Text style={styles.statLabel}>User Messages</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {chat.messages.filter(m => m.role === 'assistant').length}
                </Text>
                <Text style={styles.statLabel}>Assistant Messages</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {chat.messages.filter(m => m.role === 'system').length}
                </Text>
                <Text style={styles.statLabel}>System Messages</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Models Used</Text>
            <View style={styles.modelsContainer}>
              {Array.from(new Set(chat.messages.map(m => m.model).filter(Boolean))).map((model, index) => (
                <View key={index} style={styles.model}>
                  <Text style={styles.modelText}>{model}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  exportButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  summaryText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  showMoreButton: {
    marginTop: 8,
  },
  showMoreText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  noTagsText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  termsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  term: {
    backgroundColor: '#f3e5f5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  termText: {
    fontSize: 12,
    color: '#7b1fa2',
    fontWeight: '500',
  },
  noTermsText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  messageStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  modelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  model: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  modelText: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '500',
  },
});