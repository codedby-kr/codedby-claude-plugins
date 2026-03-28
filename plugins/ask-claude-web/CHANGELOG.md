# Changelog

## 1.5.0
- Full SKILL.md rewrite — generalized paths (`${CLAUDE_PLUGIN_ROOT}`), bilingual DOM selectors, server instability warning, cleanup plan applied
- Added execute-loop-doc, execute-loop-msg, execute-loop-violations commands [INTERNAL]
- New 3-step universal message sending flow with health check
- Stability check (Step 5) after streaming completion to prevent false positives
- Artifact download procedure with Chrome download path detection
- Verification Protocol Tag for structured verification loops

## 1.4.0
- Added execute-loop-doc and execute-loop-msg commands [INTERNAL] (initial version)
- Applied server-instability warning to SKILL.md
- Applied skill-cleanup-plan (23% reduction: removed duplicate sections, merged changelogs, trimmed overview)
- Added frontmatter triggers: 'discuss with web claude', 'get claude.ai's review'
- Bumped version for marketplace listing update (added statusline, session-memory, guard-claude-dir)

## 1.3.0
- Added `/ask-claude-web:update` command for easy plugin updates without restarting
- Updated README Updating section with new update command

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
