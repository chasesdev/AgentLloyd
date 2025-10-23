import axios, { AxiosInstance } from 'axios';
import { SecureStorage } from '../utils/secureStorage';
import { Message, MessageContent, APIConfig } from '../types';
import { tokenUsageService } from './tokenUsageService';
import { offlineService } from './offlineService';
import { cacheService } from './cacheService';
export class ZAIService {
  private client: AxiosInstance;
  private apiKey: string | null = null;
  private initialized: boolean = false;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      timeout: 60000,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.loadApiKey();
    this.initialized = true;
  }

  private async loadApiKey(): Promise<void> {
    try {
      this.apiKey = await SecureStorage.getApiKey('zai_api_key');
      if (this.apiKey) {
        this.client.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;
      }
    } catch (error) {
      console.error('Failed to load API key:', error);
    }
  }
  async setApiKey(apiKey: string): Promise<void> {
    await SecureStorage.setApiKey('zai_api_key', apiKey);
    this.apiKey = apiKey;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
  }
  get hasApiKey(): boolean {
    return !!this.apiKey;
  }
  async sendMessage(
    messages: Message[],
    model: string = 'glm-4.6',
    thinkingEnabled: boolean = true,
    onStream?: (chunk: string) => void,
    tools?: any[]
  ): Promise<{ content: string; thinking?: string }> {
    if (!this.apiKey) {
      throw new Error('API key not set');
    }
    const cacheKey = this.generateCacheKey(messages, model, thinkingEnabled, tools);
    const cachedResponse = await cacheService.get(cacheKey);
    if (cachedResponse) {
      console.log('Using cached response for:', cacheKey);
      return cachedResponse;
    }
    const status = offlineService.getStatus();
    if (!status.isOnline) {
      console.log('Offline mode - queuing message request');
      await offlineService.addToQueue({
        type: 'message',
        data: {
          messages,
          model,
          thinkingEnabled,
          saveToMemory: true,
          chatId: messages.find(m => m.chatId)?.chatId
        },
        maxRetries: 3
      });
      throw new Error('Offline - Request queued for when connection is restored');
    }
    const config: APIConfig = {
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      apiKey: this.apiKey,
      model,
      temperature: 0.7,
      maxTokens: 4096,
      thinking: {
        type: thinkingEnabled ? 'enabled' : 'disabled'
      },
      stream: !!onStream
    };
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: Array.isArray(msg.content) 
        ? msg.content.map(content => ({
            type: content.type,
            ...(content.type === 'text' ? { text: content.text } : {}),
            ...(content.type === 'image_url' ? { image_url: content.image_url } : {})
          }))
        : msg.content
    }));
    try {
      let response;
      if (onStream) {
        response = await this.streamMessage(formattedMessages, config, onStream, tools);
      } else {
        response = await this.completeMessage(formattedMessages, config, tools);
      }
      await cacheService.set(cacheKey, response, 60 * 60 * 1000, ['api', 'response']);
      return response;
    } catch (error) {
      console.error('API Error:', error);
      if (this.isNetworkError(error)) {
        console.log('Network error - queuing message request');
        await offlineService.addToQueue({
          type: 'message',
          data: {
            messages,
            model,
            thinkingEnabled,
            saveToMemory: true,
            chatId: messages.find(m => m.chatId)?.chatId
          },
          maxRetries: 3
        });
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
    if (!this.apiKey) {
      throw new Error('API key not set');
    }
    const config: APIConfig = {
      baseURL: 'https://api.z.ai/api/coding/paas/v4',
      apiKey: this.apiKey,
      model,
      temperature: 0.3,
      maxTokens: 8192,
      thinking: {
        type: 'enabled'
      },
      stream: !!onStream
    };
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: Array.isArray(msg.content) 
        ? msg.content.map(content => ({
            type: content.type,
            ...(content.type === 'text' ? { text: content.text } : {}),
            ...(content.type === 'image_url' ? { image_url: content.image_url } : {})
          }))
        : msg.content
    }));
    try {
      if (onStream) {
        return await this.streamReasoningMessage(formattedMessages, config, onStream, onReasoning, tools);
      } else {
        return await this.completeMessage(formattedMessages, config, tools);
      }
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }
  private async completeMessage(
    messages: any[],
    config: APIConfig,
    tools?: any[]
  ): Promise<{ content: string; thinking?: string }> {
    const requestBody: any = {
      model: config.model,
      messages,
      thinking: config.thinking,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: false,
    };
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }
    const response = await this.client.post('/chat/completions', requestBody);
    const choice = response.data.choices[0];
    const usage = tokenUsageService.extractTokenUsage(response.data);
    if (usage) {
      tokenUsageService.updateTokenUsage(config.model, usage.input, usage.output);
    } else {
      const inputTokens = this.estimateTokensFromMessages(messages);
      const outputTokens = this.estimateTokens(choice.message.content || '');
      tokenUsageService.updateTokenUsage(config.model, inputTokens, outputTokens);
    }
    return {
      content: choice.message.content || '',
      thinking: choice.message.reasoning_content
    };
  }
  private async streamReasoningMessage(
    messages: any[],
    config: APIConfig,
    onStream: (chunk: string) => void,
    onReasoning?: (reasoning: string) => void,
    tools?: any[]
  ): Promise<{ content: string; thinking?: string; reasoning?: string }> {
    const requestBody: any = {
      model: config.model,
      messages,
      thinking: config.thinking,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: true,
    };
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastIndex = 0;
      let content = '';
      let thinking = '';
      let reasoning = '';

      xhr.open('POST', `${config.baseURL}/chat/completions`);
      xhr.setRequestHeader('Authorization', `Bearer ${config.apiKey}`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onprogress = () => {
        const newData = xhr.responseText.substring(lastIndex);
        lastIndex = xhr.responseText.length;

        const lines = newData.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                content += delta.content;
                onStream(delta.content);
              }

              if (delta?.reasoning_content) {
                thinking += delta.reasoning_content;
                reasoning += delta.reasoning_content;
                if (onReasoning) {
                  onReasoning(delta.reasoning_content);
                }
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const inputTokens = this.estimateTokensFromMessages(messages);
          const outputTokens = this.estimateTokens(content);
          tokenUsageService.updateTokenUsage(config.model, inputTokens, outputTokens);
          resolve({ content, thinking, reasoning });
        } else {
          reject(new Error(`API request failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error occurred'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Request timeout'));
      };

      xhr.onabort = () => {
        reject(new Error('Request aborted'));
      };

      xhr.send(JSON.stringify(requestBody));
    });
  }
  private async streamMessage(
    messages: any[],
    config: APIConfig,
    onStream: (chunk: string) => void,
    tools?: any[]
  ): Promise<{ content: string; thinking?: string }> {
    const requestBody: any = {
      model: config.model,
      messages,
      thinking: config.thinking,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      stream: true,
    };
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastIndex = 0;
      let content = '';
      let thinking = '';

      xhr.open('POST', `${config.baseURL}/chat/completions`);
      xhr.setRequestHeader('Authorization', `Bearer ${config.apiKey}`);
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.onprogress = () => {
        const newData = xhr.responseText.substring(lastIndex);
        lastIndex = xhr.responseText.length;

        const lines = newData.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                content += delta.content;
                onStream(delta.content);
              }

              if (delta?.reasoning_content) {
                thinking += delta.reasoning_content;
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const inputTokens = this.estimateTokensFromMessages(messages);
          const outputTokens = this.estimateTokens(content);
          tokenUsageService.updateTokenUsage(config.model, inputTokens, outputTokens);
          resolve({ content, thinking });
        } else {
          reject(new Error(`API request failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error occurred'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Request timeout'));
      };

      xhr.onabort = () => {
        reject(new Error('Request aborted'));
      };

      xhr.send(JSON.stringify(requestBody));
    });
  }
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const testClient = axios.create({
        baseURL: 'https://api.z.ai/api/coding/paas/v4',
        timeout: 10000,
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      await testClient.post('/chat/completions', {
        model: 'glm-4.6',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 10
      });
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }
  private estimateTokens(text: string): number {
    return tokenUsageService.estimateTokens(text);
  }
  private estimateTokensFromMessages(messages: any[]): number {
    let totalTokens = 0;
    for (const message of messages) {
      if (typeof message.content === 'string') {
        totalTokens += this.estimateTokens(message.content);
      } else if (Array.isArray(message.content)) {
        for (const content of message.content) {
          if (content.type === 'text') {
            totalTokens += this.estimateTokens(content.text);
          }
        }
      }
    }
    return totalTokens;
  }
  private generateCacheKey(
    messages: Message[], 
    model: string, 
    thinkingEnabled: boolean, 
    tools?: any[]
  ): string {
    const messageHash = this.hashMessages(messages);
    const toolsHash = tools ? this.hashObject(tools) : 'no-tools';
    return `zai_msg_${model}_${thinkingEnabled ? 'thinking' : 'no-thinking'}_${messageHash}_${toolsHash}`;
  }
  private hashMessages(messages: Message[]): string {
    const messageString = messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      timestamp: msg.timestamp.getTime()
    }));
    return this.hashObject(messageString);
  }
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; 
    }
    return Math.abs(hash).toString(36);
  }
  private isNetworkError(error: any): boolean {
    if (!error) return false;
    const errorMessage = error.message?.toLowerCase() || '';
    const networkErrorPatterns = [
      'network error',
      'fetch error',
      'connection refused',
      'timeout',
      'unreachable',
      'dns',
      'offline',
      'no internet',
      'connection reset',
      'socket hang up',
      'econnrefused',
      'enotfound',
      'etimedout'
    ];
    return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
  }
}
export const zaiService = new ZAIService();