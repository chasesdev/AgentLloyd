import * as SQLite from 'expo-sqlite';
import { ChatBio, ChatMemory, Message, MessageContent } from '../types';

export class ChatDatabase {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('chat_memory.db');
      
      // Create bio table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS bio (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Create memories table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          tags TEXT NOT NULL,
          summary TEXT NOT NULL,
          key_terms TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_message_at TEXT NOT NULL
        );
      `);

      // Create messages table
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          chat_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          thinking TEXT,
          model TEXT,
          FOREIGN KEY (chat_id) REFERENCES memories (id) ON DELETE CASCADE
        );
      `);

      // Create indexes for better performance
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
        CREATE INDEX IF NOT EXISTS idx_memories_last_message_at ON memories(last_message_at);
        CREATE INDEX IF NOT EXISTS idx_memories_key_terms ON memories(key_terms);
      `);

      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  // Bio operations
  async saveBio(bio: ChatBio): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO bio (id, name, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        bio.id,
        bio.name,
        bio.content,
        bio.createdAt.toISOString(),
        bio.updatedAt.toISOString()
      ]
    );
  }

  async getBio(): Promise<ChatBio | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync<{
      id: string;
      name: string;
      content: string;
      created_at: string;
      updated_at: string;
    }>('SELECT * FROM bio LIMIT 1');

    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      content: result.content,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    };
  }

  // Memory operations
  async saveMemory(memory: ChatMemory): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      `INSERT OR REPLACE INTO memories 
       (id, title, tags, summary, key_terms, created_at, updated_at, last_message_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        memory.id,
        memory.title,
        JSON.stringify(memory.tags),
        memory.summary,
        JSON.stringify(memory.keyTerms),
        memory.createdAt.toISOString(),
        memory.updatedAt.toISOString(),
        memory.lastMessageAt.toISOString()
      ]
    );

    // Save messages
    for (const message of memory.messages) {
      await this.saveMessage(message);
    }
  }

  async getMemory(id: string): Promise<ChatMemory | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync<{
      id: string;
      title: string;
      tags: string;
      summary: string;
      key_terms: string;
      created_at: string;
      updated_at: string;
      last_message_at: string;
    }>('SELECT * FROM memories WHERE id = ?', [id]);

    if (!result) return null;

    const messages = await this.getMessages(id);

    return {
      id: result.id,
      title: result.title,
      messages,
      tags: JSON.parse(result.tags),
      summary: result.summary,
      keyTerms: JSON.parse(result.key_terms),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
      lastMessageAt: new Date(result.last_message_at),
    };
  }

  async getAllMemories(): Promise<ChatMemory[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db.getAllAsync<{
      id: string;
      title: string;
      tags: string;
      summary: string;
      key_terms: string;
      created_at: string;
      updated_at: string;
      last_message_at: string;
    }>('SELECT * FROM memories ORDER BY last_message_at DESC');

    const memories: ChatMemory[] = [];
    
    for (const result of results) {
      const messages = await this.getMessages(result.id);
      
      memories.push({
        id: result.id,
        title: result.title,
        messages,
        tags: JSON.parse(result.tags),
        summary: result.summary,
        keyTerms: JSON.parse(result.key_terms),
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
        lastMessageAt: new Date(result.last_message_at),
      });
    }

    return memories;
  }

  async deleteMemory(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync('DELETE FROM memories WHERE id = ?', [id]);
    await this.db.runAsync('DELETE FROM messages WHERE chat_id = ?', [id]);
  }

  async updateMemoryTitle(id: string, title: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'UPDATE memories SET title = ?, updated_at = ? WHERE id = ?',
      [title, new Date().toISOString(), id]
    );
  }

  // Message operations
  async saveMessage(message: Message): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const content = typeof message.content === 'string' 
      ? message.content 
      : JSON.stringify(message.content);

    await this.db.runAsync(
      `INSERT OR REPLACE INTO messages 
       (id, chat_id, role, content, timestamp, thinking, model)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        message.id,
        message.chatId || '',
        message.role,
        content,
        message.timestamp.toISOString(),
        message.thinking || null,
        message.model || null
      ]
    );
  }

  async getMessages(chatId: string): Promise<Message[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const results = await this.db.getAllAsync<{
      id: string;
      chat_id: string;
      role: string;
      content: string;
      timestamp: string;
      thinking: string | null;
      model: string | null;
    }>(
      'SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC',
      [chatId]
    );

    return results.map(result => {
      let content: string | MessageContent[] = result.content;
      
      // Try to parse as JSON for multimodal content
      try {
        const parsed = JSON.parse(result.content);
        if (Array.isArray(parsed)) {
          content = parsed;
        }
      } catch {
        // Keep as string if not valid JSON
      }

      return {
        id: result.id,
        chatId: result.chat_id,
        role: result.role as 'user' | 'assistant' | 'system',
        content,
        timestamp: new Date(result.timestamp),
        thinking: result.thinking || undefined,
        model: result.model || undefined,
      };
    });
  }

  // Search operations
  async searchMemoriesByTerms(terms: string[]): Promise<ChatMemory[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    if (terms.length === 0) return [];
    
    const placeholders = terms.map(() => '?').join(',');
    const query = `
      SELECT DISTINCT m.* FROM memories m
      WHERE m.key_terms LIKE ${placeholders.split(',').map(() => "'%' || ? || '%'").join(' OR ')}
      ORDER BY m.last_message_at DESC
    `;
    
    const results = await this.db.getAllAsync<{
      id: string;
      title: string;
      tags: string;
      summary: string;
      key_terms: string;
      created_at: string;
      updated_at: string;
      last_message_at: string;
    }>(query, terms);

    const memories: ChatMemory[] = [];
    
    for (const result of results) {
      const messages = await this.getMessages(result.id);
      
      memories.push({
        id: result.id,
        title: result.title,
        messages,
        tags: JSON.parse(result.tags),
        summary: result.summary,
        keyTerms: JSON.parse(result.key_terms),
        createdAt: new Date(result.created_at),
        updatedAt: new Date(result.updated_at),
        lastMessageAt: new Date(result.last_message_at),
      });
    }

    return memories;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

export const chatDatabase = new ChatDatabase();