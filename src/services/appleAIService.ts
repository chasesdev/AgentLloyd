import {
  LanguageModelSession,
  AvailabilityStatus,
} from 'react-native-apple-ai';
import { Message } from '../types';
import { tokenUsageService } from './tokenUsageService';

export class AppleAIService {
  private session: LanguageModelSession | null = null;
  private isAvailable: boolean = false;
  private availabilityStatus: AvailabilityStatus | null = null;

  constructor() {
    this.checkAvailability();
  }

  async checkAvailability(): Promise<boolean> {
    try {
      this.availabilityStatus = null;
      this.isAvailable = false;

      if (this.isAvailable) {
        console.log('Apple Intelligence is available');
      } else {
        console.log('Apple Intelligence is not available on this device');
      }

      return this.isAvailable;
    } catch (error) {
      console.error('Failed to check Apple Intelligence availability:', error);
      this.isAvailable = false;
      return false;
    }
  }

  get available(): boolean {
    return this.isAvailable;
  }

  get status(): AvailabilityStatus | null {
    return this.availabilityStatus;
  }

  private initializeSession(systemPrompt?: string): void {
    if (!this.isAvailable) {
      throw new Error('Apple Intelligence is not available on this device');
    }

    const config = {
      instructions: systemPrompt || 'You are a helpful AI assistant.',
    };

    this.session = new LanguageModelSession(config);
  }

  async sendMessage(
    messages: Message[],
    model?: string,
    thinkingEnabled?: boolean,
    onStream?: (chunk: string) => void,
    tools?: any[]
  ): Promise<{ content: string; thinking?: string }> {
    if (!this.isAvailable) {
      throw new Error('Apple Intelligence is not available on this device');
    }

    const systemMessage = messages.find(m => m.role === 'system');
    const systemPrompt = systemMessage ?
      (typeof systemMessage.content === 'string' ? systemMessage.content : '') :
      'You are a helpful AI assistant.';

    this.initializeSession(systemPrompt);

    if (!this.session) {
      throw new Error('Failed to initialize Apple Intelligence session');
    }

    const userMessages = messages.filter(m => m.role !== 'system');
    const conversationHistory = userMessages.map(m => {
      if (m.role === 'user') {
        return typeof m.content === 'string' ? m.content : '';
      } else if (m.role === 'assistant') {
        return `Assistant: ${typeof m.content === 'string' ? m.content : ''}`;
      }
      return '';
    }).filter(Boolean).join('\n\n');

    const lastMessage = userMessages[userMessages.length - 1];
    const userPrompt = typeof lastMessage?.content === 'string' ? lastMessage.content : '';

    const fullPrompt = conversationHistory ?
      `${conversationHistory}\n\nUser: ${userPrompt}` :
      userPrompt;

    try {
      if (onStream) {
        return await this.streamResponse(fullPrompt, onStream);
      } else {
        return await this.completeResponse(fullPrompt);
      }
    } catch (error) {
      console.error('Apple AI Error:', error);
      throw error;
    }
  }

  private async streamResponse(
    prompt: string,
    onStream: (chunk: string) => void
  ): Promise<{ content: string; thinking?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.session) {
        reject(new Error('Session not initialized'));
        return;
      }

      let fullResponse = '';
      let lastResponse = '';

      this.session.streamResponse(prompt, (currentResponse: string) => {
        const newChunk = currentResponse.slice(lastResponse.length);
        if (newChunk) {
          onStream(newChunk);
          lastResponse = currentResponse;
        }
        fullResponse = currentResponse;
      });

      setTimeout(() => {
        const inputTokens = tokenUsageService.estimateTokens(prompt);
        const outputTokens = tokenUsageService.estimateTokens(fullResponse);
        tokenUsageService.updateTokenUsage('apple-intelligence', inputTokens, outputTokens);

        resolve({ content: fullResponse });
      }, 100);
    });
  }

  private async completeResponse(prompt: string): Promise<{ content: string; thinking?: string }> {
    return new Promise((resolve, reject) => {
      if (!this.session) {
        reject(new Error('Session not initialized'));
        return;
      }

      let fullResponse = '';

      this.session.streamResponse(prompt, (currentResponse: string) => {
        fullResponse = currentResponse;
      });

      setTimeout(() => {
        const inputTokens = tokenUsageService.estimateTokens(prompt);
        const outputTokens = tokenUsageService.estimateTokens(fullResponse);
        tokenUsageService.updateTokenUsage('apple-intelligence', inputTokens, outputTokens);

        resolve({ content: fullResponse });
      }, 100);
    });
  }

  async sendReasoningMessage(
    messages: Message[],
    model?: string,
    onStream?: (chunk: string) => void,
    onReasoning?: (reasoning: string) => void,
    tools?: any[]
  ): Promise<{ content: string; thinking?: string; reasoning?: string }> {
    const result = await this.sendMessage(messages, model, true, onStream, tools);
    return {
      ...result,
      reasoning: result.thinking
    };
  }

  resetSession(): void {
    this.session = null;
  }

  getAvailabilityMessage(): string {
    if (this.isAvailable) {
      return 'Apple Intelligence is available';
    }

    switch (this.availabilityStatus as string) {
      case 'unavailableOSVersion':
        return 'Apple Intelligence requires iOS 18.1 or later';
      case 'unavailableHardware':
        return 'Apple Intelligence requires compatible hardware (iPhone 15 Pro or newer, M1+ iPad/Mac)';
      case 'unavailableDisabled':
        return 'Apple Intelligence is disabled. Enable it in Settings > Apple Intelligence & Siri';
      case 'unavailableRegion':
        return 'Apple Intelligence is not available in your region';
      case 'unavailableUnknown':
      default:
        return 'Apple Intelligence is not available on this device';
    }
  }
}

export const appleAIService = new AppleAIService();
