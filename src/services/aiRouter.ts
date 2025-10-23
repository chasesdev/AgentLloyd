import { Message } from '../types';
import { zaiService } from './zaiService';
import { appleAIService } from './appleAIService';
import { offlineService } from './offlineService';

export type AIBackend = 'zai' | 'apple-intelligence' | 'none';

export class AIRouter {
  private currentBackend: AIBackend = 'none';

  async initialize(): Promise<void> {
    await appleAIService.checkAvailability();
    this.determineBackend();
  }

  private determineBackend(): AIBackend {
    const hasApiKey = zaiService.hasApiKey;
    const isOnline = offlineService.getStatus().isOnline;
    const appleAIAvailable = appleAIService.available;

    if (hasApiKey && isOnline) {
      this.currentBackend = 'zai';
      return 'zai';
    }

    if (appleAIAvailable) {
      this.currentBackend = 'apple-intelligence';
      return 'apple-intelligence';
    }

    this.currentBackend = 'none';
    return 'none';
  }

  get activeBackend(): AIBackend {
    this.determineBackend();
    return this.currentBackend;
  }

  get backendDisplayName(): string {
    switch (this.currentBackend) {
      case 'zai':
        return 'Z.AI Cloud';
      case 'apple-intelligence':
        return 'Apple Intelligence (On-Device)';
      default:
        return 'No AI Available';
    }
  }

  get hasAIAvailable(): boolean {
    return this.activeBackend !== 'none';
  }

  async sendMessage(
    messages: Message[],
    model: string = 'glm-4.6',
    thinkingEnabled: boolean = true,
    onStream?: (chunk: string) => void,
    tools?: any[]
  ): Promise<{ content: string; thinking?: string }> {
    const backend = this.activeBackend;

    if (backend === 'none') {
      throw new Error(this.getUnavailabilityMessage());
    }

    try {
      if (backend === 'zai') {
        return await zaiService.sendMessage(messages, model, thinkingEnabled, onStream, tools);
      } else if (backend === 'apple-intelligence') {
        return await appleAIService.sendMessage(messages, model, thinkingEnabled, onStream, tools);
      } else {
        throw new Error('No AI backend available');
      }
    } catch (error) {
      console.error(`Error with ${backend} backend:`, error);

      if (backend === 'zai') {
        const appleAIAvailable = appleAIService.available;
        if (appleAIAvailable) {
          console.log('Falling back to Apple Intelligence...');
          this.currentBackend = 'apple-intelligence';
          return await appleAIService.sendMessage(messages, model, thinkingEnabled, onStream, tools);
        }
      }

      throw error;
    }
  }

  async sendReasoningMessage(
    messages: Message[],
    model: string = 'glm-4.6',
    onStream?: (chunk: string) => void,
    onReasoning?: (reasoning: string) => void,
    tools?: any[]
  ): Promise<{ content: string; thinking?: string; reasoning?: string }> {
    const backend = this.activeBackend;

    if (backend === 'none') {
      throw new Error(this.getUnavailabilityMessage());
    }

    try {
      if (backend === 'zai') {
        return await zaiService.sendReasoningMessage(messages, model, onStream, onReasoning, tools);
      } else if (backend === 'apple-intelligence') {
        return await appleAIService.sendReasoningMessage(messages, model, onStream, onReasoning, tools);
      } else {
        throw new Error('No AI backend available');
      }
    } catch (error) {
      console.error(`Error with ${backend} backend:`, error);

      if (backend === 'zai') {
        const appleAIAvailable = appleAIService.available;
        if (appleAIAvailable) {
          console.log('Falling back to Apple Intelligence...');
          this.currentBackend = 'apple-intelligence';
          return await appleAIService.sendReasoningMessage(messages, model, onStream, onReasoning, tools);
        }
      }

      throw error;
    }
  }

  private getUnavailabilityMessage(): string {
    const hasApiKey = zaiService.hasApiKey;
    const isOnline = offlineService.getStatus().isOnline;
    const appleAIAvailable = appleAIService.available;

    if (!hasApiKey && !appleAIAvailable) {
      return `No AI available. Please either:\n1. Set up a Z.AI API key, or\n2. ${appleAIService.getAvailabilityMessage()}`;
    }

    if (!isOnline && !appleAIAvailable) {
      return `You are offline and Apple Intelligence is not available.\n${appleAIService.getAvailabilityMessage()}`;
    }

    if (!appleAIAvailable) {
      return appleAIService.getAvailabilityMessage();
    }

    return 'No AI backend is available';
  }

  getStatusMessage(): string {
    const backend = this.activeBackend;

    switch (backend) {
      case 'zai':
        return 'Connected to Z.AI Cloud';
      case 'apple-intelligence':
        return 'Using Apple Intelligence (On-Device)';
      default:
        return this.getUnavailabilityMessage();
    }
  }

  canUseAppleIntelligence(): boolean {
    return appleAIService.available;
  }

  canUseZAI(): boolean {
    return zaiService.hasApiKey && offlineService.getStatus().isOnline;
  }

  forceBackend(backend: AIBackend): void {
    if (backend === 'zai' && !this.canUseZAI()) {
      throw new Error('Cannot use Z.AI: No API key or offline');
    }
    if (backend === 'apple-intelligence' && !this.canUseAppleIntelligence()) {
      throw new Error('Cannot use Apple Intelligence: Not available on this device');
    }
    this.currentBackend = backend;
  }
}

export const aiRouter = new AIRouter();
