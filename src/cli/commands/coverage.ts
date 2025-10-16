import { Command } from 'commander';
import { ErrorAnalyzer } from '../../analyzers/error-analyzer.js';
import { ContextGenerator } from '../../generators/context-gen.js';
import { ui } from '../ui.js';
import * as path from 'path';
import * as fs from 'fs';
import { glob } from 'glob';

export function createCoverageCommand(): Command {
  const command = new Command('coverage');

  command
    .description('Generate error coverage report for the project')
    .action(async () => {
      try {
        const cwd = process.cwd();

        ui.startSpinner('Analyzing error coverage...');

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

        // Generate coverage report
        const report = errorAnalyzer.generateCoverageReport();

        ui.succeedSpinner('Coverage analysis complete!');

        // Generate output
        const generator = new ContextGenerator();
        generator.generateCoverageReport(report);
      } catch (error) {
        ui.failSpinner();
        ui.error(`Error: ${error}`);
        process.exit(1);
      }
    });

  return command;
}
