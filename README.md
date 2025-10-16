# code-context

> Auto-documentation tool that tracks why your code exists

## What is this?

Ever spent hours trying to understand:
- Why does this file exist?
- What problem does this code solve?
- Where are errors thrown and caught?
- Who wrote this and why?

**code-context** automatically answers these questions by analyzing your git history, GitHub PRs/issues, and code structure.

## The Problem

Developers waste **26% of their time** gathering project context:
- New devs spend weeks understanding the codebase
- "Tribal knowledge" - only a few people know how things work
- Documentation is always outdated
- Lost context when someone leaves

## The Solution

```bash
$ code-context why auth.ts

🤖 AI Context Summary

This file implements JWT-based authentication for the application.
It was created to replace the previous session-based auth system
which had performance issues at scale. The recent 2FA addition
addresses security concerns raised in the Q3 security audit.

🎯 Purpose
Provides stateless authentication using JWT tokens with configurable
expiration and refresh token support

📊 Impact
Core authentication module used by all API endpoints. Changes here
affect login, logout, and session management for 50K+ daily users

⚠️  Watch Out
  • Token lifetime changes require coordinated backend + mobile app updates
  • 2FA implementation is still in beta, monitor error rates

──────────────────────────────────────────────────

🔍 Context for auth.ts

Created: 3 months ago by @sarah
Why: Fix security issue #234 (user tokens expiring too fast)
Related:
  - PR #456 changed token lifetime to 24h
  - Issue #567 users complained about re-login
Dependencies:
  - Used by: checkout.ts, profile.ts (4 other files)
Last modified: Yesterday by @you (added 2FA support)
```

## Features

- 🤖 **AI-Powered Context** - Get intelligent summaries that explain WHY code exists, not just when/who (powered by Claude)
- 🔍 **Smart Context Discovery** - Understand any file or function instantly
- 🚨 **Error Flow Analysis** - Track typed errors across your codebase (powered by [ts-typed-errors](https://github.com/quentinackermann/ts-typed-errors))
- 📊 **Coverage Reports** - See which errors are handled vs risky
- 💾 **Intelligent Caching** - AI analysis cached for 7 days to save costs
- 🔗 **Git + GitHub Integration** - Links commits, PRs, and issues

## Installation

```bash
npm install -g code-context
```

## Usage

### Basic Commands

```bash
# Understand a file (with AI context - defaults to Claude)
code-context why src/auth.ts

# Use OpenAI instead of Anthropic
code-context why src/auth.ts --ai-provider openai

# Understand a function
code-context why login()

# Skip AI analysis (faster, no API costs)
code-context why src/auth.ts --no-ai

# Force regenerate AI context (ignore cache)
code-context why src/auth.ts --no-cache

# Use a specific model
code-context why src/auth.ts --ai-model gpt-4o
code-context why src/auth.ts --ai-provider openai --ai-model gpt-4

# Track error flows
code-context errors LoginError

# Check error coverage
code-context coverage
```

### Environment Variables

```bash
# For AI context (choose one)
export ANTHROPIC_API_KEY="sk-ant-..."  # For Claude (default)
export OPENAI_API_KEY="sk-..."         # For GPT

# For GitHub integration
export GITHUB_TOKEN="ghp_..."
```

Or pass as options:
```bash
# With Anthropic/Claude
code-context why src/auth.ts --anthropic-key sk-ant-...

# With OpenAI/GPT
code-context why src/auth.ts --ai-provider openai --openai-key sk-...
```

## Requirements

- Node.js >= 18
- Git repository
- TypeScript project (for error analysis)
- **AI API key** (optional, for AI context):
  - Anthropic API key - https://console.anthropic.com/ (default, recommended)
  - OR OpenAI API key - https://platform.openai.com/api-keys
- GitHub token (optional, for PR/issue context)

## Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build
npm run build

# Test
npm run test
```

## Roadmap

- [x] Basic architecture
- [ ] Git history analysis
- [ ] GitHub API integration
- [ ] TypeScript AST parsing
- [ ] Error flow tracking (ts-typed-errors integration)
- [ ] CLI commands (why, errors, coverage, docs)
- [ ] Markdown export
- [ ] VS Code extension

## License

MIT © Quentin Ackermann
