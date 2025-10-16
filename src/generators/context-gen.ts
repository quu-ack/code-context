import { FileContext, ErrorFlow, CoverageReport } from '../types/index.js';
import { AIContext } from '../analyzers/ai-analyzer.js';
import chalk from 'chalk';
import { ui } from '../cli/ui.js';

export class ContextGenerator {
  generateFileContext(context: FileContext, aiContext?: AIContext): void {
    // Show AI context first if available
    if (aiContext) {
      this.generateAIContext(aiContext);
      ui.divider();
      ui.newline();
    }

    this.generateRawContext(context);
  }

  private generateAIContext(aiContext: AIContext): void {
    ui.header('🤖 AI Context Summary');
    ui.newline();

    // Summary
    console.log(chalk.white(aiContext.summary));
    ui.newline();

    // Purpose
    ui.section('🎯 Purpose');
    console.log(chalk.gray(aiContext.purpose));
    ui.newline();

    // Impact
    ui.section('📊 Impact');
    console.log(chalk.gray(aiContext.impact));
    ui.newline();

    // Warnings
    if (aiContext.warnings && aiContext.warnings.length > 0) {
      ui.section('⚠️  Watch Out');
      aiContext.warnings.forEach(warning => {
        console.log(chalk.yellow('  •'), warning);
      });
      ui.newline();
    }

    // Related context
    if (aiContext.relatedContext && aiContext.relatedContext.length > 0) {
      ui.section('💡 Related Context');
      aiContext.relatedContext.forEach(ctx => {
        console.log(chalk.gray('  •'), ctx);
      });
      ui.newline();
    }
  }

  private generateRawContext(context: FileContext): void {
    ui.header(`🔍 Context for ${context.path}`);
    ui.newline();

    // Creation info
    ui.section('📅 Created');
    ui.info('Date', context.created.date.toLocaleDateString());
    ui.info('Author', context.created.author);
    ui.info('Why', context.created.message);
    ui.info('Commit', context.created.commit.substring(0, 7));

    // Last modified
    ui.section('✏️  Last Modified');
    ui.info('Date', context.lastModified.date.toLocaleDateString());
    ui.info('Author', context.lastModified.author);
    ui.info('Changes', context.lastModified.message);

    // GitHub info
    if (context.github) {
      if (context.github.prs.length > 0) {
        ui.section('🔀 Related Pull Requests');
        context.github.prs.forEach(pr => {
          console.log(chalk.gray('  •'), chalk.cyan(`#${pr.number}`), pr.title);
          console.log(chalk.gray('    '), chalk.blue(pr.url));
        });
      }

      if (context.github.issues.length > 0) {
        ui.section('🐛 Related Issues');
        context.github.issues.forEach(issue => {
          const stateColor = issue.state === 'open' ? chalk.green : chalk.gray;
          console.log(
            chalk.gray('  •'),
            chalk.cyan(`#${issue.number}`),
            stateColor(`[${issue.state}]`),
            issue.title
          );
        });
      }
    }

    // Dependencies
    ui.section('📦 Dependencies');
    if (context.dependencies.imports.length > 0) {
      console.log(chalk.gray('Imports:'));
      ui.list(context.dependencies.imports.slice(0, 5));
      if (context.dependencies.imports.length > 5) {
        console.log(chalk.gray(`  ... and ${context.dependencies.imports.length - 5} more`));
      }
    }
    if (context.dependencies.importedBy.length > 0) {
      console.log(chalk.gray('Used by:'));
      ui.list(context.dependencies.importedBy.slice(0, 5));
      if (context.dependencies.importedBy.length > 5) {
        console.log(
          chalk.gray(`  ... and ${context.dependencies.importedBy.length - 5} more`)
        );
      }
    }

    // Error context
    if (context.errors) {
      ui.section('🚨 Error Context');
      if (context.errors.defined.length > 0) {
        console.log(chalk.gray('Defines errors:'));
        context.errors.defined.forEach(err => {
          console.log(chalk.gray('  •'), chalk.red(err.name), chalk.gray(`(${err.type})`));
        });
      }
      if (context.errors.thrown.length > 0) {
        console.log(chalk.gray('Throws errors:'));
        context.errors.thrown.forEach(err => {
          console.log(
            chalk.gray('  •'),
            chalk.yellow(err.name),
            chalk.gray(`at line ${err.location.line}`)
          );
        });
      }
      if (context.errors.caught.length > 0) {
        console.log(chalk.gray('Catches errors:'));
        context.errors.caught.forEach(err => {
          console.log(
            chalk.gray('  •'),
            chalk.green(err.name),
            chalk.gray(`at line ${err.location.line}`)
          );
        });
      }
    }

    // Stats
    ui.section('📊 Stats');
    ui.info('Lines of code', context.linesOfCode.toString());

    ui.newline();
  }

  generateErrorFlow(flow: ErrorFlow): void {
    ui.header(`🚨 Error Flow: ${flow.error}`);
    ui.newline();

    ui.info('Defined in', flow.definedIn || chalk.gray('(not found)'));
    ui.newline();

    if (flow.thrownIn.length > 0) {
      ui.section('⚠️  Thrown in');
      ui.list(flow.thrownIn);
    }

    if (flow.caughtIn.length > 0) {
      ui.section('✅ Caught in');
      ui.list(flow.caughtIn);
    }

    if (flow.uncaughtIn.length > 0) {
      ui.section('❌ Not caught in (risky!)');
      flow.uncaughtIn.forEach(file => {
        console.log(chalk.red('  ⚠'), file);
      });
    } else {
      ui.success('All throws are properly caught!');
    }

    ui.newline();
  }

  generateCoverageReport(report: CoverageReport): void {
    ui.header('📊 Error Coverage Report');
    ui.newline();

    // Summary
    ui.section('Summary');
    ui.info('Total errors', report.totalErrors.toString());
    ui.info('Covered', chalk.green(report.coveredErrors.toString()));
    ui.info('Uncovered', chalk.red(report.uncoveredErrors.toString()));

    const coverageColor =
      report.percentage >= 80 ? chalk.green : report.percentage >= 50 ? chalk.yellow : chalk.red;
    ui.info('Coverage', coverageColor(`${report.percentage}%`));
    ui.newline();

    // Details
    if (report.details.length > 0) {
      ui.section('Error Details');

      const tableData = report.details.map(detail => {
        const coverageColor =
          detail.coverage >= 80 ? chalk.green : detail.coverage >= 50 ? chalk.yellow : chalk.red;

        return {
          Error: detail.error,
          Coverage: coverageColor(`${Math.round(detail.coverage)}%`),
          'Risky Files': detail.riskyFiles.length.toString(),
        };
      });

      ui.table(tableData);
    }

    // Recommendations
    ui.newline();
    ui.section('💡 Recommendations');

    const riskyErrors = report.details.filter(d => d.riskyFiles.length > 0);
    if (riskyErrors.length > 0) {
      riskyErrors.forEach(detail => {
        ui.warning(`${detail.error} is not caught in ${detail.riskyFiles.length} file(s)`);
        detail.riskyFiles.slice(0, 3).forEach(file => {
          console.log(chalk.gray('    •'), file);
        });
      });
    } else {
      ui.success('All errors are properly handled! 🎉');
    }

    ui.newline();
  }
}
