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

🔍 Context for auth.ts:

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

- 🔍 **Smart Context Discovery** - Understand any file or function instantly
- 🚨 **Error Flow Analysis** - Track typed errors across your codebase (powered by [ts-typed-errors](https://github.com/quentinackermann/ts-typed-errors))
- 📊 **Coverage Reports** - See which errors are handled vs risky
- 📚 **Auto-documentation** - Generate docs that stay up to date
- 🔗 **Git + GitHub Integration** - Links commits, PRs, and issues

## Installation

```bash
npm install -g code-context
```

## Usage

```bash
# Understand a file
code-context why src/auth.ts

# Understand a function
code-context why login()

# Track error flows
code-context errors LoginError

# Check error coverage
code-context coverage

# Generate documentation
code-context docs
```

## Requirements

- Node.js >= 18
- Git repository
- TypeScript project (for error analysis)

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
