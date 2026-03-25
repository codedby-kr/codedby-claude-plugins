---
name: ask-claude-web
argument-hint: "ask claude.ai [your question]"
description: "Automate conversations with claude.ai from Claude Code via chrome-devtools MCP. Finds the input field, sends messages, detects streaming completion (polling), and extracts the last assistant response. Includes DOM selector version history. Trigger on: 'ask claude.ai', 'question for claude.ai', 'let web claude handle this', 'claude.ai would know this better'. Use this skill whenever automated interaction with claude.ai is needed. NEVER use take_snapshot (wastes 130K+ tokens)."
---

# ask-claude-web Skill

## Overview / 개요

This skill automates conversations with claude.ai through Chrome's DevTools protocol (chrome-devtools MCP). When triggered, it finds the input field, types a question, sends it, waits for the streaming response to complete, and extracts the answer.

chrome-devtools MCP를 통해 Chrome에서 열린 claude.ai 탭에 질문을 보내고 응답을 읽어오는 스킬입니다.

---

## Absolute Rules / 절대 규칙

### File Attachment — Use Clipboard Method Only / 파일 첨부는 반드시 클립보드 방식

**NEVER put file contents into evaluate_script.** File content passing through Claude Code's context wastes tokens. Always use the **clipboard Ctrl+V method** below — file contents travel only via OS clipboard → browser, with **zero context consumption**.

파일 내용을 evaluate_script에 넣지 마세요. 반드시 클립보드 방식을 사용하세요.

#### Prohibited / 금지 사항
- Do NOT embed file contents as template literals in evaluate_script functions
- Do NOT pass file contents via evaluate_script args (args are uid-only, won't work anyway)
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

**Step 2** — Focus the input field (no uid needed):
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
- **Windows:** Uses `System.Windows.Forms.Clipboard` (PowerShell)
- **macOS:** Uses `osascript` (experimental — not fully tested with claude.ai Ctrl+V)
- **Linux:** Uses `xclip` (experimental — not fully tested with claude.ai Ctrl+V)
- Multiple file paths → single Ctrl+V attaches all
- Non-existent files are skipped with `[SKIP]`

### NEVER Use take_snapshot / take_snapshot 사용 금지

claude.ai pages produce 130K+ character snapshots — massive token waste. Use `evaluate_script` for all DOM interactions.

---

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
- **User is watching** (user said "ask claude.ai", "질문해" and waits for result): Use the user's language
- **Automated processing** (Claude Code queries claude.ai on its own for problem-solving): Append `"Answer in English only."` to the question, process internally, then report to user in their language

---

## Tab Usage Rules / 대화 탭 사용 규칙

**Default: Use the currently open claude.ai chat. Do NOT navigate with navigate_page.**

1. If the user has a page open, remember the current URL (format: `https://claude.ai/chat/{chat-id}`)
2. If no `https://claude.ai/` tab exists among open tabs, navigate to the remembered URL (or `https://claude.ai/` if none remembered)

---

## Complete Workflow / 전체 워크플로우

1. `select_page` → select the claude.ai tab (use the current chat as-is)
2. (If attaching files) clipboard script → focus → `Control+v` / `Meta+v`
3. `evaluate_script` → focus input field + type question
4. `press_key("Enter")` → send
5. `evaluate_script` → wait for streaming completion (async Promise — single call)
5b. (Recommended) `evaluate_script` → scroll-to-bottom (separate call)
6. `evaluate_script` → extract response text
7. Process the extracted text

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

## Triggers / 사용 트리거

Activate this skill when the user says:
- "ask claude.ai" / "claude.ai한테 물어봐"
- "let claude.ai handle this" / "claude.ai한테 해결해달라고 해"
- "question for web claude" / "웹 클로드한테 질문해"
- "claude.ai would know this better" / "이건 claude.ai가 더 잘 알 거야"

---

## Question Writing Tips / 질문 작성 요령

Questions sent to claude.ai get better answers with sufficient context:
- Describe the current situation (what you were doing when the problem occurred)
- Include relevant code snippets
- State what you've already tried
- Clearly describe the desired outcome

---

## Troubleshooting / 트러블슈팅

| Issue / 문제 | Solution / 해결 |
|--------------|----------------|
| chrome-devtools MCP disconnected | Reconnect in `/mcp` |
| Input field not found | claude.ai UI updated — search `[contenteditable="true"]` via evaluate_script |
| Cannot read response | `[data-testid="user-message"]` selector changed — re-explore DOM |
| Chrome permission dialog keeps appearing | Normal behavior — click Allow |
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

## DOM Selector Changelog / DOM 셀렉터 변경 이력

### Input Field / 입력 필드

| Version | Date | Selector/Method | Status |
|---------|------|-----------------|--------|
| v1 | 2026-03-22 | `[contenteditable="true"][data-placeholder]` → `fieldset [contenteditable="true"]` → `[contenteditable="true"]` (fallback chain) | **Active** |
| v1 | 2026-03-22 | `document.execCommand('insertText', false, text)` — deprecated API but still the most reliable for contenteditable fields | **Active** |

### Streaming Detection — Stop Button / 스트리밍 감지 — Stop 버튼

| Version | Date | aria-label | Status |
|---------|------|------------|--------|
| v2 | 2026-03-25 | `"Stop response"` (EN, verified), `"응답 중단"` (KO, verified), `"Stop Response"`, `"응답 중지"` (fallbacks) — all in selector chain | **Active** |

### Streaming Detection — Polling / 스트리밍 감지 — Polling

| Version | Date | Method | Status |
|---------|------|--------|--------|
| v2 | 2026-03-24 | async Promise + setInterval(3s) — single evaluate_script call. TAB_LOST detection included | **Active (preferred)** |
| v1 | 2026-03-22 | repeated evaluate_script calls (3-5s interval) | **Fallback** |

### Streaming Detection — data-is-streaming

| Version | Date | Selector | Status |
|---------|------|----------|--------|
| v1 | 2026-03-22 | `[data-is-streaming="true"]` | **Active** |

### Response Extraction / 응답 추출

| Version | Date | Method | Status |
|---------|------|--------|--------|
| v1 | 2026-03-22 | `[data-testid="user-message"]` → traverse up to 10 parent levels → `nextElementSibling.innerText` | **Active** |

### Scroll-to-Bottom / 스크롤

| Version | Date | Method | Status |
|---------|------|--------|--------|
| v1 | 2026-03-24 | Find first scrollable ancestor from `[data-testid="user-message"]` | **Active (recommended)** |

### User Message Identification / 사용자 메시지 식별

| Version | Date | Selector | Status |
|---------|------|----------|--------|
| v1 | 2026-03-22 | `[data-testid="user-message"]` | **Active** |

### File Attachment / 파일 첨부

| Version | Date | Method | Status |
|---------|------|--------|--------|
| v3 | 2026-03-23 | clipboard script → focus via evaluate_script → press_key Ctrl+V. No uid needed. Zero context cost | **Active** |

### File Attachment Removal aria-labels / 첨부 삭제 버튼

| Language | aria-label | Verified |
|----------|-----------|----------|
| English | `"Remove"` | 2026-03-25 ✅ |
| Korean | `"제거"` | 2026-03-23 ✅ |

### File Attachment Verification / 첨부 확인

| Version | Date | Method | Status |
|---------|------|--------|--------|
| v2 | 2026-03-23 | DOM text search for filename via evaluate_script (~100 tokens) | **Active** |
| v1 | 2026-03-22 | take_screenshot (~3,000 tokens at 1440p) | **Deprecated** — replaced by DOM search |

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
