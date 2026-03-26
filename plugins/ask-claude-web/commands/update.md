---
description: Update ask-claude-web plugin to the latest version
allowed-tools: Bash(git:*), Bash(rm:*), Bash(claude plugin:*)
---

Run these commands in order:

1. `git -C ~/.claude/plugins/marketplaces/codedby-claude-plugins pull origin main`
2. `rm -rf ~/.claude/plugins/cache/codedby-claude-plugins/ask-claude-web/`
3. `claude plugin update ask-claude-web@codedby-claude-plugins -s user`

> PowerShell users: replace `~` with `$HOME` in the commands above.

Then tell the user: "Update complete. Type `/reload-plugins` or restart Claude Code to apply."
Do NOT attempt to run /reload-plugins — it's a slash command only the user can type.
