---
description: Install chrome-devtools MCP dependency for ask-claude-web plugin
allowed-tools: Bash(claude mcp:*), Bash(npx:*)
---

1. Check if chrome-devtools MCP is already connected: run `claude mcp list` and look for "chrome-devtools".
   If already present and connected, tell the user it's already set up and stop.

2. Detect the OS:
   - **macOS / Linux / WSL:**
     ```
     claude mcp add chrome-devtools -s user -- npx -y chrome-devtools-mcp@latest --autoConnect
     ```
   - **Windows (native, not WSL):**
     ```
     claude mcp add chrome-devtools -s user -- cmd /c npx -y chrome-devtools-mcp@latest --autoConnect
     ```

3. Verify: run `claude mcp list` and confirm chrome-devtools appears.
   If not connected, tell the user to:
   - Ensure Chrome is running
   - Enable remote debugging at `chrome://inspect/#remote-debugging`
   - Restart Claude Code and run `/ask-claude-web:setup` again
