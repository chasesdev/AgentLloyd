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
  async initializeLocalRepo(owner: string, repo: string, branch: string = 'main'): Promise<LocalRepo> {
    const repoId = `${owner}/${repo}/${branch}`;
    if (this.repos.has(repoId)) {
      return this.repos.get(repoId)!;
    }
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
    return localRepo;
  }
  trackChange(repoId: string, change: Omit<RepoChange, 'timestamp'>): void {
    const fullChange: RepoChange = {
      ...change,
      timestamp: new Date()
    };
    const changes = this.changes.get(repoId) || [];
    changes.push(fullChange);
    this.changes.set(repoId, changes);
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.changes.push(`${change.type}: ${change.file}`);
      repo.lastSync = new Date();
    }
  }
  getTrackedChanges(repoId: string): RepoChange[] {
    return this.changes.get(repoId) || [];
  }
  getRepo(repoId: string): LocalRepo | undefined {
    return this.repos.get(repoId);
  }
  getAllRepos(): LocalRepo[] {
    return Array.from(this.repos.values());
  }
  stopTracking(repoId: string): void {
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.isTracking = false;
    }
  }
  resumeTracking(repoId: string): void {
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.isTracking = true;
    }
  }
  clearChanges(repoId: string): void {
    this.changes.set(repoId, []);
    const repo = this.repos.get(repoId);
    if (repo) {
      repo.changes = [];
    }
  }
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
  hasUncommittedChanges(repoId: string): boolean {
    return this.getTrackedChanges(repoId).length > 0;
  }
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
    if (fileTypes.size === 1) {
      const fileType = Array.from(fileTypes)[0];
      message += ` (${fileType})`;
    }
    return message;
  }
}
export const localRepoService = new LocalRepoService();
export type { LocalRepo, RepoChange };