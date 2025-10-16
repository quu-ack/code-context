import { Command } from 'commander';
import { ErrorAnalyzer } from '../../analyzers/error-analyzer.js';
import { ContextGenerator } from '../../generators/context-gen.js';
import { ui } from '../ui.js';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

export function createErrorsCommand(): Command {
  const command = new Command('errors');

  command
    .description('Analyze error flow for a specific typed error')
    .argument('<errorName>', 'Name of the error class to analyze')
    .action(async (errorName: string) => {
      try {
        const cwd = process.cwd();

        ui.startSpinner(`Analyzing error flow for ${errorName}...`);

        // Find tsconfig
        const tsConfigPath = path.join(cwd, 'tsconfig.json');
        const errorAnalyzer = fs.existsSync(tsConfigPath)
          ? new ErrorAnalyzer(tsConfigPath)
          : new ErrorAnalyzer();

        // Add all TypeScript files
        const tsFiles = await glob('**/*.ts', {
          cwd,
          ignore: ['node_modules/**', 'dist/**', '**/*.test.ts', '**/*.spec.ts'],
        });

        tsFiles.forEach(file => {
          errorAnalyzer.addSourceFile(path.resolve(cwd, file));
        });

        // Analyze error flow
        const flow = errorAnalyzer.analyzeErrorFlow(errorName);

        ui.succeedSpinner('Analysis complete!');

        // Generate output
        const generator = new ContextGenerator();
        generator.generateErrorFlow(flow);
      } catch (error) {
        ui.failSpinner();
        ui.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  return command;
}
