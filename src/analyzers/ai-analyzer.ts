import Anthropic from '@anthropic-ai/sdk';
import { FileContext } from '../types/index.js';

export interface AIContext {
  summary: string;
  purpose: string;
  impact: string;
  warnings?: string[];
  relatedContext?: string[];
}

export class AIAnalyzer {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20241022') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async generateContext(context: FileContext, fileContent?: string): Promise<AIContext> {
    const prompt = this.buildPrompt(context, fileContent);

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const response = message.content[0].type === 'text' ? message.content[0].text : '';
      return this.parseResponse(response);
    } catch (error) {
      throw new Error(`AI analysis failed: ${error}`);
    }
  }

  private buildPrompt(context: FileContext, fileContent?: string): string {
    const parts: string[] = [
      '# Code Context Analysis',
      '',
      'Analyze the following code file and provide a clear, concise summary that helps developers understand WHY this code exists and what problem it solves.',
      '',
      '## File Information',
      `Path: ${context.path}`,
      `Created: ${context.created.date.toLocaleDateString()} by ${context.created.author}`,
      `Creation reason: ${context.created.message}`,
      `Last modified: ${context.lastModified.date.toLocaleDateString()} by ${context.lastModified.author}`,
      `Last change: ${context.lastModified.message}`,
      '',
    ];

    if (context.github?.prs && context.github.prs.length > 0) {
      parts.push('## Related Pull Requests');
      context.github.prs.forEach(pr => {
        parts.push(`- #${pr.number}: ${pr.title}`);
      });
      parts.push('');
    }

    if (context.github?.issues && context.github.issues.length > 0) {
      parts.push('## Related Issues');
      context.github.issues.forEach(issue => {
        parts.push(`- #${issue.number}: ${issue.title} [${issue.state}]`);
      });
      parts.push('');
    }

    if (context.dependencies.importedBy.length > 0) {
      parts.push('## Usage');
      parts.push(`Used by ${context.dependencies.importedBy.length} file(s)`);
      parts.push('');
    }

    if (fileContent) {
      parts.push('## File Content (partial)');
      const truncated = fileContent.split('\n').slice(0, 100).join('\n');
      parts.push('```typescript');
      parts.push(truncated);
      if (fileContent.split('\n').length > 100) {
        parts.push('... (truncated)');
      }
      parts.push('```');
      parts.push('');
    }

    parts.push('## Required Output Format');
    parts.push('Please provide your analysis in this exact JSON format:');
    parts.push('```json');
    parts.push('{');
    parts.push('  "summary": "2-3 sentence overview of what this file does and why it exists",');
    parts.push('  "purpose": "One sentence explaining the main purpose",');
    parts.push('  "impact": "One sentence about who/what uses this and its importance",');
    parts.push('  "warnings": ["Optional: any potential gotchas or things to watch out for"],');
    parts.push('  "relatedContext": ["Optional: additional context that would be helpful"]');
    parts.push('}');
    parts.push('```');

    return parts.join('\n');
  }

  private parseResponse(response: string): AIContext {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                       response.match(/```\n([\s\S]*?)\n```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        return {
          summary: parsed.summary || 'No summary available',
          purpose: parsed.purpose || 'Unknown purpose',
          impact: parsed.impact || 'Impact unknown',
          warnings: parsed.warnings || [],
          relatedContext: parsed.relatedContext || [],
        };
      }

      // Fallback: parse as plain text
      return {
        summary: response.split('\n\n')[0] || response,
        purpose: 'See summary for details',
        impact: 'Impact analysis not available',
      };
    } catch (error) {
      // If parsing fails, return the raw response as summary
      return {
        summary: response,
        purpose: 'Analysis available in summary',
        impact: 'See summary',
      };
    }
  }

  async explainChange(
    oldContent: string,
    newContent: string,
    commitMessage: string
  ): Promise<string> {
    const prompt = `
# Code Change Analysis

## Commit Message
${commitMessage}

## Changes
The file was modified. Help explain WHY this change was made and WHAT problem it solves.

Provide a concise 2-3 sentence explanation focusing on the business/technical reason for the change.
`;

    try {
      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      });

      return message.content[0].type === 'text' ? message.content[0].text : 'No explanation available';
    } catch (error) {
      return `Could not generate explanation: ${error}`;
    }
  }
}
