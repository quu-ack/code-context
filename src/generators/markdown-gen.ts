import { FileContext } from '../types/index.js';
import { AIContext } from '../analyzers/ai-analyzer.js';
import * as fs from 'fs';
import * as path from 'path';

export class MarkdownGenerator {
  generateMarkdown(context: FileContext, aiContext?: AIContext): string {
    const sections: string[] = [];

    // Title
    sections.push(`# ${path.basename(context.path)}`);
    sections.push('');
    sections.push(`> ${context.path}`);
    sections.push('');

    // AI Context if available
    if (aiContext) {
      sections.push('## 🤖 AI Context Summary');
      sections.push('');
      sections.push(aiContext.summary);
      sections.push('');

      sections.push('### 🎯 Purpose');
      sections.push(aiContext.purpose);
      sections.push('');

      sections.push('### 📊 Impact');
      sections.push(aiContext.impact);
      sections.push('');

      if (aiContext.warnings && aiContext.warnings.length > 0) {
        sections.push('### ⚠️ Watch Out');
        sections.push('');
        aiContext.warnings.forEach(warning => {
          sections.push(`- ${warning}`);
        });
        sections.push('');
      }

      if (aiContext.relatedContext && aiContext.relatedContext.length > 0) {
        sections.push('### 💡 Related Context');
        sections.push('');
        aiContext.relatedContext.forEach(ctx => {
          sections.push(`- ${ctx}`);
        });
        sections.push('');
      }

      sections.push('---');
      sections.push('');
    }

    // Git History
    sections.push('## 📅 History');
    sections.push('');
    sections.push('### Created');
    sections.push(`- **Date**: ${context.created.date.toLocaleDateString()}`);
    sections.push(`- **Author**: ${context.created.author}`);
    sections.push(`- **Reason**: ${context.created.message}`);
    sections.push(`- **Commit**: \`${context.created.commit.substring(0, 7)}\``);
    sections.push('');

    sections.push('### Last Modified');
    sections.push(`- **Date**: ${context.lastModified.date.toLocaleDateString()}`);
    sections.push(`- **Author**: ${context.lastModified.author}`);
    sections.push(`- **Changes**: ${context.lastModified.message}`);
    sections.push(`- **Commit**: \`${context.lastModified.commit.substring(0, 7)}\``);
    sections.push('');

    // GitHub Context
    if (context.github) {
      if (context.github.prs && context.github.prs.length > 0) {
        sections.push('## 🔀 Related Pull Requests');
        sections.push('');
        context.github.prs.forEach(pr => {
          sections.push(`- [#${pr.number}](${pr.url}) - ${pr.title}`);
        });
        sections.push('');
      }

      if (context.github.issues && context.github.issues.length > 0) {
        sections.push('## 🐛 Related Issues');
        sections.push('');
        context.github.issues.forEach(issue => {
          const badge = issue.state === 'open' ? '🟢' : '⚪️';
          sections.push(`- ${badge} [#${issue.number}](${issue.url}) - ${issue.title}`);
        });
        sections.push('');
      }
    }

    // Dependencies
    sections.push('## 📦 Dependencies');
    sections.push('');

    if (context.dependencies.imports.length > 0) {
      sections.push('### Imports');
      sections.push('');
      context.dependencies.imports.forEach(imp => {
        sections.push(`- \`${imp}\``);
      });
      sections.push('');
    }

    if (context.dependencies.importedBy.length > 0) {
      sections.push('### Used By');
      sections.push('');
      sections.push(`This file is imported by **${context.dependencies.importedBy.length}** other file(s):`);
      sections.push('');
      context.dependencies.importedBy.slice(0, 10).forEach(file => {
        sections.push(`- \`${file}\``);
      });
      if (context.dependencies.importedBy.length > 10) {
        sections.push(`- ... and ${context.dependencies.importedBy.length - 10} more`);
      }
      sections.push('');
    }

    // Error Context
    if (context.errors) {
      const hasErrors =
        (context.errors.defined && context.errors.defined.length > 0) ||
        (context.errors.thrown && context.errors.thrown.length > 0) ||
        (context.errors.caught && context.errors.caught.length > 0);

      if (hasErrors) {
        sections.push('## 🚨 Error Context');
        sections.push('');

        if (context.errors.defined && context.errors.defined.length > 0) {
          sections.push('### Defined Errors');
          sections.push('');
          context.errors.defined.forEach(err => {
            sections.push(`- \`${err.name}\` (${err.type}) - Line ${err.location.line}`);
          });
          sections.push('');
        }

        if (context.errors.thrown && context.errors.thrown.length > 0) {
          sections.push('### Thrown Errors');
          sections.push('');
          context.errors.thrown.forEach(err => {
            sections.push(`- \`${err.name}\` - Line ${err.location.line}`);
          });
          sections.push('');
        }

        if (context.errors.caught && context.errors.caught.length > 0) {
          sections.push('### Caught Errors');
          sections.push('');
          context.errors.caught.forEach(err => {
            sections.push(`- \`${err.name}\` (${err.type}) - Line ${err.location.line}`);
          });
          sections.push('');
        }
      }
    }

    // Stats
    sections.push('## 📊 Stats');
    sections.push('');
    sections.push(`- **Lines of Code**: ${context.linesOfCode}`);
    sections.push('');

    // Footer
    sections.push('---');
    sections.push('');
    sections.push('_Generated by [code-context](https://github.com/quu-ack/code-context)_');

    return sections.join('\n');
  }

  async writeMarkdown(
    outputDir: string,
    context: FileContext,
    aiContext?: AIContext
  ): Promise<string> {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate filename from file path
    const filename = path.basename(context.path, path.extname(context.path)) + '.md';
    const outputPath = path.join(outputDir, filename);

    // Generate and write markdown
    const markdown = this.generateMarkdown(context, aiContext);
    fs.writeFileSync(outputPath, markdown, 'utf-8');

    return outputPath;
  }

  async generateIndex(outputDir: string, files: string[]): Promise<void> {
    const sections: string[] = [];

    sections.push('# Code Context Documentation');
    sections.push('');
    sections.push('> Auto-generated documentation by code-context');
    sections.push('');
    sections.push('## Files');
    sections.push('');

    files.forEach(file => {
      const basename = path.basename(file);
      const displayName = basename.replace('.md', '');
      sections.push(`- [${displayName}](./${basename})`);
    });

    sections.push('');
    sections.push('---');
    sections.push('');
    sections.push('_Generated by [code-context](https://github.com/quu-ack/code-context)_');

    const indexPath = path.join(outputDir, 'README.md');
    fs.writeFileSync(indexPath, sections.join('\n'), 'utf-8');
  }
}
