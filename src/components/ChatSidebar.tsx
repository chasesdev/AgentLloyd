import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChatMemory } from '../types';
import { chatMemoryService } from '../services/chatMemoryService';
import { SettingsModal } from './SettingsModal';
import { IntegrationsModal } from './IntegrationsModal';
interface Props {
  visible: boolean;
  onClose: () => void;
  onChatSelect: (chatId: string) => void;
  currentChatId: string | null;
}
interface ChatItemProps {
  chat: ChatMemory;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}
const ChatItem: React.FC<ChatItemProps> = ({ 
  chat, 
  isActive, 
  onSelect, 
  onRename, 
  onDelete 
}) => {
  const [showActions, setShowActions] = useState(false);
  return (
    <View style={[styles.chatItem, isActive && styles.activeChatItem]}>
      <TouchableOpacity 
        style={styles.chatContent}
        onPress={() => {
          onSelect();
          setShowActions(false);
        }}
        onLongPress={() => setShowActions(!showActions)}
      >
        <View style={styles.chatHeader}>
          <Text style={[styles.chatTitle, isActive && styles.activeChatTitle]} numberOfLines={1}>
            {chat.title}
          </Text>
          <Text style={styles.chatTime}>
            {chat.lastMessageAt.toLocaleDateString()}
          </Text>
        </View>
        <Text style={styles.chatSummary} numberOfLines={2}>
          {chat.summary || 'No summary available'}
        </Text>
        <View style={styles.chatFooter}>
          <View style={styles.tagsContainer}>
            {chat.tags.slice(0, 3).map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {chat.tags.length > 3 && (
              <Text style={styles.moreTagsText}>+{chat.tags.length - 3}</Text>
            )}
          </View>
          <Text style={styles.messageCount}>
            {chat.messages.length} messages
          </Text>
        </View>
      </TouchableOpacity>
      {showActions && (
        <View style={styles.chatActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              onRename();
              setShowActions(false);
            }}
          >
            <Ionicons name="pencil" size={16} color="#666" />
            <Text style={styles.actionText}>Rename</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => {
              onDelete();
              setShowActions(false);
            }}
          >
            <Ionicons name="trash" size={16} color="#FF6B6B" />
            <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};
export const ChatSidebar: React.FC<Props> = ({ 
  visible, 
  onClose, 
  onChatSelect, 
  currentChatId 
}) => {
  const [chats, setChats] = useState<ChatMemory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [selectedChat, setSelectedChat] = useState<ChatMemory | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showIntegrationsModal, setShowIntegrationsModal] = useState(false);
  useEffect(() => {
    if (visible) {
      loadChats();
    }
  }, [visible]);
  const loadChats = async () => {
    try {
      setIsLoading(true);
      const allChats = await chatMemoryService.getAllChats();
      setChats(allChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setIsLoading(false);
    }
  };
  const handleNewChat = async () => {
    try {
      const chatId = await chatMemoryService.createNewChat('New Chat');
      onChatSelect(chatId);
      onClose();
      setTimeout(loadChats, 100);
    } catch (error) {
      Alert.alert('Error', 'Failed to create new chat');
    }
  };
  const handleRenameChat = async (chat: ChatMemory) => {
    setSelectedChat(chat);
    setNewTitle(chat.title);
    setShowRenameModal(true);
  };
  const confirmRenameChat = async () => {
    if (!selectedChat || !newTitle.trim()) return;
    try {
      await chatMemoryService.renameChat(selectedChat.id, newTitle.trim());
      setShowRenameModal(false);
      loadChats(); 
    } catch (error) {
      Alert.alert('Error', 'Failed to rename chat');
    }
  };
  const handleDeleteChat = (chat: ChatMemory) => {
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${chat.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatMemoryService.deleteChat(chat.id);
              loadChats(); 
              if (chat.id === currentChatId) {
                handleNewChat();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete chat');
            }
          },
        },
      ]
    );
  };
  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    chat.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const renderChatItem = ({ item }: { item: ChatMemory }) => (
    <ChatItem
      chat={item}
      isActive={item.id === currentChatId}
      onSelect={() => {
        onChatSelect(item.id);
        onClose();
      }}
      onRename={() => handleRenameChat(item)}
      onDelete={() => handleDeleteChat(item)}
    />
  );
  return (
    <>
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
            <Text style={styles.title}>Chat History</Text>
            <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
              <Ionicons name="add" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search chats..."
                placeholderTextColor="#999"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
          <View style={styles.content}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading chats...</Text>
              </View>
            ) : filteredChats.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubble-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No chats found' : 'No chats yet'}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity 
                    style={styles.startChatButton}
                    onPress={handleNewChat}
                  >
                    <Text style={styles.startChatButtonText}>Start New Chat</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <FlatList
                data={filteredChats}
                renderItem={renderChatItem}
                keyExtractor={item => item.id}
                style={styles.chatList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
          <View style={styles.bottomNav}>
            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => {
                setShowIntegrationsModal(true);
              }}
            >
              <Ionicons name="extension-puzzle-outline" size={20} color="#666" />
              <Text style={styles.navButtonText}>Integrations</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.navButton}
              onPress={() => {
                setShowSettingsModal(true);
              }}
            >
              <Ionicons name="settings-outline" size={20} color="#666" />
              <Text style={styles.navButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      <IntegrationsModal
        isOpen={showIntegrationsModal}
        onClose={() => setShowIntegrationsModal(false)}
      />
      <Modal
        visible={showRenameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRenameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.renameModal}>
            <Text style={styles.modalTitle}>Rename Chat</Text>
            <TextInput
              style={styles.renameInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Enter new title"
              placeholderTextColor="#999"
              autoFocus
              maxLength={50}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowRenameModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={confirmRenameChat}
              >
                <Text style={styles.confirmButtonText}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  newChatButton: {
    padding: 8,
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
  },
  startChatButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  activeChatItem: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  chatContent: {
    padding: 16,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  activeChatTitle: {
    color: '#007AFF',
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
  },
  chatSummary: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
    marginBottom: 12,
  },
  chatFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 2,
  },
  tagText: {
    fontSize: 10,
    color: '#1976d2',
  },
  moreTagsText: {
    fontSize: 10,
    color: '#999',
    marginRight: 4,
  },
  messageCount: {
    fontSize: 12,
    color: '#999',
  },
  chatActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  deleteButton: {
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
  },
  actionText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  deleteText: {
    color: '#FF6B6B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  renameInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  navButtonText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
});