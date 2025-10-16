import { Command } from 'commander';
import { GitAnalyzer } from '../../analyzers/git-analyzer.js';
import { CodeAnalyzer } from '../../analyzers/code-analyzer.js';
import { ErrorAnalyzer } from '../../analyzers/error-analyzer.js';
import { GitHubAnalyzer } from '../../analyzers/github-analyzer.js';
import { AIAnalyzer } from '../../analyzers/ai-analyzer.js';
import { MarkdownGenerator } from '../../generators/markdown-gen.js';
import { CacheManager } from '../../utils/cache.js';
import { ui } from '../ui.js';
import { FileContext } from '../../types/index.js';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

export function createDocsCommand(): Command {
  const command = new Command('docs');

  command
    .description('Generate markdown documentation for your codebase')
    .option('-o, --output <dir>', 'Output directory (default: docs/context)')
    .option('-p, --pattern <pattern>', 'Glob pattern for files to document (default: src/**/*.ts)', 'src/**/*.ts')
    .option('--no-github', 'Skip GitHub integration')
    .option('--github-token <token>', 'GitHub token (or use GITHUB_TOKEN env var)')
    .option('--no-ai', 'Skip AI context generation')
    .option('--ai-provider <provider>', 'AI provider: anthropic or openai (default: anthropic)')
    .option('--anthropic-key <key>', 'Anthropic API key (or use ANTHROPIC_API_KEY env var)')
    .option('--openai-key <key>', 'OpenAI API key (or use OPENAI_API_KEY env var)')
    .option('--ai-model <model>', 'AI model to use')
    .option('--no-cache', 'Skip cache and regenerate AI context')
    .option('--limit <number>', 'Limit number of files to process (for testing)', parseInt)
    .action(async (options) => {
      try {
        const cwd = process.cwd();
        const outputDir = path.resolve(cwd, options.output || 'docs/context');

        ui.header('📚 Generating Documentation');
        ui.newline();

        // Find files to document
        ui.startSpinner('Finding files...');
        const files = await glob(options.pattern, {
          cwd,
          ignore: ['node_modules/**', 'dist/**', '**/*.test.ts', '**/*.spec.ts'],
        });

        const filesToProcess = options.limit ? files.slice(0, options.limit) : files;

        ui.succeedSpinner(`Found ${filesToProcess.length} files to document`);

        // Setup analyzers
        const gitAnalyzer = new GitAnalyzer({ gitRoot: cwd });
        const codeAnalyzer = new CodeAnalyzer();
        const errorAnalyzer = new ErrorAnalyzer();
        const markdownGenerator = new MarkdownGenerator();
        const cacheManager = new CacheManager();

        // Setup AI if enabled
        let aiAnalyzer;
        if (options.ai !== false) {
          const provider = (options.aiProvider || 'anthropic') as 'anthropic' | 'openai';
          const anthropicKey = options.anthropicKey || process.env.ANTHROPIC_API_KEY;
          const openaiKey = options.openaiKey || process.env.OPENAI_API_KEY;
          const apiKey = provider === 'anthropic' ? anthropicKey : openaiKey;

          if (apiKey) {
            aiAnalyzer = new AIAnalyzer(apiKey, provider, options.aiModel);
          } else {
            const providerName = provider === 'anthropic' ? 'Anthropic' : 'OpenAI';
            ui.warning(`${providerName} API key not provided. Generating docs without AI context.`);
          }
        }

        // Setup GitHub if enabled
        let githubAnalyzer;
        if (options.github) {
          const token = options.githubToken || process.env.GITHUB_TOKEN;
          if (token) {
            const remoteUrl = await gitAnalyzer.getRemoteUrl();
            if (remoteUrl) {
              githubAnalyzer = new GitHubAnalyzer(token, remoteUrl);
            }
          }
        }

        // Process each file
        const generatedFiles: string[] = [];
        let processed = 0;

        for (const file of filesToProcess) {
          try {
            processed++;
            ui.startSpinner(`Processing ${file} (${processed}/${filesToProcess.length})...`);

            const filePath = path.relative(cwd, path.resolve(cwd, file));
            const absolutePath = path.resolve(cwd, filePath);

            // Get git context
            const gitContext = await gitAnalyzer.analyzeFile(filePath);

            // Get code dependencies
            codeAnalyzer.addSourceFile(absolutePath);
            const codeContext = codeAnalyzer.analyzeDependencies(absolutePath);

            // Get error context
            errorAnalyzer.addSourceFile(absolutePath);
            const errorContext = errorAnalyzer.analyzeFileErrors(absolutePath);

            // Build context
            const context: FileContext = {
              ...gitContext,
              ...codeContext,
              errors: errorContext,
            } as FileContext;

            // Get GitHub context
            if (githubAnalyzer) {
              try {
                const prs = await githubAnalyzer.getPRsForCommit(context.created.commit);
                const issues = [];
                for (const pr of prs) {
                  const prIssues = await githubAnalyzer.getIssuesForPR(pr.number);
                  issues.push(...prIssues);
                }
                context.github = { prs, issues };
              } catch {
                // Ignore GitHub errors
              }
            }

            // Get AI context
            let aiContext;
            if (aiAnalyzer) {
              // Try cache first
              if (options.cache !== false) {
                aiContext = await cacheManager.get(absolutePath);
              }

              // Generate if not cached
              if (!aiContext) {
                try {
                  const fileContent = fs.readFileSync(absolutePath, 'utf-8');
                  aiContext = await aiAnalyzer.generateContext(context, fileContent);

                  // Cache result
                  if (options.cache !== false) {
                    await cacheManager.set(absolutePath, aiContext);
                  }
                } catch (error) {
                  ui.warning(`AI analysis failed for ${file}: ${error}`);
                }
              }
            }

            // Generate markdown
            const outputPath = await markdownGenerator.writeMarkdown(
              outputDir,
              context,
              aiContext || undefined
            );

            generatedFiles.push(path.relative(outputDir, outputPath));
            ui.succeedSpinner(`Generated ${path.basename(outputPath)}`);
          } catch (error) {
            ui.failSpinner(`Failed to process ${file}: ${error}`);
          }
        }

        // Generate index
        ui.startSpinner('Generating index...');
        await markdownGenerator.generateIndex(outputDir, generatedFiles);
        ui.succeedSpinner('Index generated!');

        ui.newline();
        ui.success(`✨ Documentation generated in ${outputDir}`);
        ui.info('Files', generatedFiles.length.toString());
        ui.newline();
      } catch (error) {
        ui.failSpinner();
        ui.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  return command;
}
