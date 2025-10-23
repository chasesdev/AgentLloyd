import { githubService } from './githubService';
interface GitHubCommandResult {
  success: boolean;
  message: string;
  data?: any;
}
class GitHubCommandService {
  async handleCommand(command: string): Promise<GitHubCommandResult> {
    const trimmedCommand = command.trim().toLowerCase();
    if (trimmedCommand.startsWith('gh repo create')) {
      return await this.handleRepoCreate(command);
    } else if (trimmedCommand.startsWith('gh repo clone')) {
      return await this.handleRepoClone(command);
    } else if (trimmedCommand.startsWith('gh repo view')) {
      return await this.handleRepoView(command);
    } else if (trimmedCommand.startsWith('gh issue list')) {
      return await this.handleIssueList(command);
    } else if (trimmedCommand.startsWith('gh pr list')) {
      return await this.handlePrList(command);
    } else if (githubService.parseGitHubUrl(command)) {
      return await this.handleGitHubUrl(command);
    } else {
      return {
        success: false,
        message: `Unsupported GitHub command: ${command}. Supported commands include: gh repo create, gh repo clone, gh repo view, gh issue list, gh pr list, and GitHub URLs.`
      };
    }
  }
  private async handleRepoCreate(command: string): Promise<GitHubCommandResult> {
    const match = command.match(/gh repo create (\S+)(?:\s+(.+))?/);
    if (!match) {
      return {
        success: false,
        message: 'Invalid syntax. Use: gh repo create <repo-name> [--public|--private] [--description "description"]'
      };
    }
    const repoName = match[1];
    const options = match[2] || '';
    const isPrivate = options.includes('--private');
    const descriptionMatch = options.match(/--description\s+"([^"]+)"/);
    const description = descriptionMatch ? descriptionMatch[1] : '';
    try {
      const repo = await githubService.createRepo(repoName, description, isPrivate);
      if (repo) {
        return {
          success: true,
          message: `Repository "${repoName}" created successfully!`,
          data: {
            url: repo.html_url,
            cloneUrl: repo.clone_url,
            private: repo.private
          }
        };
      } else {
        return {
          success: false,
          message: 'Failed to create repository. Make sure you\'re authenticated and the repository name is available.'
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error creating repository: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  private async handleRepoClone(command: string): Promise<GitHubCommandResult> {
    const match = command.match(/gh repo clone (\S+)/);
    if (!match) {
      return {
        success: false,
        message: 'Invalid syntax. Use: gh repo clone <owner/repo>'
      };
    }
    const repoPath = match[1];
    const [owner, repo] = repoPath.split('/');
    if (!owner || !repo) {
      return {
        success: false,
        message: 'Invalid repository format. Use: owner/repo'
      };
    }
    try {
      const repoInfo = await githubService.getRepo(owner, repo);
      if (repoInfo) {
        return {
          success: true,
          message: `Repository information for ${owner}/${repo}:`,
          data: {
            name: repoInfo.name,
            description: repoInfo.description,
            cloneUrl: repoInfo.clone_url,
            sshUrl: `git@github.com:${owner}/${repo}.git`,
            defaultBranch: repoInfo.default_branch,
            private: repoInfo.private
          }
        };
      } else {
        return {
          success: false,
          message: `Repository ${owner}/${repo} not found or you don\'t have access to it.`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error accessing repository: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  private async handleRepoView(command: string): Promise<GitHubCommandResult> {
    const match = command.match(/gh repo view (\S+)/);
    if (!match) {
      return {
        success: false,
        message: 'Invalid syntax. Use: gh repo view <owner/repo>'
      };
    }
    const repoPath = match[1];
    const [owner, repo] = repoPath.split('/');
    if (!owner || !repo) {
      return {
        success: false,
        message: 'Invalid repository format. Use: owner/repo'
      };
    }
    try {
      const repoInfo = await githubService.getRepo(owner, repo);
      if (repoInfo) {
        const user = await githubService.getUser();
        return {
          success: true,
          message: `Repository details for ${owner}/${repo}:`,
          data: {
            name: repoInfo.name,
            fullName: repoInfo.full_name,
            description: repoInfo.description,
            url: repoInfo.html_url,
            cloneUrl: repoInfo.clone_url,
            defaultBranch: repoInfo.default_branch,
            private: repoInfo.private,
            owner: repoInfo.full_name.split('/')[0],
            authenticatedUser: user?.login
          }
        };
      } else {
        return {
          success: false,
          message: `Repository ${owner}/${repo} not found or you don\'t have access to it.`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error viewing repository: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  private async handleIssueList(command: string): Promise<GitHubCommandResult> {
    const match = command.match(/gh issue list (\S+)/);
    if (!match) {
      return {
        success: false,
        message: 'Invalid syntax. Use: gh issue list <owner/repo>'
      };
    }
    const repoPath = match[1];
    const [owner, repo] = repoPath.split('/');
    return {
      success: false,
      message: `Issue listing is not yet implemented in this mobile version. You can view issues at: https://github.com/${owner}/${repo}/issues`
    };
  }
  private async handlePrList(command: string): Promise<GitHubCommandResult> {
    const match = command.match(/gh pr list (\S+)/);
    if (!match) {
      return {
        success: false,
        message: 'Invalid syntax. Use: gh pr list <owner/repo>'
      };
    }
    const repoPath = match[1];
    const [owner, repo] = repoPath.split('/');
    return {
      success: false,
      message: `Pull request listing is not yet implemented in this mobile version. You can view PRs at: https://github.com/${owner}/${repo}/pulls`
    };
  }
  private async handleGitHubUrl(url: string): Promise<GitHubCommandResult> {
    const parsed = githubService.parseGitHubUrl(url);
    if (!parsed) {
      return {
        success: false,
        message: 'Invalid GitHub URL format'
      };
    }
    const { owner, repo, path } = parsed;
    try {
      const repoInfo = await githubService.getRepo(owner, repo);
      if (!repoInfo) {
        return {
          success: false,
          message: `Repository ${owner}/${repo} not found or you don\'t have access to it.`
        };
      }
      if (path) {
        const fileContent = await githubService.getFileContent(owner, repo, path, repoInfo.default_branch);
        if (fileContent) {
          return {
            success: true,
            message: `File content for ${owner}/${repo}/${path}:`,
            data: {
              type: 'file',
              path,
              content: fileContent,
              repository: {
                name: repoInfo.name,
                url: repoInfo.html_url,
                defaultBranch: repoInfo.default_branch
              }
            }
          };
        } else {
          return {
            success: true,
            message: `Repository information for ${owner}/${repo}. File "${path}" not found or is not accessible:`,
            data: {
              type: 'repo',
              repository: {
                name: repoInfo.name,
                description: repoInfo.description,
                url: repoInfo.html_url,
                defaultBranch: repoInfo.default_branch,
                private: repoInfo.private
              }
            }
          };
        }
      } else {
        return {
          success: true,
          message: `Repository information for ${owner}/${repo}:`,
          data: {
            type: 'repo',
            repository: {
              name: repoInfo.name,
              description: repoInfo.description,
              url: repoInfo.html_url,
              cloneUrl: repoInfo.clone_url,
              defaultBranch: repoInfo.default_branch,
              private: repoInfo.private
            }
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `Error accessing GitHub resource: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  formatCommandResult(result: GitHubCommandResult): string {
    if (!result.success) {
      return `❌ ${result.message}`;
    }
    let response = `✅ ${result.message}\n\n`;
    if (result.data) {
      if (result.data.type === 'file') {
        response += `**File:** ${result.data.path}\n`;
        response += `**Repository:** ${result.data.repository.name} (${result.data.repository.url})\n\n`;
        response += `**Content:**\n\`\`\`\n${result.data.content}\n\`\`\``;
      } else if (result.data.type === 'repo' || result.data.repository) {
        const repo = result.data.repository;
        response += `**Name:** ${repo.name}\n`;
        if (repo.description) response += `**Description:** ${repo.description}\n`;
        response += `**URL:** ${repo.url}\n`;
        if (repo.cloneUrl) response += `**Clone URL:** ${repo.cloneUrl}\n`;
        response += `**Default Branch:** ${repo.defaultBranch}\n`;
        response += `**Private:** ${repo.private ? 'Yes' : 'No'}\n`;
      } else {
        if (result.data.url) response += `**URL:** ${result.data.url}\n`;
        if (result.data.cloneUrl) response += `**Clone URL:** ${result.data.cloneUrl}\n`;
        if (result.data.private !== undefined) response += `**Private:** ${result.data.private ? 'Yes' : 'No'}\n`;
      }
    }
    return response;
  }
}
export const githubCommandService = new GitHubCommandService();