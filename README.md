# codedby-claude-plugins

Claude Code plugins by **codedby**.

## Available Plugins

| Plugin | Description | Status |
|--------|-------------|--------|
| [ask-claude-web](./plugins/ask-claude-web/) | Two Claudes talk to each other — Claude Code asks claude.ai directly, gets answers, and acts on them | v1.6.1 |
| [statusline](./plugins/statusline/) | Rich status bar — rate limits, context usage, git info, task progress, and more in one HUD line | v1.0.0 |
| [session-memory](./plugins/session-memory/) | Session-scoped keyword memory — save decisions, recall context after compaction, search across sessions | v1.0.0 |
| [guard-claude-dir](./plugins/guard-claude-dir/) | Skips .claude/ permission prompt dialogs with node-based workarounds, guards critical config files | v1.0.0 |

## Installation

```bash
# 1. Add this marketplace
/plugin marketplace add codedby-kr/codedby-claude-plugins

# 2. Install a plugin
/plugin install ask-claude-web@codedby-claude-plugins
/plugin install statusline@codedby-claude-plugins
/plugin install session-memory@codedby-claude-plugins
/plugin install guard-claude-dir@codedby-claude-plugins
```

## License

MIT
