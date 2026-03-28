---
description: Update ask-claude-web plugin to the latest version
allowed-tools: Bash(git:*), Bash(rm:*), Bash(claude plugin:*)
---

아래 명령을 순서대로 실행한다:

1. `git -C ~/.claude/plugins/marketplaces/codedby-claude-plugins pull origin main`
2. `rm -rf ~/.claude/plugins/cache/codedby-claude-plugins/ask-claude-web/`
3. `claude plugin update ask-claude-web@codedby-claude-plugins -s user`

> PowerShell 사용자: 위 명령에서 `~`를 `$HOME`으로 바꾸세요.

사용자에게 안내: "업데이트 완료. `/reload-plugins`를 입력하거나 Claude Code를 재시작하세요."
/reload-plugins는 슬래시 커맨드이므로 직접 실행하지 말 것 — 사용자가 직접 입력해야 한다.
