import { Message, ChatMemory, SemanticMatch, ContextInjection } from '../types';
import { zaiService } from './zaiService';

export class SemanticAnalysisService {
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

  // Extract key terms from text using TF-IDF-like approach
  extractKeyTerms(text: string, maxTerms: number = 10): string[] {
    // Clean and tokenize text
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word));

    // Calculate term frequency
    const termFreq: Map<string, number> = new Map();
    words.forEach(word => {
      termFreq.set(word, (termFreq.get(word) || 0) + 1);
    });

    // Sort by frequency and return top terms
    return Array.from(termFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTerms)
      .map(([term]) => term);
  }

  // Extract key terms from messages
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

  // Generate summary using AI
  async generateSummary(messages: Message[]): Promise<string> {
    if (messages.length === 0) return '';

    const conversationText = messages
      .slice(-10) // Use last 10 messages for context
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
      // Fallback to simple summary
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

  // Generate tags using AI
  async generateTags(messages: Message[]): Promise<string[]> {
    if (messages.length === 0) return [];

    const conversationText = messages
      .slice(-6) // Use last 6 messages for context
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
      // Fallback to key terms extraction
      return this.extractKeyTermsFromMessages(messages, 5);
    }
  }

  // Find semantic matches between current message and stored memories
  async findSemanticMatches(
    currentMessage: string,
    memories: ChatMemory[],
    threshold: number = 0.3
  ): Promise<SemanticMatch[]> {
    const currentTerms = new Set(this.extractKeyTerms(currentMessage, 20));
    const matches: SemanticMatch[] = [];

    for (const memory of memories) {
      const memoryTerms = new Set(memory.keyTerms);
      
      // Calculate Jaccard similarity
      const intersection = new Set([...currentTerms].filter(term => memoryTerms.has(term)));
      const union = new Set([...currentTerms, ...memoryTerms]);
      
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

    // Sort by similarity score and return top matches
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Return top 3 matches
  }

  // Create context injection for current message
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

  // Parse message to extract semantic information
  parseMessage(message: Message): {
    keyTerms: string[];
    entities: string[];
    intent: string;
  } {
    const content = typeof message.content === 'string' 
      ? message.content 
      : message.content.map(c => c.text || '').join(' ');

    const keyTerms = this.extractKeyTerms(content, 10);
    
    // Simple entity extraction (capitalized words, proper nouns)
    const entities = content
      .match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
      .filter((entity: string) => entity.length > 2 && entity.length < 30);

    // Simple intent detection
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

  // Generate chat title from first message
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
      // Fallback to first few words
      return firstMessage
        .split(' ')
        .slice(0, 6)
        .join(' ')
        .slice(0, 50) + (firstMessage.length > 50 ? '...' : '');
    }
  }
}

export const semanticAnalysisService = new SemanticAnalysisService();