import * as SQLite from 'expo-sqlite';
import { ChatBio, ChatMemory, Message, MessageContent } from '../types';
import { databaseMigration } from './databaseMigration';
export class ChatDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('chat_memory.db');
      await databaseMigration.migrate(this.db);
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }
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
      try {
        const parsed = JSON.parse(result.content);
        if (Array.isArray(parsed)) {
          content = parsed;
        }
      } catch {
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
  async saveSetting(key: string, value: string, type: string = 'string'): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      `INSERT OR REPLACE INTO settings (key, value, type, updated_at)
       VALUES (?, ?, ?, ?)`,
      [key, value, type, new Date().toISOString()]
    );
  }
  async getSetting(key: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    return result?.value || null;
  }
  async getAllSettings(): Promise<Record<string, { value: string; type: string }>> {
    if (!this.db) throw new Error('Database not initialized');
    const results = await this.db.getAllAsync<{ key: string; value: string; type: string }>(
      'SELECT key, value, type FROM settings'
    );
    const settings: Record<string, { value: string; type: string }> = {};
    for (const result of results) {
      settings[result.key] = {
        value: result.value,
        type: result.type
      };
    }
    return settings;
  }
  async saveGist(gist: {
    id: string;
    chatId: string;
    gistId: string;
    gistUrl: string;
    title: string;
    description?: string;
    content: string;
    isPublic: boolean;
    tags: string[];
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      `INSERT OR REPLACE INTO gists 
       (id, chat_id, gist_id, gist_url, title, description, content, is_public, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gist.id,
        gist.chatId,
        gist.gistId,
        gist.gistUrl,
        gist.title,
        gist.description || null,
        gist.content,
        gist.isPublic ? 1 : 0,
        JSON.stringify(gist.tags),
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  }
  async getGist(id: string): Promise<any | null> {
    if (!this.db) throw new Error('Database not initialized');
    const result = await this.db.getFirstAsync(`
      SELECT * FROM gists WHERE id = ?
    `, [id]);
    if (!result) return null;
    return {
      id: result.id,
      chatId: result.chat_id,
      gistId: result.gist_id,
      gistUrl: result.gist_url,
      title: result.title,
      description: result.description,
      content: result.content,
      isPublic: Boolean(result.is_public),
      tags: JSON.parse(result.tags),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    };
  }
  async getGistsByChatId(chatId: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    const results = await this.db.getAllAsync(`
      SELECT * FROM gists WHERE chat_id = ? ORDER BY updated_at DESC
    `, [chatId]);
    return results.map(result => ({
      id: result.id,
      chatId: result.chat_id,
      gistId: result.gist_id,
      gistUrl: result.gist_url,
      title: result.title,
      description: result.description,
      content: result.content,
      isPublic: Boolean(result.is_public),
      tags: JSON.parse(result.tags),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }));
  }
  async saveTokenUsage(usage: {
    chatId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      `INSERT INTO token_usage 
       (chat_id, model, input_tokens, output_tokens, total_tokens, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        usage.chatId,
        usage.model,
        usage.inputTokens,
        usage.outputTokens,
        usage.totalTokens,
        new Date().toISOString()
      ]
    );
  }
  async getTokenUsageStats(chatId?: string): Promise<{
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    modelStats: Record<string, { input: number; output: number; total: number }>;
  }> {
    if (!this.db) throw new Error('Database not initialized');
    const whereClause = chatId ? 'WHERE chat_id = ?' : '';
    const params = chatId ? [chatId] : [];
    const results = await this.db.getAllAsync(`
      SELECT model, 
             SUM(input_tokens) as total_input,
             SUM(output_tokens) as total_output,
             SUM(total_tokens) as total_tokens
      FROM token_usage 
      ${whereClause}
      GROUP BY model
    `, params);
    const stats = {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      modelStats: {} as Record<string, { input: number; output: number; total: number }>
    };
    for (const result of results) {
      const input = Number(result.total_input) || 0;
      const output = Number(result.total_output) || 0;
      const total = Number(result.total_tokens) || 0;
      stats.inputTokens += input;
      stats.outputTokens += output;
      stats.totalTokens += total;
      stats.modelStats[result.model] = { input, output, total };
    }
    return stats;
  }
  async saveBranch(branch: {
    id: string;
    chatId: string;
    repository: string;
    branchName: string;
    prUrl?: string;
    status: string;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      `INSERT OR REPLACE INTO branches 
       (id, chat_id, repository, branch_name, last_activity, pr_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        branch.id,
        branch.chatId,
        branch.repository,
        branch.branchName,
        new Date().toISOString(),
        branch.prUrl || null,
        branch.status,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  }
  async getBranchesByChatId(chatId: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    const results = await this.db.getAllAsync(`
      SELECT * FROM branches WHERE chat_id = ? ORDER BY updated_at DESC
    `, [chatId]);
    return results.map(result => ({
      id: result.id,
      chatId: result.chat_id,
      repository: result.repository,
      branchName: result.branch_name,
      lastActivity: new Date(result.last_activity),
      prUrl: result.pr_url,
      status: result.status,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }));
  }
  async saveCodespace(codespace: {
    id: string;
    repository: string;
    codespaceId: string;
    displayName: string;
    state: string;
    webUrl: string;
  }): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      `INSERT OR REPLACE INTO codespaces 
       (id, repository, codespace_id, display_name, state, web_url, last_activity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codespace.id,
        codespace.repository,
        codespace.codespaceId,
        codespace.displayName,
        codespace.state,
        codespace.webUrl,
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  }
  async getCodespaces(repository?: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    const whereClause = repository ? 'WHERE repository = ?' : '';
    const params = repository ? [repository] : [];
    const results = await this.db.getAllAsync(`
      SELECT * FROM codespaces ${whereClause} ORDER BY updated_at DESC
    `, params);
    return results.map(result => ({
      id: result.id,
      repository: result.repository,
      codespaceId: result.codespace_id,
      displayName: result.display_name,
      state: result.state,
      webUrl: result.web_url,
      lastActivity: new Date(result.last_activity),
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
    }));
  }
  async deleteCodespace(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM codespaces WHERE id = ?', [id]);
  }
}
export const chatDatabase = new ChatDatabase();