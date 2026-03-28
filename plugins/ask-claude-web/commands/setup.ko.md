---
description: Install chrome-devtools MCP dependency for ask-claude-web plugin
allowed-tools: Bash(claude mcp:*), Bash(npx:*)
---

1. chrome-devtools MCP가 이미 연결되어 있는지 확인: `claude mcp list`를 실행하여 "chrome-devtools"가 있는지 확인.
   이미 있고 연결되어 있으면 사용자에게 설정 완료를 안내하고 종료.

2. OS를 감지:
   - **macOS / Linux / WSL:**
     ```
     claude mcp add chrome-devtools -s user -- npx -y chrome-devtools-mcp@latest --autoConnect
     ```
   - **Windows (네이티브, WSL 아님):**
     ```
     claude mcp add-json chrome-devtools '{"type":"stdio","command":"cmd","args":["/c","npx","-y","chrome-devtools-mcp@latest","--autoConnect"]}' -s user
     ```

3. 확인: `claude mcp list`를 실행하여 chrome-devtools가 표시되는지 확인.
   연결되지 않으면 사용자에게 다음을 안내:
   - Chrome이 실행 중인지 확인
   - `chrome://inspect/#remote-debugging`에서 원격 디버깅 활성화
   - Claude Code를 재시작하고 `/ask-claude-web:setup`을 다시 실행
