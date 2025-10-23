import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Message, MessageContent, ZAIModel, ChatMemory } from '../types';
import { ChatMode, CHAT_MODES, ReasoningProcess } from '../types/modes';
import { aiRouter } from '../services/aiRouter';
import { ToolsModal } from '../components/ToolsModal';
import { ChatSidebar } from '../components/ChatSidebar';
import { BioModal } from '../components/BioModal';
import { ChatDetailsModal } from '../components/ChatDetailsModal';
import { ModeSelector } from '../components/ModeSelector';
import { ReasoningDisplay } from '../components/ReasoningDisplay';
import { TokenUsageCounter } from '../components/TokenUsageCounter';
import { GitHubAuthModal } from '../components/GitHubAuthModal';
import { CodespaceStatus } from '../components/CodespaceStatus';
import { CodespaceModal } from '../components/CodespaceModal';
import { LoadingSpinner, LoadingOverlay, ProgressBar, StepProgress, useLoadingState, useProgress } from '../components/LoadingStates';
import { toolService } from '../services/toolService';
import { chatMemoryService } from '../services/chatMemoryService';
import { tokenUsageService } from '../services/tokenUsageService';
import { githubService } from '../services/githubService';
import { githubCommandService } from '../services/githubCommandService';
import { codespaceService } from '../services/codespaceService';
import { validationService } from '../services/validationService';
import { uuid } from '../utils/uuid';
const MODELS: ZAIModel[] = [
  {
    id: 'glm-4.6',
    name: 'GLM-4.6',
    description: 'Latest flagship model with superior reasoning',
    supportsMultimodal: false,
    supportsThinking: true,
    maxTokens: 128000,
  },
  {
    id: 'glm-4.5v',
    name: 'GLM-4.5V',
    description: 'Visual reasoning model for images and videos',
    supportsMultimodal: true,
    supportsThinking: true,
    maxTokens: 16000,
  },
  {
    id: 'glm-4.5-air',
    name: 'GLM-4.5-Air',
    description: 'Efficient model for everyday tasks',
    supportsMultimodal: false,
    supportsThinking: false,
    maxTokens: 8192,
  },
];
interface Props {
  onLogout: () => void;
}
export const ChatScreen: React.FC<Props> = ({ onLogout }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [selectedMode, setSelectedMode] = useState(CHAT_MODES[0]);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [toolsEnabled, setToolsEnabled] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [showChatDetailsModal, setShowChatDetailsModal] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState('New Chat');
  const [injectedContext, setInjectedContext] = useState<string[]>([]);
  const [currentReasoning, setCurrentReasoning] = useState<ReasoningProcess | null>(null);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showGitHubAuth, setShowGitHubAuth] = useState(false);
  const [detectedGitHubCommands, setDetectedGitHubCommands] = useState<string[]>([]);
  const [showCodespaceModal, setShowCodespaceModal] = useState(false);
  const [aiBackend, setAIBackend] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);
  const loadingStates = useLoadingState();
  const progress = useProgress();
  useEffect(() => {
    initializeChat();
    githubService.loadStoredToken();
  }, []);
  const initializeChat = async () => {
    loadingStates.setLoading('initialization', true);
    try {
      progress.setProgress('initialization', 0.2);
      await aiRouter.initialize();
      setAIBackend(aiRouter.backendDisplayName);
      progress.setProgress('initialization', 0.4);
      await chatMemoryService.init();
      progress.setProgress('initialization', 0.7);
      startNewChat();
      progress.setProgress('initialization', 1.0);
    } catch (error) {
      console.error('Failed to initialize chat:', error);
      addWelcomeMessage();
    } finally {
      loadingStates.setLoading('initialization', false);
    }
  };
  const addWelcomeMessage = () => {
    const welcomeMessage: Message = {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm ${selectedModel.name}, your AI assistant. I'm currently in **${selectedMode.name}** mode.
${selectedMode.description}
I can help you with: ${selectedMode.features.join(', ')}.
${selectedModel.supportsMultimodal ? 'I can also analyze images and documents!' : ''}
How can I help you today?`,
      timestamp: new Date(),
      model: selectedModel.id,
    };
    setMessages([welcomeMessage]);
  };
  const startNewChat = async () => {
    setMessages([]);
    setCurrentChatId(null);
    setChatTitle('New Chat');
    setInjectedContext([]);
    tokenUsageService.resetCurrentChat(); 
    addWelcomeMessage();
  };
  const loadChat = async (chatId: string) => {
    try {
      const memory = await chatMemoryService.loadChat(chatId);
      if (memory) {
        setMessages(memory.messages);
        setCurrentChatId(chatId);
        setChatTitle(memory.title);
        setInjectedContext([]);
        tokenUsageService.resetCurrentChat(); 
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
      Alert.alert('Error', 'Failed to load chat');
    }
  };
  const handleSendMessage = async () => {
    if (!inputText.trim()) {
      return;
    }
    const messageText = inputText.trim();
    const validation = validationService.validateAndSanitize(messageText, 'message');
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }
    if (validation.warnings.length > 0) {
      console.warn('Input validation warnings:', validation.warnings);
    }
    const sanitizedText = validation.sanitized || messageText.trim();
    loadingStates.setLoading('sending', true);
    progress.setProgress('sending', 0.1);
    const gitHubCommands = githubService.detectGitHubCommands(sanitizedText);
    if (gitHubCommands.length > 0) {
      if (!githubService.isAuthenticated()) {
        setDetectedGitHubCommands(gitHubCommands);
        setShowGitHubAuth(true);
        return;
      } else {
        try {
          const results = await Promise.all(
            gitHubCommands.map(cmd => githubCommandService.handleCommand(cmd))
          );
          const formattedResults = results.map(result =>
            githubCommandService.formatCommandResult(result)
          ).join('\n\n');
          const userMessage: Message = {
            id: uuid.v4(),
            role: 'user',
            content: messageText,
            timestamp: new Date(),
          };
          const gitHubResponse: Message = {
            id: uuid.v4(),
            role: 'assistant',
            content: formattedResults,
            timestamp: new Date(),
            model: selectedModel.id,
          };
          setMessages(prev => [...prev, userMessage, gitHubResponse]);
          setInputText('');
          return;
        } catch (error) {
          console.error('GitHub command handling failed:', error);
        }
      }
    }
    if (selectedMode.id === 'fullstack' && githubService.isAuthenticated()) {
      const repository = codespaceService.extractRepositoryFromMessage(sanitizedText);
      const currentCodespace = await codespaceService.getCurrentCodespace();
      if (repository && !currentCodespace) {
        const repoInfo = await githubService.getRepo(repository.split('/')[0], repository.split('/')[1]);
        if (repoInfo) {
          const userMessage: Message = {
            id: uuid.v4(),
            role: 'user',
            content: messageText,
            timestamp: new Date(),
          };
          const suggestionMessage: Message = {
            id: uuid.v4(),
            role: 'assistant',
            content: `I see you're working with the repository **${repository}**. Would you like me to create a GitHub Codespace for this project so you can start coding right away?
You can tap the Codespace status button in the header to create one, or just let me know and I'll set it up for you!`,
            timestamp: new Date(),
            model: selectedModel.id,
          };
          setMessages(prev => [...prev, userMessage, suggestionMessage]);
          setInputText('');
          return;
        }
      }
    }
    const userMessage: Message = {
      id: uuid.v4(),
      role: 'user',
      content: sanitizedText,
      timestamp: new Date(),
    };
    if (!currentChatId && messages.length <= 1) {
      const chatId = await chatMemoryService.createNewChat(sanitizedText);
      setCurrentChatId(chatId);
      setChatTitle(sanitizedText.slice(0, 30) + (sanitizedText.length > 30 ? '...' : ''));
    }
    const context = await chatMemoryService.findRelevantContext(sanitizedText);
    setInjectedContext(context);
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    try {
      let messagesToSend: Message[] = [];
      messagesToSend.push({
        id: 'mode',
        role: 'system',
        content: selectedMode.systemPrompt,
        timestamp: new Date(),
      });
      const bio = chatMemoryService.getBio();
      if (bio) {
        messagesToSend.push({
          id: 'bio',
          role: 'system',
          content: `User Bio: ${bio.content}`,
          timestamp: new Date(),
        });
      }
      if (context.length > 0) {
        messagesToSend.push({
          id: 'context',
          role: 'system',
          content: `Relevant context from previous conversations:\n${context.join('\n')}`,
          timestamp: new Date(),
        });
      }
      messagesToSend = [...messagesToSend, ...messages, userMessage];
      const assistantMessageId = uuid.v4();
      if (selectedMode.id === 'reasoning' && thinkingEnabled) {
        const reasoningProcess: ReasoningProcess = {
          id: uuid.v4(),
          messageId: assistantMessageId,
          steps: [],
          conclusion: '',
          timestamp: new Date(),
        };
        setCurrentReasoning(reasoningProcess);
        setShowReasoning(true);
      }
      let assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        model: selectedModel.id,
        chatId: currentChatId || undefined,
      };
      setMessages(prev => [...prev, assistantMessage]);
      const tools = toolsEnabled && selectedModel.id === 'glm-4.6' 
        ? toolService.getToolSchema() 
        : undefined;
      let response;
      if (selectedMode.id === 'reasoning' && thinkingEnabled) {
        response = await aiRouter.sendReasoningMessage(
          messagesToSend,
          selectedModel.id,
          (chunk) => {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: (msg.content as string) + chunk }
                  : msg
              )
            );
          },
          (reasoningChunk) => {
            if (currentReasoning) {
              setCurrentReasoning(prev => prev ? {
                ...prev,
                steps: prev.steps.length === 0 ? [{
                  id: 'realtime',
                  type: 'analysis',
                  title: 'Real-time Reasoning',
                  content: reasoningChunk,
                  timestamp: new Date(),
                }] : prev.steps.map(step =>
                  step.id === 'realtime'
                    ? { ...step, content: step.content + reasoningChunk }
                    : step
                )
              } : null);
            }
          },
          tools
        );
      } else {
        response = await aiRouter.sendMessage(
          messagesToSend,
          selectedModel.id,
          thinkingEnabled,
          (chunk) => {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: (msg.content as string) + chunk }
                  : msg
              )
            );
          },
          tools
        );
      }
      const finalAssistantMessage = {
        ...assistantMessage,
        content: response.content,
        thinking: response.thinking,
      };
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessage.id 
            ? finalAssistantMessage
            : msg
        )
      );
      if (selectedMode.id === 'reasoning' && (response.thinking || (response as any).reasoning) && currentReasoning) {
        const reasoningContent = (response as any).reasoning || response.thinking || '';
        const updatedReasoning: ReasoningProcess = {
          ...currentReasoning,
          steps: [
            {
              id: 'analysis',
              type: 'analysis',
              title: 'Problem Analysis',
              content: 'Analyzing the user\'s request and identifying key components...',
              timestamp: new Date(),
            },
            {
              id: 'planning',
              type: 'planning',
              title: 'Solution Planning',
              content: 'Planning the approach and structuring the response...',
              timestamp: new Date(),
            },
            {
              id: 'execution',
              type: 'execution',
              title: 'Response Generation',
              content: 'Generating the detailed response with reasoning...',
              timestamp: new Date(),
            },
            {
              id: 'detailed',
              type: 'analysis',
              title: 'Detailed Reasoning',
              content: reasoningContent,
              timestamp: new Date(),
            },
          ],
          conclusion: 'Response generated based on systematic reasoning and analysis.',
        };
        setCurrentReasoning(updatedReasoning);
      }
      if (currentChatId) {
        await chatMemoryService.saveMessage(userMessage);
        await chatMemoryService.saveMessage(finalAssistantMessage);
      }
    } catch (error) {
      console.error('Message sending failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert('Error', `Failed to send message: ${errorMessage}\n\nPlease try again.`);
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
      setInjectedContext([]);
      loadingStates.setLoading('sending', false);
      progress.setProgress('sending', 0);
    }
  };
  const handleImagePick = async () => {
    if (!selectedModel.supportsMultimodal) {
      Alert.alert('Model Limitation', 'This model does not support images. Please select GLM-4.5V for image analysis.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const imageContent: MessageContent[] = [
        { type: 'text', text: inputText || 'Please analyze this image.' },
        {
          type: 'image_url',
          image_url: { url: result.assets[0].uri }
        }
      ];
      const userMessage: Message = {
        id: uuid.v4(),
        role: 'user',
        content: imageContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setIsLoading(true);
      const imageAssistantMessageId = uuid.v4();
      try {
        let assistantMessage: Message = {
          id: imageAssistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          model: selectedModel.id,
        };
        setMessages(prev => [...prev, assistantMessage]);
        const response = await aiRouter.sendMessage(
          [...messages, userMessage],
          selectedModel.id,
          thinkingEnabled,
          (chunk) => {
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: (msg.content as string) + chunk }
                  : msg
              )
            );
          }
        );
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, content: response.content, thinking: response.thinking }
              : msg
          )
        );
      } catch (error) {
        console.error('Image analysis failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        Alert.alert('Error', `Failed to analyze image: ${errorMessage}\n\nPlease try again.`);
        setMessages(prev => prev.filter(msg => msg.id !== imageAssistantMessageId));
      } finally {
        setIsLoading(false);
      }
    }
  };
  const handleGitHubAuthSuccess = async () => {
    setShowGitHubAuth(false);
    setDetectedGitHubCommands([]);
    if (inputText.trim()) {
      await handleSendMessage();
    }
  };
  const handleGitHubAuthCancel = () => {
    setShowGitHubAuth(false);
    setDetectedGitHubCommands([]);
  };
  const handleCodespacePress = () => {
    setShowCodespaceModal(true);
  };
  const handleCodespaceCreated = (codespace: any) => {
    console.log('Codespace created:', codespace);
  };
  const handleCodespaceModalClose = () => {
    setShowCodespaceModal(false);
  };
  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessage : styles.assistantMessage]}>
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {Array.isArray(item.content) ? (
            <View>
              {item.content.map((content, index) => (
                <View key={index}>
                  {content.type === 'text' && (
                    <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
                      {content.text}
                    </Text>
                  )}
                  {content.type === 'image_url' && (
                    <Image source={{ uri: content.image_url?.url }} style={styles.messageImage} />
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
              {item.content}
            </Text>
          )}
          {item.thinking && (
            <View style={styles.thinkingContainer}>
              <Text style={styles.thinkingLabel}>Thinking:</Text>
              <Text style={styles.thinkingText}>{item.thinking}</Text>
            </View>
          )}
        </View>
        <Text style={styles.timestamp}>
          {item.timestamp.toLocaleTimeString()}
        </Text>
      </View>
    );
  };
  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowSidebar(true)} style={styles.headerButton}>
          <Ionicons name="menu-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.titleSection}>
          <Text style={styles.chatTitle}>{chatTitle}</Text>
          {aiBackend && (
            <Text style={styles.backendIndicator}>{aiBackend}</Text>
          )}
          <TokenUsageCounter model={selectedModel.id} />
        </View>
        <View style={styles.headerActions}>
          {selectedMode.id === 'fullstack' && (
            <CodespaceStatus
              isFullStackMode={selectedMode.id === 'fullstack'}
              onCodespacePress={handleCodespacePress}
            />
          )}
          <TouchableOpacity onPress={() => setShowModeSelector(true)} style={styles.modeButton}>
            <Ionicons name={selectedMode.icon as any} size={20} color="#007AFF" />
            <Text style={styles.modeText}>{selectedMode.name}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowBioModal(true)} style={styles.headerButton}>
            <Ionicons name="person-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowModelSelector(!showModelSelector)}
            style={styles.modelSelector}
          >
            <Text style={styles.modelText}>{selectedModel.name}</Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
      {showModelSelector && (
        <View style={styles.modelSelectorPanel}>
          {MODELS.map(model => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelOption,
                selectedModel.id === model.id && styles.selectedModelOption
              ]}
              onPress={() => {
                setSelectedModel(model);
                setShowModelSelector(false);
              }}
            >
              <View style={styles.modelInfo}>
                <Text style={styles.modelOptionName}>{model.name}</Text>
                <Text style={styles.modelOptionDescription}>{model.description}</Text>
              </View>
              {selectedModel.id === model.id && (
                <Ionicons name="checkmark" size={20} color="#007AFF" />
              )}
            </TouchableOpacity>
          ))}
          {selectedModel.supportsThinking && (
            <View style={styles.thinkingToggle}>
              <Text style={styles.thinkingToggleLabel}>Enable Thinking Mode</Text>
              <TouchableOpacity
                style={[styles.toggle, thinkingEnabled && styles.toggleEnabled]}
                onPress={() => setThinkingEnabled(!thinkingEnabled)}
              >
                <View style={[styles.toggleKnob, thinkingEnabled && styles.toggleKnobEnabled]} />
              </TouchableOpacity>
            </View>
          )}
          {selectedModel.id === 'glm-4.6' && (
            <View style={styles.toolsToggle}>
              <Text style={styles.toolsToggleLabel}>Enable Agent Tools</Text>
              <TouchableOpacity
                style={[styles.toggle, toolsEnabled && styles.toggleEnabled]}
                onPress={() => setToolsEnabled(!toolsEnabled)}
              >
                <View style={[styles.toggleKnob, toolsEnabled && styles.toggleKnobEnabled]} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      <ToolsModal 
        visible={showToolsModal}
        onClose={() => setShowToolsModal(false)}
      />
      <ChatSidebar
        visible={showSidebar}
        onClose={() => setShowSidebar(false)}
        onChatSelect={loadChat}
        currentChatId={currentChatId}
      />
      <BioModal
        visible={showBioModal}
        onClose={() => setShowBioModal(false)}
      />
      <ChatDetailsModal
        visible={showChatDetailsModal}
        onClose={() => setShowChatDetailsModal(false)}
        chat={currentChatId ? null : null} 
      />
      <ModeSelector
        visible={showModeSelector}
        selectedMode={selectedMode}
        onModeSelect={setSelectedMode}
        onClose={() => setShowModeSelector(false)}
      />
      {showReasoning && (
        <ReasoningDisplay
          reasoning={currentReasoning}
          isLoading={isLoading}
        />
      )}
      <GitHubAuthModal
        visible={showGitHubAuth}
        onClose={handleGitHubAuthCancel}
        onSuccess={handleGitHubAuthSuccess}
        detectedCommands={detectedGitHubCommands}
      />
      <CodespaceModal
        visible={showCodespaceModal}
        onClose={handleCodespaceModalClose}
        currentProject={inputText.trim()}
        onCodespaceCreated={handleCodespaceCreated}
      />
      {injectedContext.length > 0 && (
        <View style={styles.contextIndicator}>
          <Ionicons name="information-circle" size={16} color="#856404" />
          <Text style={styles.contextText}>
            Using context from previous conversations
          </Text>
        </View>
      )}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputContainer}>
        <View style={styles.inputRow}>
          {selectedModel.supportsMultimodal && (
            <TouchableOpacity onPress={handleImagePick} style={styles.attachButton}>
              <Ionicons name="image" size={24} color="#666" />
            </TouchableOpacity>
          )}
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={4000}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[styles.sendButton, isLoading && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={isLoading || !inputText.trim()}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      {}
      <LoadingOverlay 
        visible={loadingStates.isLoading('initialization')} 
        text="Initializing chat..." 
      />
      <LoadingOverlay 
        visible={loadingStates.isLoading('sending')} 
        text="Sending message..." 
      />
      {}
      {loadingStates.isLoading('initialization') && (
        <View style={styles.progressContainer}>
          <ProgressBar 
            progress={progress.getProgress('initialization')} 
            showPercentage={true}
            label="Initializing"
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  logoutButton: {
    padding: 8,
  },
  headerButton: {
    padding: 8,
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  modelSelectorPanel: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modelOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedModelOption: {
    backgroundColor: '#f0f8ff',
  },
  modelInfo: {
    flex: 1,
  },
  modelOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modelOptionDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  thinkingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  thinkingToggleLabel: {
    fontSize: 16,
    color: '#333',
  },
  toggle: {
    width: 48,
    height: 28,
    backgroundColor: '#ccc',
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleEnabled: {
    backgroundColor: '#007AFF',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  toggleKnobEnabled: {
    alignSelf: 'flex-end',
  },
  toolsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  toolsToggleLabel: {
    fontSize: 16,
    color: '#333',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  assistantMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  assistantText: {
    color: '#333',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 8,
  },
  thinkingContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  thinkingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  thinkingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginHorizontal: 16,
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f8f9fa',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  backendIndicator: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  titleSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
  },
  contextIndicator: {
    backgroundColor: '#fff3cd',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ffeaa7',
  },
  contextText: {
    fontSize: 14,
    color: '#856404',
    marginLeft: 8,
  },
});