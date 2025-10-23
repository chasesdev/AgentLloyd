export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string | MessageContent[];
  timestamp: Date;
  thinking?: string;
  model?: string;
  chatId?: string;
}
export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}
export interface ChatBio {
  id: string;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface ChatMemory {
  id: string;
  title: string;
  messages: Message[];
  tags: string[];
  summary: string;
  keyTerms: string[];
  embedding?: number[];  // Vector embedding for semantic search
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}
export interface SemanticMatch {
  memoryId: string;
  score: number;
  matchedTerms: string[];
  summary: string;
}
export interface ContextInjection {
  originalMessage: string;
  injectedContext: string[];
  relevantMemories: SemanticMatch[];
}
export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  apiKey: string | null;
  selectedModel: string;
  thinkingEnabled: boolean;
  currentChatId: string | null;
  bio: ChatBio | null;
  memories: ChatMemory[];
  isLoadingMemories: boolean;
  sidebarOpen: boolean;
}
export interface ZAIModel {
  id: string;
  name: string;
  description: string;
  supportsMultimodal: boolean;
  supportsThinking: boolean;
  maxTokens: number;
}
export interface APIConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  thinking: {
    type: 'enabled' | 'disabled';
  };
  stream: boolean;
}