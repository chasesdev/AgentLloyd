import { SecureStorage } from '../utils/secureStorage';
import { githubService } from './githubService';
import { chatDatabase } from './chatDatabase';

export interface PullRequestData {
  title: string;
  description: string;
  head: string; // branch name with changes
  base: string; // target branch (usually main/master)
  repository: string; // owner/repo format
  files?: {
    path: string;
    content: string;
    mode?: '100644' | '100755' | '040000'; // file mode
  }[];
}

export interface PullRequestResult {
  number: number;
  url: string;
  htmlUrl: string;
  title: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: Date;
  updatedAt: Date;
}

export class PullRequestService {
  /**
   * Create a pull request with file changes
   */
  async createPullRequest(data: PullRequestData): Promise<PullRequestResult> {
    try {
      if (!githubService.isAuthenticated()) {
        throw new Error('GitHub authentication required');
      }

      const token = await SecureStorage.getApiKey('github_token');
      if (!token) {
        throw new Error('GitHub token not found');
      }

      const [owner, repo] = data.repository.split('/');

      // Step 1: Get the base branch reference
      const baseBranchRef = await this.getBranchReference(owner, repo, data.base);
      if (!baseBranchRef) {
        throw new Error(`Base branch '${data.base}' not found`);
      }

      // Step 2: Create or update the head branch
      await this.createOrUpdateBranch(owner, repo, data.head, baseBranchRef.object.sha);

      // Step 3: Create/update files in the head branch
      if (data.files && data.files.length > 0) {
        await this.createOrUpdateFiles(owner, repo, data.head, data.files);
      }

      // Step 4: Create the pull request
      const pr = await this.createPullRequestAPI(owner, repo, {
        title: data.title,
        body: data.description,
        head: data.head,
        base: data.base
      });

      // Step 5: Store PR information in database
      await this.storePullRequestInfo(data.repository, pr, data.head);

      return {
        number: pr.number,
        url: pr.url,
        htmlUrl: pr.html_url,
        title: pr.title,
        state: pr.state,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at)
      };

    } catch (error) {
      console.error('Failed to create pull request:', error);
      throw error;
    }
  }

  /**
   * Get branch reference from GitHub API
   */
  private async getBranchReference(owner: string, repo: string, branch: string): Promise<any> {
    const token = await SecureStorage.getApiKey('github_token');
    if (!token) throw new Error('GitHub token not found');

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to get branch reference: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Create or update a branch
   */
  private async createOrUpdateBranch(
    owner: string, 
    repo: string, 
    branchName: string, 
    baseSha: string
  ): Promise<void> {
    const token = await SecureStorage.getApiKey('github_token');
    if (!token) throw new Error('GitHub token not found');

    // Try to get existing branch
    const existingBranch = await this.getBranchReference(owner, repo, branchName);

    if (existingBranch) {
      // Update existing branch
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branchName}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sha: baseSha,
            force: false
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to update branch: ${errorData.message || response.statusText}`);
      }
    } else {
      // Create new branch
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: `refs/heads/${branchName}`,
            sha: baseSha
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to create branch: ${errorData.message || response.statusText}`);
      }
    }

    console.log(`Branch '${branchName}' created/updated successfully`);
  }

  /**
   * Create or update files in a branch
   */
  private async createOrUpdateFiles(
    owner: string,
    repo: string,
    branch: string,
    files: { path: string; content: string; mode?: string }[]
  ): Promise<void> {
    const token = await SecureStorage.getApiKey('github_token');
    if (!token) throw new Error('GitHub token not found');

    for (const file of files) {
      // First, get the current file SHA if it exists
      let fileSha: string | undefined;
      
      try {
        const getFileResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`,
          {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            }
          }
        );

        if (getFileResponse.ok) {
          const fileData = await getFileResponse.json();
          fileSha = fileData.sha;
        }
      } catch (error) {
        // File doesn't exist, which is fine
        console.log(`File '${file.path}' does not exist, will create new`);
      }

      // Create or update the file
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        {
          method: fileSha ? 'PUT' : 'POST',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Update ${file.path}`,
            content: btoa(file.content), // Base64 encode content
            sha: fileSha,
            branch: branch
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to create/update file '${file.path}': ${errorData.message || response.statusText}`);
      }

      console.log(`File '${file.path}' created/updated successfully`);
    }
  }

  /**
   * Create pull request via GitHub API
   */
  private async createPullRequestAPI(
    owner: string,
    repo: string,
    data: {
      title: string;
      body: string;
      head: string;
      base: string;
    }
  ): Promise<any> {
    const token = await SecureStorage.getApiKey('github_token');
    if (!token) throw new Error('GitHub token not found');

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: data.title,
          body: data.body,
          head: data.head,
          base: data.base,
          draft: false
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to create pull request: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Store pull request information in database
   */
  private async storePullRequestInfo(
    repository: string,
    pr: any,
    branchName: string
  ): Promise<void> {
    try {
      await chatDatabase.saveBranch({
        id: `pr-${pr.number}`,
        chatId: '', // Will be filled by the calling service
        repository,
        branchName,
        prUrl: pr.html_url,
        status: 'pr_created'
      });
    } catch (error) {
      console.error('Failed to store PR info:', error);
      // Don't throw here as PR was created successfully
    }
  }

  /**
   * Get pull request status
   */
  async getPullRequestStatus(owner: string, repo: string, prNumber: number): Promise<PullRequestResult | null> {
    try {
      const token = await SecureStorage.getApiKey('github_token');
      if (!token) throw new Error('GitHub token not found');

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get pull request: ${errorData.message || response.statusText}`);
      }

      const pr = await response.json();

      return {
        number: pr.number,
        url: pr.url,
        htmlUrl: pr.html_url,
        title: pr.title,
        state: pr.state,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at)
      };

    } catch (error) {
      console.error('Failed to get pull request status:', error);
      throw error;
    }
  }

  /**
   * Merge a pull request
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    mergeMethod: 'merge' | 'squash' | 'rebase' = 'merge'
  ): Promise<{ merged: boolean; message: string }> {
    try {
      const token = await SecureStorage.getApiKey('github_token');
      if (!token) throw new Error('GitHub token not found');

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            merge_method: mergeMethod
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to merge pull request: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      return {
        merged: result.merged,
        message: result.message
      };

    } catch (error) {
      console.error('Failed to merge pull request:', error);
      throw error;
    }
  }

  /**
   * List pull requests for a repository
   */
  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<PullRequestResult[]> {
    try {
      const token = await SecureStorage.getApiKey('github_token');
      if (!token) throw new Error('GitHub token not found');

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to list pull requests: ${errorData.message || response.statusText}`);
      }

      const prs = await response.json();

      return prs.map((pr: any) => ({
        number: pr.number,
        url: pr.url,
        htmlUrl: pr.html_url,
        title: pr.title,
        state: pr.state,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at)
      }));

    } catch (error) {
      console.error('Failed to list pull requests:', error);
      throw error;
    }
  }
}

export const pullRequestService = new PullRequestService();