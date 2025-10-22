import { SecureStorage } from '../utils/secureStorage';
import axios from 'axios';
interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
}
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  private: boolean;
  default_branch: string;
}
interface GitHubFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
  content?: string;
}
class GitHubService {
  private token: string | null = null;
  private authenticated = false;
  async setToken(token: string): Promise<boolean> {
    try {
      const response = await axios.get('https:
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (response.data) {
        this.token = token;
        this.authenticated = true;
        await SecureStorage.setApiKey('github_token', token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('GitHub token validation failed:', error);
      return false;
    }
  }
  async loadStoredToken(): Promise<boolean> {
    try {
      const token = await SecureStorage.getApiKey('github_token');
      if (token) {
        return await this.setToken(token);
      }
      return false;
    } catch (error) {
      console.error('Failed to load GitHub token:', error);
      return false;
    }
  }
  async getUser(): Promise<GitHubUser | null> {
    if (!this.authenticated) {
      return null;
    }
    try {
      const response = await axios.get('https:
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get GitHub user:', error);
      return null;
    }
  }
  async getRepo(owner: string, repo: string): Promise<GitHubRepo | null> {
    if (!this.authenticated) {
      return null;
    }
    try {
      const response = await axios.get(`https:
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get GitHub repo:', error);
      return null;
    }
  }
  async getFileContent(owner: string, repo: string, path: string, branch: string = 'main'): Promise<string | null> {
    if (!this.authenticated) {
      return null;
    }
    try {
      const response = await axios.get(`https:
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        params: {
          ref: branch
        }
      });
      if (response.data.content) {
        return atob(response.data.content);
      }
      return null;
    } catch (error) {
      console.error('Failed to get file content:', error);
      return null;
    }
  }
  async getRepoFiles(owner: string, repo: string, path: string = '', branch: string = 'main'): Promise<GitHubFile[]> {
    if (!this.authenticated) {
      return [];
    }
    try {
      const response = await axios.get(`https:
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        params: {
          ref: branch
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to get repo files:', error);
      return [];
    }
  }
  async createRepo(name: string, description: string = '', isPrivate: boolean = false): Promise<GitHubRepo | null> {
    if (!this.authenticated) {
      return null;
    }
    try {
      const response = await axios.post('https:
        name,
        description,
        private: isPrivate,
        auto_init: true
      }, {
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to create repo:', error);
      return null;
    }
  }
  parseGitHubUrl(url: string): { owner: string; repo: string; path?: string } | null {
    const githubRegex = /https?:\/\/(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/(.+))?/;
    const match = url.match(githubRegex);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace('.git', ''),
        path: match[3]
      };
    }
    return null;
  }
  detectGitHubCommands(text: string): string[] {
    const commands = [];
    const githubPatterns = [
      /gh\s+(\w+)/gi,           
      /github\.com\/\S+/gi,      
      /git@github\.com:\S+/gi,   
    ];
    for (const pattern of githubPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        commands.push(...matches);
      }
    }
    return [...new Set(commands)]; 
  }
  isAuthenticated(): boolean {
    return this.authenticated;
  }
  async logout(): Promise<void> {
    this.token = null;
    this.authenticated = false;
    await SecureStorage.removeItem('github_token');
  }
  getTokenSetupInstructions(): string {
    return `To set up GitHub access:
1. Go to https:
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Chat App")
4. Select these scopes:
   • repo (Full control of private repositories)
   • read:org (Read org and team membership)
   • read:user (Read all user profile data)
5. Click "Generate token"
6. Copy the token and paste it here
Note: The token will be stored securely on your device.`;
  }
}
export const githubService = new GitHubService();