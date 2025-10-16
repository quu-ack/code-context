#!/usr/bin/env node

import { Command } from 'commander';
import { createWhyCommand } from './commands/why.js';
import { createErrorsCommand } from './commands/errors.js';
import { createCoverageCommand } from './commands/coverage.js';
import { createDocsCommand } from './commands/docs.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('code-context')
  .description('Auto-documentation tool that tracks why your code exists')
  .version('0.1.0');

// ASCII art banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════╗')}
${chalk.cyan('║')}     ${chalk.bold.white('code-context')}                  ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Understand why your code exists')} ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════╝')}
`;

program.addHelpText('beforeAll', banner);

// Add commands
program.addCommand(createWhyCommand());
program.addCommand(createErrorsCommand());
program.addCommand(createCoverageCommand());
program.addCommand(createDocsCommand());

// Examples
program.addHelpText(
  'after',
  `
${chalk.bold('Examples:')}
  ${chalk.gray('# Understand a file')}
  $ code-context why src/auth.ts

  ${chalk.gray('# Understand a function')}
  $ code-context why login

  ${chalk.gray('# Track error flow')}
  $ code-context errors LoginError

  ${chalk.gray('# Check error coverage')}
  $ code-context coverage

  ${chalk.gray('# Generate markdown docs')}
  $ code-context docs --output docs/context

${chalk.bold('Environment Variables:')}
  ${chalk.cyan('ANTHROPIC_API_KEY')}  Anthropic API key for AI context (or OPENAI_API_KEY)
  ${chalk.cyan('GITHUB_TOKEN')}       GitHub personal access token for PR/issue integration
`
);

program.parse();
