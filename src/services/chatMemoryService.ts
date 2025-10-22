import { ChatMemory, ChatBio, Message } from '../types';
import { chatDatabase } from './chatDatabase';
import { semanticAnalysisService } from './semanticAnalysisService';
import { uuid } from '../utils/uuid';
export class ChatMemoryService {
  private currentChatId: string | null = null;
  private currentBio: ChatBio | null = null;
  async init(): Promise<void> {
    await chatDatabase.init();
    await this.loadBio();
  }
  private async loadBio(): Promise<void> {
    this.currentBio = await chatDatabase.getBio();
  }
  async saveBio(name: string, content: string): Promise<void> {
    const bio: ChatBio = {
      id: this.currentBio?.id || uuid.v4(),
      name,
      content,
      createdAt: this.currentBio?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    await chatDatabase.saveBio(bio);
    this.currentBio = bio;
  }
  getBio(): ChatBio | null {
    return this.currentBio;
  }
  async createNewChat(firstMessage: string): Promise<string> {
    const chatId = uuid.v4();
    this.currentChatId = chatId;
    const title = await semanticAnalysisService.generateChatTitle(firstMessage);
    const memory: ChatMemory = {
      id: chatId,
      title,
      messages: [],
      tags: [],
      summary: '',
      keyTerms: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: new Date(),
    };
    await chatDatabase.saveMemory(memory);
    return chatId;
  }
  async loadChat(chatId: string): Promise<ChatMemory | null> {
    const memory = await chatDatabase.getMemory(chatId);
    if (memory) {
      this.currentChatId = chatId;
    }
    return memory;
  }
  getCurrentChatId(): string | null {
    return this.currentChatId;
  }
  async getAllChats(): Promise<ChatMemory[]> {
    return await chatDatabase.getAllMemories();
  }
  async deleteChat(chatId: string): Promise<void> {
    await chatDatabase.deleteMemory(chatId);
    if (this.currentChatId === chatId) {
      this.currentChatId = null;
    }
  }
  async renameChat(chatId: string, newTitle: string): Promise<void> {
    await chatDatabase.updateMemoryTitle(chatId, newTitle);
    if (this.currentChatId === chatId) {
      const memory = await chatDatabase.getMemory(chatId);
      if (memory) {
      }
    }
  }
  async saveMessage(message: Message): Promise<void> {
    await this.addMessage(message);
  }
  async addMessage(message: Message): Promise<void> {
    if (!this.currentChatId) {
      const content = typeof message.content === 'string' 
        ? message.content 
        : message.content.map(c => c.text || '').join(' ');
      await this.createNewChat(content);
    }
    message.chatId = this.currentChatId!;
    await chatDatabase.saveMessage(message);
    const allMessages = await chatDatabase.getMessages(this.currentChatId!);
    const shouldAnalyze = allMessages.length % 3 === 0 || 
                         message.role === 'user' || 
                         allMessages.length <= 5;
    if (shouldAnalyze && allMessages.length > 0) {
      await this.updateChatAnalysis(this.currentChatId!, allMessages);
    }
  }
  private async updateChatAnalysis(chatId: string, messages: Message[]): Promise<void> {
    try {
      const [summary, tags] = await Promise.all([
        semanticAnalysisService.generateSummary(messages),
        semanticAnalysisService.generateTags(messages),
      ]);
      const keyTerms = semanticAnalysisService.extractKeyTermsFromMessages(messages);
      const existingMemory = await chatDatabase.getMemory(chatId);
      if (!existingMemory) return;
      const updatedMemory: ChatMemory = {
        ...existingMemory,
        summary,
        tags,
        keyTerms,
        updatedAt: new Date(),
        lastMessageAt: new Date(),
        messages,
      };
      await chatDatabase.saveMemory(updatedMemory);
    } catch (error) {
      console.error('Failed to update chat analysis:', error);
    }
  }
  async findRelevantContext(currentMessage: string): Promise<string[]> {
    if (!this.currentChatId) return [];
    const allMemories = await this.getAllChats();
    const otherMemories = allMemories.filter(m => m.id !== this.currentChatId);
    if (otherMemories.length === 0) return [];
    const contextInjection = await semanticAnalysisService.createContextInjection(
      currentMessage,
      otherMemories
    );
    return contextInjection.injectedContext;
  }
  async searchChats(query: string): Promise<ChatMemory[]> {
    const terms = semanticAnalysisService.extractKeyTerms(query, 5);
    return await chatDatabase.searchMemoriesByTerms(terms);
  }
  async getChatStats(): Promise<{
    totalChats: number;
    totalMessages: number;
    mostUsedTags: string[];
  }> {
    const allChats = await this.getAllChats();
    const totalMessages = allChats.reduce((sum, chat) => sum + chat.messages.length, 0);
    const tagFreq: Map<string, number> = new Map();
    allChats.forEach(chat => {
      chat.tags.forEach(tag => {
        tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1);
      });
    });
    const mostUsedTags = Array.from(tagFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
    return {
      totalChats: allChats.length,
      totalMessages,
      mostUsedTags,
    };
  }
  async exportChat(chatId: string): Promise<string> {
    const memory = await chatDatabase.getMemory(chatId);
    if (!memory) throw new Error('Chat not found');
    return JSON.stringify(memory, null, 2);
  }
  async importChat(chatData: string): Promise<string> {
    try {
      const memory: ChatMemory = JSON.parse(chatData);
      const newId = uuid.v4();
      memory.id = newId;
      memory.createdAt = new Date();
      memory.updatedAt = new Date();
      memory.lastMessageAt = new Date();
      memory.messages.forEach(msg => {
        msg.chatId = newId;
      });
      await chatDatabase.saveMemory(memory);
      return newId;
    } catch (error) {
      throw new Error('Invalid chat data format');
    }
  }
}
export const chatMemoryService = new ChatMemoryService();