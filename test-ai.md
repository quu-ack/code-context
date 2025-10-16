# Testing AI Context Generation

## Setup

Pour tester l'AI context generation, tu as besoin d'une clé API Anthropic.

### Get API Key
1. Va sur https://console.anthropic.com/
2. Crée une clé API
3. Export la clé:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

## Usage

### Avec AI context (recommandé):
```bash
cd /path/to/your/project
code-context why src/file.ts
```

### Sans AI (fallback au mode actuel):
```bash
code-context why src/file.ts --no-ai
```

### Force regeneration (ignore cache):
```bash
code-context why src/file.ts --no-cache
```

## Expected Output

Avec AI activé, tu devrais voir:

```
🤖 AI Context Summary

This file defines the Block message types used across the webchat system.
It was created to standardize how different message formats (text, images,
buttons) are rendered in the chat interface.

🎯 Purpose
Provides TypeScript type definitions for chat message blocks used throughout
the webchat components

📊 Impact
Critical type definitions used by MessageRenderer, ChatWindow, and 12 other
components across the webchat-components package

⚠️  Watch Out
  • Changes to these types will affect all message rendering logic
  • The Block interface must stay compatible with the backend API contract

─────────────────────────────────────────────────

🔍 Context for packages/webchat-components/src/types/block.ts

📅 Created
...
```

## Cache

Le cache est stocké dans `.code-context-cache/` et expire après 7 jours.

Pour vider le cache:
```bash
rm -rf .code-context-cache
```

## Cost

Chaque analyse AI coûte environ:
- ~$0.003 par fichier (model: claude-3-5-sonnet)
- Cache pendant 7 jours pour éviter les coûts répétés

Exemple: Analyser 100 fichiers = ~$0.30
