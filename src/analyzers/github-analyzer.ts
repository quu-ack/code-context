import { Octokit } from '@octokit/rest';
import { PullRequest, Issue } from '../types/index.js';

export class GitHubAnalyzer {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, repoUrl: string) {
    this.octokit = new Octokit({ auth: token });
    const parsed = this.parseGitHubUrl(repoUrl);
    this.owner = parsed.owner;
    this.repo = parsed.repo;
  }

  private parseGitHubUrl(url: string): { owner: string; repo: string } {
    // Handle various GitHub URL formats
    // git@github.com:user/repo.git
    // https://github.com/user/repo.git
    // https://github.com/user/repo
    const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (!match) {
      throw new Error(`Invalid GitHub URL: ${url}`);
    }
    return {
      owner: match[1],
      repo: match[2],
    };
  }

  async getPRsForCommit(commitSha: string): Promise<PullRequest[]> {
    try {
      const { data } = await this.octokit.repos.listPullRequestsAssociatedWithCommit({
        owner: this.owner,
        repo: this.repo,
        commit_sha: commitSha,
      });

      return data.map(pr => ({
        number: pr.number,
        title: pr.title,
        url: pr.html_url,
        author: pr.user?.login || 'unknown',
        mergedAt: pr.merged_at ? new Date(pr.merged_at) : new Date(),
      }));
    } catch (error) {
      console.warn(`Failed to fetch PRs for commit ${commitSha}:`, error);
      return [];
    }
  }

  async getIssuesForPR(prNumber: number): Promise<Issue[]> {
    try {
      const { data: pr } = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
      });

      // Parse issue references from PR body and title
      const issueNumbers = this.extractIssueNumbers(pr.body || '' + pr.title);

      const issues: Issue[] = [];
      for (const issueNumber of issueNumbers) {
        try {
          const { data: issue } = await this.octokit.issues.get({
            owner: this.owner,
            repo: this.repo,
            issue_number: issueNumber,
          });

          issues.push({
            number: issue.number,
            title: issue.title,
            url: issue.html_url,
            state: issue.state as 'open' | 'closed',
          });
        } catch {
          // Issue might not exist or be inaccessible
          continue;
        }
      }

      return issues;
    } catch (error) {
      console.warn(`Failed to fetch issues for PR #${prNumber}:`, error);
      return [];
    }
  }

  private extractIssueNumbers(text: string): number[] {
    // Match patterns like: #123, fixes #123, closes #123, resolves #123
    const matches = text.match(/#(\d+)/g);
    if (!matches) return [];

    return [...new Set(matches.map(m => parseInt(m.substring(1))))];
  }

  async getCommitDetails(commitSha: string) {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner: this.owner,
        repo: this.repo,
        ref: commitSha,
      });

      return {
        sha: data.sha,
        message: data.commit.message,
        author: data.commit.author?.name || 'unknown',
        date: new Date(data.commit.author?.date || Date.now()),
        url: data.html_url,
        filesChanged: data.files?.length || 0,
      };
    } catch (error) {
      console.warn(`Failed to fetch commit details for ${commitSha}:`, error);
      return null;
    }
  }

  async searchIssues(query: string): Promise<Issue[]> {
    try {
      const { data } = await this.octokit.search.issuesAndPullRequests({
        q: `${query} repo:${this.owner}/${this.repo}`,
      });

      return data.items
        .filter(item => !item.pull_request) // Exclude PRs
        .map(issue => ({
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state as 'open' | 'closed',
        }));
    } catch (error) {
      console.warn(`Failed to search issues with query "${query}":`, error);
      return [];
    }
  }
}
