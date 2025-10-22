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
    return chatBranch;
  }
  getChatBranch(chatId: string, repoName: string): ChatBranch | undefined {
    return this.branches.get(`${chatId}-${repoName}`);
  }
  getOrCreateChatBranch(chatId: string, repoName: string, baseBranch: string = 'main'): ChatBranch {
    let branch = this.getChatBranch(chatId, repoName);
    if (!branch) {
      branch = this.createChatBranch(chatId, repoName, baseBranch);
    }
    return branch;
  }
  updateActivity(chatId: string, repoName: string): void {
    const branch = this.getChatBranch(chatId, repoName);
    if (branch) {
      branch.lastActivity = new Date();
    }
  }
  deactivateBranch(chatId: string, repoName: string): void {
    const branch = this.getChatBranch(chatId, repoName);
    if (branch) {
      branch.isActive = false;
    }
  }
  reactivateBranch(chatId: string, repoName: string): void {
    const branch = this.getChatBranch(chatId, repoName);
    if (branch) {
      branch.isActive = true;
      branch.lastActivity = new Date();
    }
  }
  setPullRequestUrl(chatId: string, repoName: string, prUrl: string): void {
    const branch = this.getChatBranch(chatId, repoName);
    if (branch) {
      branch.pullRequestUrl = prUrl;
    }
  }
  getActiveBranches(repoName: string): ChatBranch[] {
    return Array.from(this.branches.values())
      .filter(branch => branch.repoName === repoName && branch.isActive);
  }
  getChatBranches(chatId: string): ChatBranch[] {
    return Array.from(this.branches.values())
      .filter(branch => branch.chatId === chatId);
  }
  cleanupOldBranches(maxAge: number = 7 * 24 * 60 * 60 * 1000): void { 
    const now = new Date();
    const cutoff = new Date(now.getTime() - maxAge);
    for (const [key, branch] of this.branches.entries()) {
      if (!branch.isActive && branch.lastActivity < cutoff) {
        this.branches.delete(key);
      }
    }
  }
  generateBranchName(chatId: string, context?: string): string {
    const baseName = `${this.BRANCH_PREFIX}${chatId.slice(-8)}`;
    if (context) {
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
  isBranchAvailable(repoName: string, branchName: string): boolean {
    return !Array.from(this.branches.values())
      .some(branch => branch.repoName === repoName && branch.branchName === branchName);
  }
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
  exportData(): {chatId: string, repoName: string, branchName: string, isActive: boolean}[] {
    return Array.from(this.branches.values()).map(branch => ({
      chatId: branch.chatId,
      repoName: branch.repoName,
      branchName: branch.branchName,
      isActive: branch.isActive
    }));
  }
  importData(data: {chatId: string, repoName: string, branchName: string, isActive: boolean}[]): void {
    for (const item of data) {
      const branch: ChatBranch = {
        ...item,
        baseBranch: 'main', 
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