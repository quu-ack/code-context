import { Command } from 'commander';
import { GitAnalyzer } from '../../analyzers/git-analyzer.js';
import { CodeAnalyzer } from '../../analyzers/code-analyzer.js';
import { ErrorAnalyzer } from '../../analyzers/error-analyzer.js';
import { GitHubAnalyzer } from '../../analyzers/github-analyzer.js';
import { ContextGenerator } from '../../generators/context-gen.js';
import { ui } from '../ui.js';
import { FileContext } from '../../types/index.js';
import * as path from 'path';
import * as fs from 'fs';

export function createWhyCommand(): Command {
  const command = new Command('why');

  command
    .description('Understand why a file or function exists')
    .argument('<target>', 'File path or function name to analyze')
    .option('--no-github', 'Skip GitHub integration')
    .option('--github-token <token>', 'GitHub token (or use GITHUB_TOKEN env var)')
    .action(async (target: string, options) => {
      try {
        const cwd = process.cwd();

        // Check if target is a file or function
        const isFile = fs.existsSync(path.resolve(cwd, target));

        if (!isFile) {
          // Try to find function
          ui.startSpinner(`Searching for function: ${target}`);

          // Add all TypeScript files in project
          const tsConfigPath = path.join(cwd, 'tsconfig.json');
          const codeAnalyzer = fs.existsSync(tsConfigPath)
            ? new CodeAnalyzer(tsConfigPath)
            : new CodeAnalyzer();

          const location = codeAnalyzer.findFunctionDefinition(target);

          if (!location) {
            ui.failSpinner(`Function "${target}" not found`);
            process.exit(1);
          }

          ui.succeedSpinner(`Found function in ${location.file}:${location.line}`);
          target = location.file;
        }

        const filePath = path.relative(cwd, path.resolve(cwd, target));

        // Start analysis
        ui.startSpinner('Analyzing file context...');

        const gitAnalyzer = new GitAnalyzer({ gitRoot: cwd });
        const codeAnalyzer = new CodeAnalyzer();
        const errorAnalyzer = new ErrorAnalyzer();

        // Add source file
        codeAnalyzer.addSourceFile(path.resolve(cwd, filePath));
        errorAnalyzer.addSourceFile(path.resolve(cwd, filePath));

        // Get git context
        const gitContext = await gitAnalyzer.analyzeFile(filePath);

        // Get code dependencies
        const codeContext = codeAnalyzer.analyzeDependencies(path.resolve(cwd, filePath));

        // Get error context
        const errorContext = errorAnalyzer.analyzeFileErrors(path.resolve(cwd, filePath));

        ui.succeedSpinner('Analysis complete!');

        // Build context object
        const context: FileContext = {
          ...gitContext,
          ...codeContext,
          errors: errorContext,
        } as FileContext;

        // Get GitHub context if enabled
        if (options.github) {
          ui.startSpinner('Fetching GitHub data...');

          const token = options.githubToken || process.env.GITHUB_TOKEN;
          if (!token) {
            ui.failSpinner('GitHub token not provided. Use --github-token or set GITHUB_TOKEN');
          } else {
            const remoteUrl = await gitAnalyzer.getRemoteUrl();
            if (remoteUrl) {
              try {
                const githubAnalyzer = new GitHubAnalyzer(token, remoteUrl);

                // Get PRs for creation commit
                const prs = await githubAnalyzer.getPRsForCommit(context.created.commit);

                // Get issues from PRs
                const issues = [];
                for (const pr of prs) {
                  const prIssues = await githubAnalyzer.getIssuesForPR(pr.number);
                  issues.push(...prIssues);
                }

                context.github = { prs, issues };
                ui.succeedSpinner('GitHub data fetched!');
              } catch (error) {
                ui.failSpinner(`GitHub error: ${error}`);
              }
            } else {
              ui.failSpinner('No GitHub remote found');
            }
          }
        }

        // Generate output
        const generator = new ContextGenerator();
        generator.generateFileContext(context);
      } catch (error) {
        ui.failSpinner();
        ui.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  return command;
}
