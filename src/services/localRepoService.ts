interface LocalRepo {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  localPath: string;
  lastSync: Date;
  isTracking: boolean;
  changes: string[];
}

interface RepoChange {
  type: 'added' | 'modified' | 'deleted';
  file: string;
  content?: string;
  timestamp: Date;
}

class LocalRepoService {
  private repos: Map<string, LocalRepo> = new Map();
  private changes: Map<string, RepoChange[]> = new Map();

  // Initialize local tracking for a repository
  async initializeLocalRepo(owner: string, repo: string, branch: string = 'main'): Promise<LocalRepo> {
    const repoId = `${owner}/${repo}/${branch}`;
    
    // Check if already tracking
    if (this.repos.has(repoId)) {
      return this.repos.get(repoId)!;
    }

    // Create local repo entry
    const localRepo: LocalRepo = {
      id: repoId,
      owner,
      repo,
      branch,
      localPath: `/local/${owner}/${repo}`,
      lastSync: new Date(),
      isTracking: true,
      changes: []
    };

    this.repos.set(repoId, localRepo);
    this.changes.set(repoId, []);

    // In a real implementation, this would:
    // 1. Clone the repository locally
    // 2. Set up file watchers
    // 3. Initialize git tracking
    
    return localRepo;
  }

  // Track a change in the local repository
  trackChange(repoId: string, change: Omit<RepoChange, 'timestamp'>): void {
    const fullChange: RepoChange = {
      ...change,
      timestamp: new Date()
    };

    const changes = this.changes.get(repoId) || [];
    changes.push(fullChange);
    this.changes.set(repoId, changes);

    // Update the repo's changes list
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.changes.push(`${change.type}: ${change.file}`);
      repo.lastSync = new Date();
    }
  }

  // Get all tracked changes for a repository
  getTrackedChanges(repoId: string): RepoChange[] {
    return this.changes.get(repoId) || [];
  }

  // Get repository information
  getRepo(repoId: string): LocalRepo | undefined {
    return this.repos.get(repoId);
  }

  // Get all tracked repositories
  getAllRepos(): LocalRepo[] {
    return Array.from(this.repos.values());
  }

  // Stop tracking a repository
  stopTracking(repoId: string): void {
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.isTracking = false;
    }
  }

  // Resume tracking a repository
  resumeTracking(repoId: string): void {
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.isTracking = true;
    }
  }

  // Clear all changes for a repository
  clearChanges(repoId: string): void {
    this.changes.set(repoId, []);
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.changes = [];
    }
  }

  // Generate a summary of changes
  generateChangeSummary(repoId: string): string {
    const changes = this.getTrackedChanges(repoId);
    if (changes.length === 0) {
      return 'No changes tracked';
    }

    const summary = changes.map(change => {
      const time = change.timestamp.toLocaleTimeString();
      return `${time} - ${change.type.toUpperCase()}: ${change.file}`;
    }).join('\n');

    return `Tracked Changes (${changes.length}):\n${summary}`;
  }

  // Check if repository has uncommitted changes
  hasUncommittedChanges(repoId: string): boolean {
    return this.getTrackedChanges(repoId).length > 0;
  }

  // Create a commit message based on changes
  generateCommitMessage(repoId: string): string {
    const changes = this.getTrackedChanges(repoId);
    if (changes.length === 0) {
      return 'No changes to commit';
    }

    const fileTypes = new Set(changes.map(c => c.file.split('.').pop()));
    const changeTypes = new Set(changes.map(c => c.type));

    let message = '';
    
    if (changeTypes.has('added') && changeTypes.size === 1) {
      message = `Add ${changes.length} file${changes.length > 1 ? 's' : ''}`;
    } else if (changeTypes.has('modified') && changeTypes.size === 1) {
      message = `Update ${changes.length} file${changes.length > 1 ? 's' : ''}`;
    } else {
      message = `Commit ${changes.length} change${changes.length > 1 ? 's' : ''}`;
    }

    // Add file type context if available
    if (fileTypes.size === 1) {
      const fileType = Array.from(fileTypes)[0];
      message += ` (${fileType})`;
    }

    return message;
  }
}

export const localRepoService = new LocalRepoService();
export type { LocalRepo, RepoChange };