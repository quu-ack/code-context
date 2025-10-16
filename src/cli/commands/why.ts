import { Command } from 'commander';
import { GitAnalyzer } from '../../analyzers/git-analyzer.js';
import { CodeAnalyzer } from '../../analyzers/code-analyzer.js';
import { ErrorAnalyzer } from '../../analyzers/error-analyzer.js';
import { GitHubAnalyzer } from '../../analyzers/github-analyzer.js';
import { AIAnalyzer } from '../../analyzers/ai-analyzer.js';
import { ContextGenerator } from '../../generators/context-gen.js';
import { CacheManager } from '../../utils/cache.js';
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
    .option('--no-ai', 'Skip AI context generation')
    .option('--ai-provider <provider>', 'AI provider: anthropic or openai (default: anthropic)')
    .option('--anthropic-key <key>', 'Anthropic API key (or use ANTHROPIC_API_KEY env var)')
    .option('--openai-key <key>', 'OpenAI API key (or use OPENAI_API_KEY env var)')
    .option('--ai-model <model>', 'AI model to use (default: claude-3-5-sonnet or gpt-4o-mini)')
    .option('--no-cache', 'Skip cache and regenerate AI context')
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

        // Generate AI context if enabled
        let aiContext;
        if (options.ai !== false) {
          // Determine provider and API key
          const provider = (options.aiProvider || 'anthropic') as 'anthropic' | 'openai';
          const anthropicKey = options.anthropicKey || process.env.ANTHROPIC_API_KEY;
          const openaiKey = options.openaiKey || process.env.OPENAI_API_KEY;

          const apiKey = provider === 'anthropic' ? anthropicKey : openaiKey;

          if (!apiKey) {
            const providerName = provider === 'anthropic' ? 'Anthropic' : 'OpenAI';
            const envVar = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';
            ui.warning(`${providerName} API key not provided. Skipping AI analysis. Use --${provider}-key or set ${envVar}`);
          } else {
            const cacheManager = new CacheManager();
            const absolutePath = path.resolve(cwd, filePath);

            // Try to get from cache first
            if (options.cache !== false) {
              ui.startSpinner('Checking cache...');
              aiContext = await cacheManager.get(absolutePath);

              if (aiContext) {
                ui.succeedSpinner('AI context loaded from cache!');
              }
            }

            // Generate AI context if not in cache
            if (!aiContext) {
              const providerName = provider === 'anthropic' ? 'Claude' : 'GPT';
              ui.startSpinner(`Generating AI context with ${providerName} (this may take a few seconds)...`);

              try {
                const aiAnalyzer = new AIAnalyzer(apiKey, provider, options.aiModel);

                // Read file content for AI analysis
                const fileContent = fs.readFileSync(absolutePath, 'utf-8');

                aiContext = await aiAnalyzer.generateContext(context, fileContent);

                // Cache the result
                if (options.cache !== false) {
                  await cacheManager.set(absolutePath, aiContext);
                }

                ui.succeedSpinner('AI context generated!');
              } catch (error) {
                ui.failSpinner(`AI analysis failed: ${error}`);
              }
            }
          }
        }

        // Generate output
        const generator = new ContextGenerator();
        generator.generateFileContext(context, aiContext || undefined);
      } catch (error) {
        ui.failSpinner();
        ui.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  return command;
}
