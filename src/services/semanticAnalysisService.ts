import { Message, ChatMemory, SemanticMatch, ContextInjection } from '../types';
import { zaiService } from './zaiService';
import { chatDatabase } from './chatDatabase';
import { settingsService } from './settingsService';

interface EmbeddingCache {
  text: string;
  embedding: number[];
  timestamp: Date;
}

export class SemanticAnalysisService {
  private embeddingCache: Map<string, EmbeddingCache> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';

  private stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'among', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
    'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now', 'also',
    'here', 'there', 'then', 'again', 'further', 'once', 'please', 'thank', 'thanks',
    'hello', 'hi', 'hey', 'bye', 'goodbye', 'yes', 'no', 'ok', 'okay', 'well', 'like',
    'know', 'think', 'want', 'need', 'get', 'go', 'come', 'see', 'look', 'take', 'give',
    'make', 'tell', 'ask', 'work', 'seem', 'feel', 'try', 'leave', 'call', 'show',
  ]);
  extractKeyTerms(text: string, maxTerms: number = 10): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word));
    const termFreq: Map<string, number> = new Map();
    words.forEach(word => {
      termFreq.set(word, (termFreq.get(word) || 0) + 1);
    });
    return Array.from(termFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTerms)
      .map(([term]) => term);
  }

  /**
   * Generate embedding vector for text using OpenAI API
   */
  async generateEmbedding(text: string): Promise<number[]> {
    // Normalize text for cache key
    const normalizedText = text.trim().toLowerCase();

    // Check cache first
    const cached = this.embeddingCache.get(normalizedText);
    if (cached) {
      console.log('Using cached embedding');
      return cached.embedding;
    }

    try {
      // Call OpenAI embeddings API via fetch
      // Note: You'll need an OpenAI API key for this
      const apiKey = settingsService.getSettings().apiKey;

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.EMBEDDING_MODEL,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.statusText}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;

      // Cache the embedding
      this.cacheEmbedding(normalizedText, embedding);

      return embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Cache embedding with LRU eviction
   */
  private cacheEmbedding(text: string, embedding: number[]): void {
    // If cache is full, remove oldest entry
    if (this.embeddingCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }

    this.embeddingCache.set(text, {
      text,
      embedding,
      timestamp: new Date(),
    });
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);

    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
  extractKeyTermsFromMessages(messages: Message[], maxTerms: number = 15): string[] {
    const allText = messages
      .map(msg => {
        if (typeof msg.content === 'string') {
          return msg.content;
        } else {
          return msg.content
            .filter(content => content.type === 'text')
            .map(content => content.text)
            .join(' ');
        }
      })
      .join(' ');
    return this.extractKeyTerms(allText, maxTerms);
  }
  async generateSummary(messages: Message[]): Promise<string> {
    if (messages.length === 0) return '';
    const conversationText = messages
      .slice(-10) 
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : msg.content.map(c => c.type === 'text' ? c.text : '[Image]').join(' ');
        return `${role}: ${content}`;
      })
      .join('\n');
    try {
      const response = await zaiService.sendMessage([
        {
          id: 'system',
          role: 'system',
          content: 'You are a helpful assistant that creates concise summaries of conversations. Create a brief, informative summary (1-2 sentences) that captures the main topics and outcomes of the conversation.',
          timestamp: new Date(),
        },
        {
          id: 'user',
          role: 'user',
          content: `Please summarize this conversation:\n\n${conversationText}`,
          timestamp: new Date(),
        }
      ], 'glm-4.5-air', false);
      return response.content.trim();
    } catch (error) {
      console.error('Failed to generate summary:', error);
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        const content = typeof firstUserMessage.content === 'string' 
          ? firstUserMessage.content 
          : firstUserMessage.content.map(c => c.text || '').join(' ');
        return content.slice(0, 100) + (content.length > 100 ? '...' : '');
      }
      return 'Conversation summary unavailable';
    }
  }
  async generateTags(messages: Message[]): Promise<string[]> {
    if (messages.length === 0) return [];
    const conversationText = messages
      .slice(-6) 
      .map(msg => {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        const content = typeof msg.content === 'string' 
          ? msg.content 
          : msg.content.map(c => c.type === 'text' ? c.text : '[Image]').join(' ');
        return `${role}: ${content}`;
      })
      .join('\n');
    try {
      const response = await zaiService.sendMessage([
        {
          id: 'system',
          role: 'system',
          content: 'You are a helpful assistant that creates relevant tags for conversations. Generate 3-5 concise, lowercase tags that capture the main topics. Respond with only the tags separated by commas, no other text.',
          timestamp: new Date(),
        },
        {
          id: 'user',
          role: 'user',
          content: `Generate tags for this conversation:\n\n${conversationText}`,
          timestamp: new Date(),
        }
      ], 'glm-4.5-air', false);
      return response.content
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0 && tag.length < 20)
        .slice(0, 5);
    } catch (error) {
      console.error('Failed to generate tags:', error);
      return this.extractKeyTermsFromMessages(messages, 5);
    }
  }
  /**
   * Find semantically similar memories using embeddings (primary) or keyword matching (fallback)
   */
  async findSemanticMatches(
    currentMessage: string,
    memories: ChatMemory[],
    threshold: number = 0.3
  ): Promise<SemanticMatch[]> {
    try {
      // Try embedding-based similarity first
      return await this.findSemanticMatchesByEmbedding(currentMessage, memories, threshold);
    } catch (error) {
      console.warn('Embedding-based search failed, falling back to keyword search:', error);
      // Fallback to keyword-based similarity
      return this.findSemanticMatchesByKeywords(currentMessage, memories, threshold);
    }
  }

  /**
   * Find similar memories using vector embeddings (real semantic search)
   */
  private async findSemanticMatchesByEmbedding(
    currentMessage: string,
    memories: ChatMemory[],
    threshold: number = 0.7  // Higher threshold for cosine similarity
  ): Promise<SemanticMatch[]> {
    // Generate embedding for current message
    const currentEmbedding = await this.generateEmbedding(currentMessage);

    const matches: SemanticMatch[] = [];

    for (const memory of memories) {
      try {
        // Get or generate embedding for memory
        let memoryEmbedding: number[];

        if (memory.embedding && Array.isArray(memory.embedding)) {
          memoryEmbedding = memory.embedding;
        } else {
          // Generate embedding for memory summary
          memoryEmbedding = await this.generateEmbedding(memory.summary);

          // Store embedding in memory for future use
          await this.storeEmbeddingForMemory(memory.id, memoryEmbedding);
        }

        // Calculate cosine similarity
        const similarity = this.cosineSimilarity(currentEmbedding, memoryEmbedding);

        if (similarity >= threshold) {
          matches.push({
            memoryId: memory.id,
            score: similarity,
            matchedTerms: [],  // Not applicable for embedding-based search
            summary: memory.summary,
          });
        }
      } catch (error) {
        console.error(`Failed to process embedding for memory ${memory.id}:`, error);
        // Skip this memory and continue
      }
    }

    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  /**
   * Find similar memories using keyword matching (fallback method)
   */
  private findSemanticMatchesByKeywords(
    currentMessage: string,
    memories: ChatMemory[],
    threshold: number = 0.3
  ): Promise<SemanticMatch[]> {
    const currentTerms = new Set(this.extractKeyTerms(currentMessage, 20));
    const matches: SemanticMatch[] = [];

    for (const memory of memories) {
      const memoryTerms = new Set(memory.keyTerms);
      const intersection = new Set([...currentTerms].filter(term => memoryTerms.has(term)));
      const union = new Set([...currentTerms, ...memoryTerms]);

      // Jaccard similarity
      const similarity = intersection.size / union.size;

      if (similarity >= threshold) {
        matches.push({
          memoryId: memory.id,
          score: similarity,
          matchedTerms: Array.from(intersection),
          summary: memory.summary,
        });
      }
    }

    return Promise.resolve(
      matches
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
    );
  }

  /**
   * Store embedding for a memory in the database
   */
  private async storeEmbeddingForMemory(memoryId: string, embedding: number[]): Promise<void> {
    try {
      // Store embedding in database
      // This would require updating the chatDatabase schema
      await chatDatabase.saveMemoryEmbedding(memoryId, embedding);
    } catch (error) {
      console.error('Failed to store embedding:', error);
      // Non-fatal error, just log it
    }
  }
  async createContextInjection(
    currentMessage: string,
    memories: ChatMemory[]
  ): Promise<ContextInjection> {
    const matches = await this.findSemanticMatches(currentMessage, memories);
    const injectedContext = matches.map(match => 
      `Previous conversation context: ${match.summary}`
    );
    return {
      originalMessage: currentMessage,
      injectedContext,
      relevantMemories: matches,
    };
  }
  parseMessage(message: Message): {
    keyTerms: string[];
    entities: string[];
    intent: string;
  } {
    const content = typeof message.content === 'string' 
      ? message.content 
      : message.content.map(c => c.text || '').join(' ');
    const keyTerms = this.extractKeyTerms(content, 10);
    const entities = content
      .match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
      .filter((entity: string) => entity.length > 2 && entity.length < 30);
    let intent = 'general';
    if (content.includes('?') || content.includes('how') || content.includes('what') || content.includes('why')) {
      intent = 'question';
    } else if (content.includes('please') || content.includes('can you') || content.includes('would you')) {
      intent = 'request';
    } else if (content.includes('thank') || content.includes('appreciate')) {
      intent = 'gratitude';
    } else if (content.includes('sorry') || content.includes('apologize')) {
      intent = 'apology';
    }
    return {
      keyTerms,
      entities: entities.slice(0, 5),
      intent,
    };
  }
  async generateChatTitle(firstMessage: string): Promise<string> {
    try {
      const response = await zaiService.sendMessage([
        {
          id: 'system',
          role: 'system',
          content: 'You are a helpful assistant that creates concise, descriptive titles for conversations. Create a short title (3-6 words) that captures the main topic. Respond with only the title, no other text.',
          timestamp: new Date(),
        },
        {
          id: 'user',
          role: 'user',
          content: `Create a title for a conversation that starts with: "${firstMessage.slice(0, 200)}${firstMessage.length > 200 ? '...' : ''}"`,
          timestamp: new Date(),
        }
      ], 'glm-4.5-air', false);
      return response.content.trim().slice(0, 50);
    } catch (error) {
      console.error('Failed to generate title:', error);
      return firstMessage
        .split(' ')
        .slice(0, 6)
        .join(' ')
        .slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    }
  }
}
export const semanticAnalysisService = new SemanticAnalysisService();