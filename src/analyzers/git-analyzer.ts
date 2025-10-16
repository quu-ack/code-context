import { simpleGit, SimpleGit, LogResult } from 'simple-git';
import { AnalyzerConfig, FileContext } from '../types/index.js';

export class GitAnalyzer {
  private git: SimpleGit;
  private config: AnalyzerConfig;

  constructor(config: AnalyzerConfig) {
    this.config = config;
    this.git = simpleGit(config.gitRoot);
  }

  async analyzeFile(filePath: string): Promise<Partial<FileContext>> {
    try {
      // Get file creation info
      const creationLog = await this.git.log({
        file: filePath,
        maxCount: 1,
        '--diff-filter': 'A', // Added files only
      });

      // Get last modification info
      const lastModLog = await this.git.log({
        file: filePath,
        maxCount: 1,
      });

      // Count lines of code
      const fileContent = await this.git.show([`HEAD:${filePath}`]);
      const linesOfCode = fileContent.split('\n').length;

      const created = creationLog.latest;
      const lastModified = lastModLog.latest;

      if (!created || !lastModified) {
        throw new Error(`Could not find git history for ${filePath}`);
      }

      return {
        path: filePath,
        created: {
          date: new Date(created.date),
          author: created.author_name,
          commit: created.hash,
          message: created.message,
        },
        lastModified: {
          date: new Date(lastModified.date),
          author: lastModified.author_name,
          commit: lastModified.hash,
          message: lastModified.message,
        },
        linesOfCode,
      };
    } catch (error) {
      throw new Error(`Failed to analyze git history for ${filePath}: ${error}`);
    }
  }

  async getFileHistory(filePath: string, maxCount = 10): Promise<LogResult> {
    return await this.git.log({
      file: filePath,
      maxCount,
    });
  }

  async getCommitsBetween(from: string, to: string): Promise<LogResult> {
    return await this.git.log({ from, to });
  }

  async getCurrentBranch(): Promise<string> {
    const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  }

  async getRemoteUrl(): Promise<string | null> {
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      return origin?.refs?.fetch || null;
    } catch {
      return null;
    }
  }
}
