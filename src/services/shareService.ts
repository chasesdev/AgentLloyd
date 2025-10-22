import { localRepoService } from './localRepoService';
import { codespaceService } from './codespaceService';
import { gistManager } from './gistManager';
import { branchManager } from './branchManager';
import { pullRequestService, PullRequestData } from './pullRequestService';

interface ShareOptions {
  mode: 'fullstack' | 'code' | 'reasoning' | 'general';
  chatId: string;
  messages: any[];
  title?: string;
  description?: string;
  repoName?: string;
  branch?: string;
}

interface ShareResult {
  type: 'pr' | 'gist' | 'link';
  url: string;
  title: string;
  description: string;
}

class ShareService {
  // Main sharing function that routes to appropriate flow
  async shareContent(options: ShareOptions): Promise<ShareResult> {
    const { mode, chatId, messages, title, description, repoName, branch } = options;

    switch (mode) {
      case 'fullstack':
        return this.shareFullStack(chatId, messages, title, description, repoName, branch);
      case 'code':
        return this.shareCode(chatId, messages, title, description, repoName, branch);
      case 'reasoning':
        return this.shareReasoning(chatId, messages, title, description);
      default:
        return this.shareGeneral(chatId, messages, title, description);
    }
  }

  // Full-Stack mode: Create PR from codespace with branch management
  private async shareFullStack(
    chatId: string,
    messages: any[],
    title?: string,
    description?: string,
    repoName?: string,
    branch?: string
  ): Promise<ShareResult> {
    try {
      if (!repoName) {
        throw new Error('Repository name required for Full-Stack mode sharing');
      }

      // Get or create codespace
      let codespace = await codespaceService.getCurrentCodespace();
      if (!codespace || codespace.repository.full_name !== repoName) {
        codespace = await codespaceService.createCodespace({
          repository: repoName,
          branch: branch
        });
      }

      // Generate branch name for this chat
      const branchName = `chat-${chatId.slice(-8)}`;
      
      // Generate content from chat messages
      const content = this.generateChatContent(messages);
      
      // Prepare pull request data
      const prData: PullRequestData = {
        title: title || `Changes from chat ${chatId.slice(-8)}`,
        description: description || `Pull request with ${messages.length} messages from Full-Stack mode\n\n${content}`,
        head: branchName,
        base: branch || 'main',
        repository: repoName,
        files: [
          {
            path: `chat-${chatId.slice(-8)}.md`,
            content: content,
            mode: '100644'
          }
        ]
      };

      // Create the pull request
      const pr = await pullRequestService.createPullRequest(prData);

      // Update branch with PR URL
      branchManager.setPullRequestUrl(chatId, repoName, pr.htmlUrl);
      
      // Store in database
      await chatDatabase.saveBranch({
        id: `pr-${pr.number}`,
        chatId,
        repository: repoName,
        branchName,
        prUrl: pr.htmlUrl,
        status: 'pr_created'
      });
      
      return {
        type: 'pr',
        url: pr.htmlUrl,
        title: pr.title,
        description: description || `Pull request with ${messages.length} messages from Full-Stack mode`
      };
    } catch (error) {
      console.error('Full-Stack share failed:', error);
      throw new Error('Failed to create pull request from codespace');
    }
  }

  // Code mode: Create PR from local tracking with branch management
  private async shareCode(
    chatId: string,
    messages: any[],
    title?: string,
    description?: string,
    repoName?: string,
    branch?: string
  ): Promise<ShareResult> {
    try {
      if (!repoName) {
        throw new Error('Repository name required for Code mode sharing');
      }

      // Get local repository tracking
      const [owner, repo] = repoName.split('/');
      const repoId = `${owner}/${repo}/${branch || 'main'}`;
      
      let localRepo = localRepoService.getRepo(repoId);
      if (!localRepo) {
        localRepo = await localRepoService.initializeLocalRepo(owner, repo, branch);
      }

      // Check if there are changes to commit
      if (!localRepoService.hasUncommittedChanges(repoId)) {
        throw new Error('No changes to commit');
      }

      // Generate branch name for this chat
      const branchName = `chat-${chatId.slice(-8)}`;
      
      // Generate content from chat messages
      const content = this.generateChatContent(messages);
      
      // Get tracked changes
      const trackedChanges = localRepoService.getTrackedChanges(repoId);
      
      // Prepare files for PR
      const files = trackedChanges.map(change => ({
        path: change.file,
        content: change.content || `# ${change.file}\n\nGenerated from chat ${chatId.slice(-8)}`,
        mode: '100644' as const
      }));
      
      // Add the chat content file
      files.push({
        path: `chat-${chatId.slice(-8)}.md`,
        content: content,
        mode: '100644'
      });

      // Prepare pull request data
      const prData: PullRequestData = {
        title: title || localRepoService.generateCommitMessage(repoId),
        description: description || `Pull request with ${trackedChanges.length} changes from Code mode\n\n${content}`,
        head: branchName,
        base: branch || 'main',
        repository: repoName,
        files
      };

      // Create the pull request
      const pr = await pullRequestService.createPullRequest(prData);

      // Update branch with PR URL
      branchManager.setPullRequestUrl(chatId, repoName, pr.htmlUrl);
      
      // Store in database
      await chatDatabase.saveBranch({
        id: `pr-${pr.number}`,
        chatId,
        repository: repoName,
        branchName,
        prUrl: pr.htmlUrl,
        status: 'pr_created'
      });
      
      // Clear tracked changes after successful commit
      localRepoService.clearChanges(repoId);
      
      return {
        type: 'pr',
        url: pr.htmlUrl,
        title: pr.title,
        description: description || `Pull request with ${trackedChanges.length} changes from Code mode`
      };
    } catch (error) {
      console.error('Code share failed:', error);
      throw new Error('Failed to create pull request from local changes');
    }
  }

  // Reasoning mode: Create/update gist with markdown formatting
  private async shareReasoning(
    chatId: string,
    messages: any[],
    title?: string,
    description?: string
  ): Promise<ShareResult> {
    try {
      // Use gistManager to create structured markdown gist
      const gist = await gistManager.createOrUpdateGist(
        chatId,
        messages,
        'planning', // Use planning template for reasoning mode
        title,
        description,
        false, // Private by default
        ['planning', 'analysis', 'reasoning']
      );
      
      return {
        type: 'gist',
        url: gist.gistUrl,
        title: gist.title,
        description: gist.description
      };
    } catch (error) {
      console.error('Reasoning share failed:', error);
      throw new Error('Failed to create planning gist');
    }
  }

  // General mode: Simple share link
  private async shareGeneral(
    chatId: string,
    messages: any[],
    title?: string,
    description?: string
  ): Promise<ShareResult> {
    // For general mode, create a simple shareable link
    // In React Native, we'll use a deep link format instead of window.location
    const shareUrl = `zai-chat://chat/${chatId}`;
    
    return {
      type: 'link',
      url: shareUrl,
      title: title || `Chat ${chatId.slice(-8)}`,
      description: description || `Share link to chat with ${messages.length} messages`
    };
  }

  // Generate formatted content from chat messages
  private generateChatContent(messages: any[]): string {
    const content = messages.map(msg => {
      const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
      const timestamp = new Date(msg.timestamp).toLocaleString();
      return `## ${role} - ${timestamp}\n\n${msg.content}\n`;
    }).join('\n---\n\n');

    return `# Chat Export\n\n${content}\n\n---\n*Generated on ${new Date().toLocaleString()}*`;
  }
}

export const shareService = new ShareService();
export type { ShareOptions, ShareResult };