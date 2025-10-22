import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatBio } from '../types';
import { chatMemoryService } from '../services/chatMemoryService';
interface Props {
  visible: boolean;
  onClose: () => void;
}
export const BioModal: React.FC<Props> = ({ visible, onClose }) => {
  const [bioName, setBioName] = useState('');
  const [bioContent, setBioContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentBio, setCurrentBio] = useState<ChatBio | null>(null);
  useEffect(() => {
    if (visible) {
      loadBio();
    }
  }, [visible]);
  const loadBio = async () => {
    try {
      const bio = await chatMemoryService.getBio();
      if (bio) {
        setCurrentBio(bio);
        setBioName(bio.name);
        setBioContent(bio.content);
      } else {
        setBioName('Default Bio');
        setBioContent(`I am a helpful AI assistant. I can help with various tasks including:
• Answering questions and providing information
• Helping with coding and technical problems
• Analyzing images and documents
• Creative writing and brainstorming
• Research and web searches
• General conversation and advice
I strive to be helpful, accurate, and thoughtful in my responses.`);
      }
    } catch (error) {
      console.error('Failed to load bio:', error);
    }
  };
  const handleSaveBio = async () => {
    if (!bioName.trim() || !bioContent.trim()) {
      Alert.alert('Error', 'Please fill in both name and content fields');
      return;
    }
    setIsLoading(true);
    try {
      await chatMemoryService.saveBio(bioName.trim(), bioContent.trim());
      Alert.alert('Success', 'Bio saved successfully!');
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to save bio. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleResetBio = () => {
    Alert.alert(
      'Reset Bio',
      'Are you sure you want to reset to default bio?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setBioName('Default Bio');
            setBioContent(`I am a helpful AI assistant. I can help with various tasks including:
• Answering questions and providing information
• Helping with coding and technical problems
• Analyzing images and documents
• Creative writing and brainstorming
• Research and web searches
• General conversation and advice
I strive to be helpful, accurate, and thoughtful in my responses.`);
          },
        },
      ]
    );
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
          <Text style={styles.title}>Chat Bio & Context</Text>
          <TouchableOpacity onPress={handleResetBio} style={styles.resetButton}>
            <Ionicons name="refresh" size={20} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Bio</Text>
            <Text style={styles.sectionDescription}>
              The bio provides context about you or the AI assistant that helps guide conversations. 
              This information will be referenced to maintain consistency and provide personalized responses.
            </Text>
          </View>
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Bio Name</Text>
              <TextInput
                style={styles.textInput}
                value={bioName}
                onChangeText={setBioName}
                placeholder="Enter a name for this bio"
                placeholderTextColor="#999"
                multiline
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Bio Content</Text>
              <TextInput
                style={[styles.textInput, styles.contentInput]}
                value={bioContent}
                onChangeText={setBioContent}
                placeholder="Describe the AI assistant's personality, capabilities, and context..."
                placeholderTextColor="#999"
                multiline
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>
                {bioContent.length} characters
              </Text>
            </View>
            <View style={styles.tipsSection}>
              <Text style={styles.tipsTitle}>💡 Tips for effective bio:</Text>
              <Text style={styles.tip}>• Define the AI's personality and communication style</Text>
              <Text style={styles.tip}>• Mention specific areas of expertise</Text>
              <Text style={styles.tip}>• Include any preferences or constraints</Text>
              <Text style={styles.tip}>• Keep it concise but comprehensive</Text>
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSaveBio}
            disabled={isLoading}
          >
            <Text style={styles.saveButtonText}>
              {isLoading ? 'Saving...' : 'Save Bio'}
            </Text>
          </TouchableOpacity>
        </View>
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
  resetButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  form: {
    flex: 1,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  contentInput: {
    height: 200,
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  tipsSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  tip: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});