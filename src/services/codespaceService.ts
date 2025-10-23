import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { githubService } from './githubService';
export interface Codespace {
  id: string;
  name: string;
  display_name: string;
  repository: {
    name: string;
    full_name: string;
    html_url: string;
    clone_url: string;
  };
  machine: {
    display_name: string;
    prebuilds?: boolean;
  };
  environment: {
    git_status: {
      ref: string;
      has_uncommitted_changes: boolean;
      has_unpushed_changes: boolean;
    };
  };
  state: 'available' | 'creating' | 'starting' | 'shutdown' | 'archived' | 'deleted';
  web_url: string;
  created_at: string;
  last_used_at: string;
  idle_timeout_minutes: number;
}
export interface CreateCodespaceOptions {
  repository: string; 
  branch?: string;
  machine_type?: string;
  display_name?: string;
}
class CodespaceService {
  private readonly GITHUB_API_BASE = 'https://api.github.com';
  private readonly INACTIVITY_TIMEOUT = 3 * 60 * 60 * 1000; 
  async createCodespace(options: CreateCodespaceOptions): Promise<Codespace | null> {
    if (!githubService.isAuthenticated()) {
      throw new Error('GitHub authentication required');
    }
    try {
      const [owner, repo] = options.repository.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format. Use: owner/repo');
      }
      const payload: any = {
        repository: options.repository,
        machine: options.machine_type || 'standardLinux_x64',
      };
      if (options.branch) {
        payload.ref = options.branch;
      }
      if (options.display_name) {
        payload.display_name = options.display_name;
      }
      const response = await axios.post(
        `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/codespaces`,
        payload,
        {
          headers: {
            'Authorization': `token ${await this.getGitHubToken()}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
        }
      );
      const codespace = response.data;
      await this.storeCodespaceInfo(codespace);
      return codespace;
    } catch (error) {
      console.error('Failed to create codespace:', error);
      if (axios.isAxiosError(error) && error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Failed to create codespace');
    }
  }
  async getCodespaces(): Promise<Codespace[]> {
    if (!githubService.isAuthenticated()) {
      return [];
    }
    try {
      const response = await axios.get(
        `${this.GITHUB_API_BASE}/user/codespaces`,
        {
          headers: {
            'Authorization': `token ${await this.getGitHubToken()}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      return response.data.codespaces || [];
    } catch (error) {
      console.error('Failed to get codespaces:', error);
      return [];
    }
  }
  async getCodespace(codespaceId: string): Promise<Codespace | null> {
    if (!githubService.isAuthenticated()) {
      return null;
    }
    try {
      const response = await axios.get(
        `${this.GITHUB_API_BASE}/user/codespaces/${codespaceId}`,
        {
          headers: {
            'Authorization': `token ${await this.getGitHubToken()}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get codespace:', error);
      return null;
    }
  }
  async startCodespace(codespaceId: string): Promise<Codespace | null> {
    if (!githubService.isAuthenticated()) {
      return null;
    }
    try {
      const response = await axios.post(
        `${this.GITHUB_API_BASE}/user/codespaces/${codespaceId}/start`,
        {},
        {
          headers: {
            'Authorization': `token ${await this.getGitHubToken()}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      const codespace = response.data;
      await this.storeCodespaceInfo(codespace);
      return codespace;
    } catch (error) {
      console.error('Failed to start codespace:', error);
      return null;
    }
  }
  async stopCodespace(codespaceId: string): Promise<boolean> {
    if (!githubService.isAuthenticated()) {
      return false;
    }
    try {
      await axios.post(
        `${this.GITHUB_API_BASE}/user/codespaces/${codespaceId}/stop`,
        {},
        {
          headers: {
            'Authorization': `token ${await this.getGitHubToken()}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      await this.removeStoredCodespaceInfo(codespaceId);
      return true;
    } catch (error) {
      console.error('Failed to stop codespace:', error);
      return false;
    }
  }
  async deleteCodespace(codespaceId: string): Promise<boolean> {
    if (!githubService.isAuthenticated()) {
      return false;
    }
    try {
      await axios.delete(
        `${this.GITHUB_API_BASE}/user/codespaces/${codespaceId}`,
        {
          headers: {
            'Authorization': `token ${await this.getGitHubToken()}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      await this.removeStoredCodespaceInfo(codespaceId);
      return true;
    } catch (error) {
      console.error('Failed to delete codespace:', error);
      return false;
    }
  }
  async getCurrentCodespace(): Promise<Codespace | null> {
    try {
      const storedCodespaceId = await AsyncStorage.getItem('current_codespace_id');
      if (!storedCodespaceId) {
        return null;
      }
      const lastActivity = await AsyncStorage.getItem('codespace_last_activity');
      if (lastActivity) {
        const timeSinceActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceActivity > this.INACTIVITY_TIMEOUT) {
          await this.stopCodespace(storedCodespaceId);
          await this.clearCurrentCodespace();
          return null;
        }
      }
      const codespace = await this.getCodespace(storedCodespaceId);
      if (codespace && codespace.state === 'available') {
        await this.updateLastActivity();
        return codespace;
      } else {
        await this.clearCurrentCodespace();
        return null;
      }
    } catch (error) {
      console.error('Failed to get current codespace:', error);
      await this.clearCurrentCodespace();
      return null;
    }
  }
  async setCurrentCodespace(codespace: Codespace): Promise<void> {
    await AsyncStorage.setItem('current_codespace_id', codespace.id);
    await this.storeCodespaceInfo(codespace);
    await this.updateLastActivity();
  }
  async clearCurrentCodespace(): Promise<void> {
    await AsyncStorage.multiRemove(['current_codespace_id', 'codespace_last_activity']);
  }
  async updateLastActivity(): Promise<void> {
    await AsyncStorage.setItem('codespace_last_activity', Date.now().toString());
  }
  private async storeCodespaceInfo(codespace: Codespace): Promise<void> {
    try {
      await AsyncStorage.setItem(`codespace_${codespace.id}`, JSON.stringify(codespace));
    } catch (error) {
      console.error('Failed to store codespace info:', error);
    }
  }
  private async removeStoredCodespaceInfo(codespaceId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`codespace_${codespaceId}`);
    } catch (error) {
      console.error('Failed to remove stored codespace info:', error);
    }
  }
  private async getGitHubToken(): Promise<string> {
    const token = await AsyncStorage.getItem('github_token');
    if (!token) {
      throw new Error('GitHub token not found');
    }
    return token;
  }
  extractRepositoryFromMessage(message: string): string | null {
    const patterns = [
      /(?:github\.com\/)?(\w+)\/(\w+)(?:\.git)?/gi,
      /(\w+)\/(\w+)/gi,
    ];
    for (const pattern of patterns) {
      const matches = message.match(pattern);
      if (matches) {
        for (const match of matches) {
          const cleanMatch = match.replace('github.com/', '').replace('.git', '');
          if (cleanMatch.includes('/')) {
            return cleanMatch;
          }
        }
      }
    }
    return null;
  }
  async suggestRepositoryCreation(projectName: string): Promise<string> {
    const user = await githubService.getUser();
    if (!user) {
      throw new Error('GitHub authentication required');
    }
    const repoName = projectName.toLowerCase().replace(/\s+/g, '-');
    const fullName = `${user.login}/${repoName}`;
    const existingRepo = await githubService.getRepo(user.login, repoName);
    if (existingRepo) {
      return fullName;
    }
    const newRepo = await githubService.createRepo(
      repoName,
      `${projectName} - Created from chat session`,
      false 
    );
    if (newRepo) {
      return newRepo.full_name;
    }
    throw new Error('Failed to create repository');
  }
  formatCodespaceStatus(codespace: Codespace): string {
    const statusEmoji = {
      available: '🟢',
      creating: '🟡',
      starting: '🟡',
      shutdown: '🔴',
      archived: '📁',
      deleted: '❌',
    };
    const statusText = {
      available: 'Available',
      creating: 'Creating...',
      starting: 'Starting...',
      shutdown: 'Shutdown',
      archived: 'Archived',
      deleted: 'Deleted',
    };
    return `${statusEmoji[codespace.state]} ${statusText[codespace.state]}`;
  }
  async hasCodespacesAccess(): Promise<boolean> {
    if (!githubService.isAuthenticated()) {
      return false;
    }
    try {
      const response = await axios.get(
        `${this.GITHUB_API_BASE}/user/codespaces`,
        {
          headers: {
            'Authorization': `token ${await this.getGitHubToken()}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false;
      }
      return true;
    }
  }
}
export const codespaceService = new CodespaceService();