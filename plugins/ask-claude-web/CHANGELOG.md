# Changelog

## 1.2.1
- Fixed Windows setup command (`/c` parsed as path by `claude mcp add`)
- Use `claude mcp add-json` for Windows chrome-devtools installation

## 1.2.0
- Removed bundled `.mcp.json` (fixes "MCP server skipped" duplicate error)
- Added `/ask-claude-web:setup` command for chrome-devtools MCP installation
- Added prerequisite check in SKILL.md — guides user to setup command if MCP missing

## 1.1.0
- Reframed skill from Q&A to collaboration/discussion with multi-turn support
- Consolidated DOM selector changelog into single verified selectors table
- Fixed response extraction (opacity-based timestamp filter + structural fallback)
- Updated marketplace README description

## 1.0.0
- Initial release
- Automated conversations with claude.ai via chrome-devtools MCP
- File attachment via OS clipboard (zero context cost)
- Streaming completion detection (async Promise + fallback polling)
- Cross-platform clipboard scripts (Windows tested, macOS/Linux experimental)
- Bilingual skill definition (English + Korean)
