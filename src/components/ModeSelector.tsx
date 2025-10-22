import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMode, CHAT_MODES } from '../types/modes';
interface Props {
  visible: boolean;
  selectedMode: ChatMode;
  onModeSelect: (mode: ChatMode) => void;
  onClose: () => void;
}
export const ModeSelector: React.FC<Props> = ({
  visible,
  selectedMode,
  onModeSelect,
  onClose,
}) => {
  const renderMode = (mode: ChatMode) => (
    <TouchableOpacity
      key={mode.id}
      style={[
        styles.modeItem,
        selectedMode.id === mode.id && styles.selectedModeItem,
      ]}
      onPress={() => {
        onModeSelect(mode);
        onClose();
      }}
    >
      <View style={styles.modeHeader}>
        <View style={styles.modeInfo}>
          <View style={styles.modeIconContainer}>
            <Ionicons
              name={mode.icon as any}
              size={24}
              color={selectedMode.id === mode.id ? '#007AFF' : '#666'}
            />
          </View>
          <View style={styles.modeTextContainer}>
            <Text style={[
              styles.modeName,
              selectedMode.id === mode.id && styles.selectedModeName
            ]}>
              {mode.name}
            </Text>
            <Text style={styles.modeDescription}>
              {mode.description}
            </Text>
          </View>
        </View>
        {selectedMode.id === mode.id && (
          <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
        )}
      </View>
      <View style={styles.featuresContainer}>
        {mode.features.map((feature, index) => (
          <View key={index} style={styles.featureTag}>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>
      <View style={styles.recommendedContainer}>
        <Ionicons name="star" size={14} color="#FF9500" />
        <Text style={styles.recommendedText}>
          Recommended: {mode.recommendedModel}
        </Text>
      </View>
    </TouchableOpacity>
  );
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
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Select Mode</Text>
          <View style={styles.placeholder} />
        </View>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionTitle}>
              Choose Your AI Assistant Mode
            </Text>
            <Text style={styles.descriptionText}>
              Each mode is optimized for specific tasks with custom prompts and capabilities.
            </Text>
          </View>
          {CHAT_MODES.map(renderMode)}
        </ScrollView>
      </View>
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
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  descriptionSection: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  modeItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedModeItem: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modeTextContainer: {
    flex: 1,
  },
  modeName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  selectedModeName: {
    color: '#007AFF',
  },
  modeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  featureTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  recommendedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  recommendedText: {
    fontSize: 12,
    color: '#f57c00',
    marginLeft: 4,
    fontWeight: '500',
  },
});