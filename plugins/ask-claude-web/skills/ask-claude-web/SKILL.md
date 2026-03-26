---
name: ask-claude-web
argument-hint: "discuss with claude.ai [topic or context]"
description: "Collaborate with claude.ai from Claude Code via chrome-devtools MCP — discuss, verify, review, and get second opinions. Finds the input field, sends messages, detects streaming completion (polling), and extracts the last assistant response. Includes DOM selector version history. Supports multi-turn conversations: send messages, wait for responses, follow up as needed. Trigger on: 'discuss with claude.ai', 'verify with claude.ai', 'ask claude.ai', 'discuss with web claude', 'get claude.ai's review', 'let web claude handle this', 'claude.ai would know this better', 'get claude.ai's opinion'. Use this skill whenever collaboration with claude.ai is needed — discussions, reviews, verification, or simple questions. NEVER use take_snapshot (wastes 130K+ tokens)."
---

# ask-claude-web Skill

## Overview / 개요

Automates collaboration with claude.ai via chrome-devtools MCP — discussions, reviews, verification, and questions with multi-turn support.

---

## Absolute Rules / 절대 규칙

### File Attachment — Use Clipboard Method Only / 파일 첨부는 반드시 클립보드 방식

**NEVER put file contents into evaluate_script.** NEVER use take_snapshot (130K+ tokens wasted). File content passing through Claude Code's context wastes tokens. Always use the **clipboard Ctrl+V method** below — file contents travel only via OS clipboard → browser, with **zero context consumption**.

파일 내용을 evaluate_script에 넣지 마세요. 반드시 클립보드 방식을 사용하세요.

#### Prohibited / 금지 사항
- Do NOT embed file contents as template literals in evaluate_script functions
- Do NOT pass file contents via evaluate_script args
- Do NOT create File objects via DataTransfer API
- Do NOT read files with the Read tool and pass to evaluate_script

#### File Attachment Procedure (Zero Context Cost) / 파일 첨부 절차

**Step 1** — Copy files to clipboard:

| OS | Command |
|----|---------|
| **Windows** | `powershell -File "<plugin-dir>/scripts/clip-files.ps1" "file1.md" "file2.md"` |
| **macOS** | `bash "<plugin-dir>/scripts/clip-files-mac.sh" "file1.md" "file2.md"` |
| **Linux** | `bash "<plugin-dir>/scripts/clip-files-linux.sh" "file1.md" "file2.md"` |

> **Note:** Determine `<plugin-dir>` by checking the plugin installation path. Typically `~/.claude/plugins/ask-claude-web/` after installation.

**Step 2** — Focus the input field:
```
chrome-devtools - evaluate_script
function: () => {
  const el = document.querySelector('[contenteditable="true"][data-placeholder]')
    || document.querySelector('[contenteditable="true"]');
  if (!el) return 'NOT_FOUND';
  el.focus();
  return 'FOCUSED';
}
```

**Step 3** — Paste:
```
chrome-devtools - press_key (key: "Control+v")   // Windows/Linux
chrome-devtools - press_key (key: "Meta+v")       // macOS
```

**Step 4** — (Recommended) Verify attachment via DOM (~100 tokens, 1/30 of a screenshot):
```
chrome-devtools - evaluate_script
function: () => {
  const all = document.querySelectorAll('*');
  const found = [];
  for (const el of all) {
    if (el.children.length > 3) continue;
    const t = el.textContent;
    if (t && t.includes('TARGET_FILENAME') && t.length < 100) {
      found.push({ tag: el.tagName, text: t.substring(0, 80) });
      if (found.length >= 3) break;
    }
  }
  return { attached: found.length > 0, matches: found };
}
```
Replace `TARGET_FILENAME` with the actual filename (e.g., `player.gd`).

#### Notes / 주의사항
- **macOS:** experimental — not fully tested with claude.ai paste
- **Linux:** experimental — requires `xclip`, not fully tested with claude.ai paste
- Multiple file paths → single Ctrl+V attaches all
- Non-existent files are skipped with `[SKIP]`

## Prerequisites / 사전 조건

1. **Chrome** must be running — if Chrome is not open, ask the user to launch Chrome and enable remote debugging at `chrome://inspect/#remote-debugging`. Do NOT launch Chrome via system command — the MCP server cannot connect to a Chrome instance started after MCP initialization.
2. **Chrome remote debugging** must be enabled: `chrome://inspect/#remote-debugging` toggle ON
3. **chrome-devtools MCP server** must be connected to Claude Code (check `/mcp` → `chrome-devtools · ✔ connected`)
4. A **claude.ai tab** must be open and logged in — if no claude.ai tab exists, open one: `chrome-devtools - new_page (url: "https://claude.ai")`
5. **First connection per session**: Chrome will show a permission dialog ("Allow remote debugging?") — the user must click **Allow**. This happens once per Claude Code session.
6. **If connection fails**: Ask the user to reconnect via `/mcp` (select chrome-devtools → reconnect) while Chrome is running.

---

## Select the claude.ai Tab / 탭 선택

```
chrome-devtools - select_page (pageId: <claude.ai tab number>, bringToFront: true)
```
If you don't know the tab number, run `list_pages` first.

---

## Message Input + Send / 메시지 입력 + 전송

### Input Method / 입력 방법
```
chrome-devtools - evaluate_script
function: () => {
  const el = document.querySelector('[contenteditable="true"][data-placeholder]')
    || document.querySelector('fieldset [contenteditable="true"]')
    || document.querySelector('[contenteditable="true"]');
  if (!el) return 'NOT_FOUND';
  el.focus();
  el.textContent = '';
  document.execCommand('insertText', false, 'YOUR QUESTION HERE');
  return el.textContent.length;
}
```

No uid needed — DOM is manipulated directly via `evaluate_script`.

### Send / 전송
```
chrome-devtools - press_key (key: "Enter")
```

---

## Wait for Response / 응답 대기

### Streaming Completion Detection (preferred: async Promise) / 스트리밍 완료 감지

Single evaluate_script call that waits until response is complete. Checks every 3 seconds, 5-minute timeout:
```
chrome-devtools - evaluate_script
function: async () => {
  return new Promise(resolve => {
    const check = setInterval(() => {
      // Detect if tab was navigated away or crashed
      if (!document.querySelector('[contenteditable="true"]')) {
        clearInterval(check);
        resolve('TAB_LOST');
        return;
      }
      const stopBtn = document.querySelector('button[aria-label="Stop Response"], button[aria-label="Stop response"], button[aria-label="응답 중단"], button[aria-label="응답 중지"]');
      const streaming = document.querySelector('[data-is-streaming="true"]');
      if (!stopBtn && !streaming) {
        clearInterval(check);
        resolve('DONE');
      }
    }, 3000);
    setTimeout(() => { clearInterval(check); resolve('TIMEOUT'); }, 300000);
  });
}
```
- Returns: `'DONE'` (complete), `'TIMEOUT'` (exceeded 5 min), or `'TAB_LOST'` (tab navigated/crashed)
- For complex prompts (web search, deep research): increase timeout to `600000` (10 min)
- On error (tab navigated/crashed): re-select tab (`select_page`) and retry
- If result after `'DONE'` is < 20 chars or contains "error"/"went wrong": claude.ai error → resend question

### Streaming Detection (fallback: manual polling) / 수동 polling (fallback)

Use when the async method returns errors or MCP doesn't support async:
```
chrome-devtools - evaluate_script
function: () => {
  const stopBtn = document.querySelector('button[aria-label="Stop Response"], button[aria-label="Stop response"], button[aria-label="응답 중단"], button[aria-label="응답 중지"]');
  const streaming = document.querySelector('[data-is-streaming="true"]');
  return {
    isStreaming: !!(stopBtn || streaming),
    hasStopButton: !!stopBtn,
    hasStreamingAttr: !!streaming
  };
}
```
Run this every 3-5 seconds. When `isStreaming` becomes `false`, the response is complete.

---

## Read Response / 응답 텍스트 읽기

**NEVER read via screenshot** — long responses won't fit on screen.

### (Recommended) Scroll to Bottom Before Extraction / 추출 전 스크롤

Separate evaluate_script call to scroll down. Ensures lazy rendering completion + user visibility:
```
chrome-devtools - evaluate_script
function: () => {
  const msgs = document.querySelectorAll('[data-testid="user-message"]');
  if (msgs.length === 0) return 'NO_MESSAGES';
  let el = msgs[msgs.length - 1];
  for (let i = 0; i < 15; i++) {
    el = el.parentElement;
    if (!el) break;
    if (el.scrollHeight > el.clientHeight + 100) {
      el.scrollTop = el.scrollHeight;
      return 'SCROLLED';
    }
  }
  return 'NO_SCROLLABLE_FOUND';
}
```

### Extract Last Assistant Response / 마지막 응답 추출
```
chrome-devtools - evaluate_script
function: () => {
  const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  if (!lastUserMsg) return 'NO_USER_MSG';

  let current = lastUserMsg;
  for (let depth = 0; depth < 10; depth++) {
    let parent = current.parentElement;
    if (!parent) break;
    let nextSib = parent.nextElementSibling;
    if (nextSib) {
      const text = nextSib.innerText;
      if (!text || text.trim().length === 0) { current = parent; continue; }
      if (text.includes('Claude is AI and can make mistakes')) { current = parent; continue; }
      const opacity = getComputedStyle(nextSib).opacity;
      if (opacity === '0') { current = parent; continue; }
      if (nextSib.children.length === 0 && text.length < 15) { current = parent; continue; }
      if (nextSib.querySelector('[data-testid="user-message"]')) { current = parent; continue; }
      return text;
    }
    current = parent;
  }
  return 'ASSISTANT_RESPONSE_NOT_FOUND';
}
```

---

## Token Saving — English Conversation Mode / 토큰 절약 — 영어 대화 모드

Korean uses ~1.5-2x more tokens than English. For automated processing where the user isn't watching, communicate in English to save tokens.

### Rules / 적용 규칙
- **User is watching** (user said "discuss with claude.ai", "의논해", "물어봐" and waits for result): Use the user's language
- **Automated processing** (Claude Code collaborates with claude.ai on its own for problem-solving): Append `"Answer in English only."` to the message, process internally, then report to user in their language

---

## Tab Usage Rules / 대화 탭 사용 규칙

**Default: Use the currently open claude.ai chat. Do NOT navigate with navigate_page.**

1. If the user has a page open, remember the current URL (format: `https://claude.ai/chat/{chat-id}`)
2. If no `https://claude.ai/` tab exists among open tabs, navigate to the remembered URL (or `https://claude.ai/` if none remembered)

---

## Saving Conversation Conclusions / 대화 결론 저장 규칙

After conversing with claude.ai, ask yourself before responding to the user:

**"Is there any decision or discovery from this conversation that exists only in my context and is not recorded in any file?"**

If yes, save to session memory. If no, don't save.

Format:
- keyword: searchable topic slug
- summary: 1-line summary
- decisions: list of decisions/findings (with rationale)
- Do NOT copy the entire conversation — extract conclusions only

---

## Multi-turn Conversations / 다회전 대화

For discussions, reviews, or verification: don't stop after one round. Read the response and follow up until a conclusion is reached. For simple questions, a single round is fine. When sending messages, always include the current situation and what kind of input you need (review, verification, opinion, direction).

---

## Troubleshooting / 트러블슈팅

| Issue / 문제 | Solution / 해결 |
|--------------|----------------|
| chrome-devtools MCP disconnected | Reconnect in `/mcp` |
| Input field not found | claude.ai UI updated — search `[contenteditable="true"]` via evaluate_script |
| Cannot read response | `[data-testid="user-message"]` selector changed — re-explore DOM |
| "Server running at: starting…" | MCP client (Claude Code) must invoke a tool for the server to start |

---

## DOM Selector Update Rules / DOM 셀렉터 변경 감지 규칙

**claude.ai's DOM structure can change at any time with UI updates.**

When a selector stops working:
1. Explore the actual DOM via `evaluate_script` to find new selectors
2. **Do NOT delete previous methods** — record as versioned history below
3. Update scripts to the latest version, keeping old selectors as fallbacks
4. Record the date, change, and reason in the changelog

### How to Discover New Selectors / 새 셀렉터 찾는 방법

When UI language changes or claude.ai updates its UI, use these discovery scripts:

**Find all buttons with aria-labels on the page:**
```
() => {
  const btns = document.querySelectorAll('button[aria-label]');
  return [...new Set([...btns].map(b => b.getAttribute('aria-label')))].sort();
}
```

**Find Stop button during streaming** (send a long question first, then run within 3s):
```
() => {
  const btns = document.querySelectorAll('button[aria-label]');
  return [...btns].map(b => b.getAttribute('aria-label'))
    .filter(l => l && (l.toLowerCase().includes('stop') || l.includes('중단') || l.includes('중지')));
}
```

**Find Remove button for file attachments** (attach a file first, then run):
```
() => {
  const fieldset = document.querySelector('fieldset');
  if (!fieldset) return 'NO_FIELDSET';
  return [...fieldset.querySelectorAll('button[aria-label]')].map(b => b.getAttribute('aria-label'));
}
```

---

## Verified Selectors & Methods / 검증된 셀렉터 및 방법

| Component | Selector / Value | Language | Verified | Notes |
|-----------|-----------------|----------|----------|-------|
| Stop button | `"Stop response"` | EN | 2026-03-25 | Primary |
| Stop button | `"응답 중단"` | KO | 2026-03-25 | Primary |
| Stop button | `"Stop Response"`, `"응답 중지"` | EN/KO | 2026-03-22 | Fallback |
| File remove | `"Remove"` | EN | 2026-03-25 | |
| File remove | `"제거"` | KO | 2026-03-23 | |
| Streaming wait | async Promise + setInterval(3s) | — | 2026-03-24 | Preferred. TAB_LOST detection |
| Streaming wait | repeated evaluate_script (3-5s) | — | 2026-03-22 | Fallback for async-unsupported MCP |
| File verification | DOM text search (~100 tokens) | — | 2026-03-23 | |

### File Attachment Removal / 첨부 삭제

#### Current Method (v1, 2026-03-23)
```
chrome-devtools - evaluate_script
function: () => {
  const fieldset = document.querySelector('fieldset');
  if (!fieldset) return { removed: 0, error: 'NO_FIELDSET' };
  const removeBtns = fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]');
  const count = removeBtns.length;
  for (let i = count - 1; i >= 0; i--) {
    removeBtns[i].click();
  }
  return { removed: count };
}
```
- Clicks in reverse order (DOM stability during removal)
- Verified with 4 simultaneous file removals

#### Fallback Selector Search / 대체 셀렉터 탐색 방법
If `aria-label="Remove"` / `"제거"` stops working:
1. **Enumerate all fieldset buttons**: Check aria-label, title, class, SVG presence
2. **Explore file card structure**: Find sibling buttons of filename elements
3. **Try aria-label variants**: `"Remove"`, `"remove"`, `"Delete"`, `"삭제"`, `"Close"`, `"제거"`
4. **Last resort**: Click SVG-only buttons (no text, only SVG child) next to filename buttons
