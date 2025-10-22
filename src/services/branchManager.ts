interface ChatBranch {
  chatId: string;
  repoName: string;
  branchName: string;
  baseBranch: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  pullRequestUrl?: string;
}

class BranchManager {
  private branches: Map<string, ChatBranch> = new Map();
  private readonly BRANCH_PREFIX = 'chat-';

  // Create a new branch for a chat session
  createChatBranch(chatId: string, repoName: string, baseBranch: string = 'main'): ChatBranch {
    const branchName = `${this.BRANCH_PREFIX}${chatId.slice(-8)}`;
    
    const chatBranch: ChatBranch = {
      chatId,
      repoName,
      branchName,
      baseBranch,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true
    };

    this.branches.set(`${chatId}-${repoName}`, chatBranch);
    
    // In a real implementation, this would:
    // 1. Create the branch in the repository
    // 2. Set up tracking
    // 3. Handle any conflicts
    
    return chatBranch;
  }

  // Get existing branch for a chat
  getChatBranch(chatId: string, repoName: string): ChatBranch | undefined {
    return this.branches.get(`${chatId}-${repoName}`);
  }

  // Get or create branch for a chat
  getOrCreateChatBranch(chatId: string, repoName: string, baseBranch: string = 'main'): ChatBranch {
    let branch = this.getChatBranch(chatId, repoName);
    if (!branch) {
      branch = this.createChatBranch(chatId, repoName, baseBranch);
    }
    return branch;
  }

  // Update activity timestamp
  updateActivity(chatId: string, repoName: string): void {
    const branch = this.getChatBranch(chatId, repoName);
    if (branch) {
      branch.lastActivity = new Date();
    }
  }

  // Deactivate a chat branch
  deactivateBranch(chatId: string, repoName: string): void {
    const branch = this.getChatBranch(chatId, repoName);
    if (branch) {
      branch.isActive = false;
    }
  }

  // Reactivate a chat branch
  reactivateBranch(chatId: string, repoName: string): void {
    const branch = this.getChatBranch(chatId, repoName);
    if (branch) {
      branch.isActive = true;
      branch.lastActivity = new Date();
    }
  }

  // Set pull request URL for a branch
  setPullRequestUrl(chatId: string, repoName: string, prUrl: string): void {
    const branch = this.getChatBranch(chatId, repoName);
    if (branch) {
      branch.pullRequestUrl = prUrl;
    }
  }

  // Get all active branches for a repository
  getActiveBranches(repoName: string): ChatBranch[] {
    return Array.from(this.branches.values())
      .filter(branch => branch.repoName === repoName && branch.isActive);
  }

  // Get all branches for a chat
  getChatBranches(chatId: string): ChatBranch[] {
    return Array.from(this.branches.values())
      .filter(branch => branch.chatId === chatId);
  }

  // Clean up old inactive branches
  cleanupOldBranches(maxAge: number = 7 * 24 * 60 * 60 * 1000): void { // 7 days default
    const now = new Date();
    const cutoff = new Date(now.getTime() - maxAge);
    
    for (const [key, branch] of this.branches.entries()) {
      if (!branch.isActive && branch.lastActivity < cutoff) {
        this.branches.delete(key);
      }
    }
  }

  // Generate branch name suggestions
  generateBranchName(chatId: string, context?: string): string {
    const baseName = `${this.BRANCH_PREFIX}${chatId.slice(-8)}`;
    
    if (context) {
      // Sanitize context for branch name
      const sanitized = context
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      if (sanitized) {
        return `${baseName}-${sanitized.slice(0, 20)}`;
      }
    }
    
    return baseName;
  }

  // Check if branch name is available
  isBranchAvailable(repoName: string, branchName: string): boolean {
    // In a real implementation, this would check the actual repository
    return !Array.from(this.branches.values())
      .some(branch => branch.repoName === repoName && branch.branchName === branchName);
  }

  // Get branch statistics
  getBranchStats(): {
    total: number;
    active: number;
    withPR: number;
    byRepo: Record<string, number>;
  } {
    const branches = Array.from(this.branches.values());
    
    return {
      total: branches.length,
      active: branches.filter(b => b.isActive).length,
      withPR: branches.filter(b => b.pullRequestUrl).length,
      byRepo: branches.reduce((acc, branch) => {
        acc[branch.repoName] = (acc[branch.repoName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  // Export branch data for backup
  exportData(): {chatId: string, repoName: string, branchName: string, isActive: boolean}[] {
    return Array.from(this.branches.values()).map(branch => ({
      chatId: branch.chatId,
      repoName: branch.repoName,
      branchName: branch.branchName,
      isActive: branch.isActive
    }));
  }

  // Import branch data from backup
  importData(data: {chatId: string, repoName: string, branchName: string, isActive: boolean}[]): void {
    for (const item of data) {
      const branch: ChatBranch = {
        ...item,
        baseBranch: 'main', // Default base branch
        createdAt: new Date(),
        lastActivity: new Date(),
        isActive: item.isActive
      };
      
      this.branches.set(`${item.chatId}-${item.repoName}`, branch);
    }
  }
}

export const branchManager = new BranchManager();
export type { ChatBranch };