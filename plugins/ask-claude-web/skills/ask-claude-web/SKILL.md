---
name: ask-claude-web
argument-hint: "discuss with claude.ai [topic or context]"
description: "Load this skill whenever 'web Claude', 'claude.ai', 'Claude chatbot' is mentioned as a communication target. Automated communication skill that sends messages to a claude.ai web tab and receives responses. Covers all interactions with claude.ai: discuss, verify, review, ask, relay, share, consult. Based on chrome-devtools MCP. Dedicated to real-time conversation with a claude.ai tab. Trigger on: 'discuss with claude.ai', 'verify with claude.ai', 'ask claude.ai', 'discuss with web claude', 'get claude.ai's review', 'let web claude handle this', 'claude.ai would know this better', 'get claude.ai's opinion'. NEVER use take_snapshot (wastes 130K+ tokens)."
---

# ask-claude-web Skill

## Overview

Automates collaboration between Claude Code and claude.ai via chrome-devtools MCP. Supports discussions, reviews, verification, questions, and multi-turn conversations.

## Absolute Rules

### File Attachment — Use Clipboard Method Only

**NEVER put file contents into evaluate_script.** NEVER use take_snapshot (130K+ tokens wasted). File content passing through Claude Code's context wastes tokens. When sending files to web Claude, always use the **clipboard Ctrl+V method** below — file contents travel only via OS clipboard → browser, with **zero context consumption**.

#### Prohibited
- Do NOT embed file contents as template literals in evaluate_script functions
- Do NOT pass file contents via evaluate_script args
- Do NOT create File objects via DataTransfer API
- Do NOT read files with the Read tool and pass to evaluate_script

#### File Attachment Procedure (Zero Context Cost)

**Step 1** — Copy files to clipboard:

| OS | Command |
|----|---------|
| **Windows** | `powershell -File "${CLAUDE_PLUGIN_ROOT}/scripts/clip-files.ps1" "file1.md" "file2.md"` |
| **macOS** | `bash "${CLAUDE_PLUGIN_ROOT}/scripts/clip-files-mac.sh" "file1.md" "file2.md"` |
| **Linux** | `bash "${CLAUDE_PLUGIN_ROOT}/scripts/clip-files-linux.sh" "file1.md" "file2.md"` |

> **Note:** `${CLAUDE_PLUGIN_ROOT}` is set by Claude Code when running plugin commands. If unavailable, check the plugin installation path (typically `~/.claude/plugins/cache/codedby-claude-plugins/ask-claude-web/`).

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

#### Notes
- Multiple file paths → single Ctrl+V attaches all
- Non-existent files are skipped with `[SKIP]`
- **Attached filenames get a timestamp prefix** (e.g., `1774536904906_rule_violations.md`). When verifying attachments, search by the original filename without extension (e.g., `rule_violations`) for partial matching.

## Prerequisites

- **Chrome** must be running — if Chrome is not open, ask the user to launch Chrome manually. Do NOT launch Chrome via system command — the MCP server cannot connect to a Chrome instance started after MCP initialization.
- `chrome://inspect/#remote-debugging` toggle must be ON
- **chrome-devtools MCP server** must be connected to Claude Code (check `/mcp` → `chrome-devtools · ✔ connected`)
- A **claude.ai tab** must be open and logged in
- **First connection per session**: Chrome will show a permission dialog ("Allow remote debugging?") — the user must click **Allow**. This happens once per Claude Code session.
- **If connection fails**: Ask the user to reconnect via `/mcp` (select chrome-devtools → reconnect) while Chrome is running.

## Select the claude.ai Tab

```
chrome-devtools - select_page (pageId: <claude.ai tab number>, bringToFront: true)
```
If you don't know the tab number, run `list_pages` first.

## Message Sending — 2-Step Flow

### Step 1: File Attachment (optional — only when files need to be attached)

| OS | Command |
|----|---------|
| **Windows** | `powershell -File "${CLAUDE_PLUGIN_ROOT}/scripts/clip-files.ps1" "file1.md" "file2.md"` |
| **macOS** | `bash "${CLAUDE_PLUGIN_ROOT}/scripts/clip-files-mac.sh" "file1.md" "file2.md"` |
| **Linux** | `bash "${CLAUDE_PLUGIN_ROOT}/scripts/clip-files-linux.sh" "file1.md" "file2.md"` |

Then paste:
```
chrome-devtools - press_key (key: "Control+v")   // Windows/Linux
chrome-devtools - press_key (key: "Meta+v")       // macOS
```
If verification is needed, use the DOM check script from "File Attachment Procedure" Step 4.

### Step 2: Send (with built-in attachment gate)

This single script handles streaming check, stale attachment cleanup, text input, and send. **No separate prep step needed** — cleanup is built into the send action.

Set the `EXPECTED` value at the top of the script to the number of files you just pasted (0 for text-only, 3 if you pasted 3 files). Do NOT use the `args` parameter — it requires a snapshot and will fail.
```
chrome-devtools - evaluate_script
function: async () => {
  const expected = 0; // ← SET THIS: 0 for text-only, N for N files
  const fieldset = document.querySelector('fieldset');

  // Streaming guard
  const stopBtn = document.querySelector(
    'button[aria-label="Stop Response"], button[aria-label="응답 중단"], button[aria-label="Stop response"]'
  );
  if (stopBtn || document.querySelector('[data-is-streaming="true"]'))
    return { sent: false, error: 'STILL_STREAMING', message: 'Previous response is still streaming. Wait for it to finish, then retry.' };

  // File name extraction helper (for diagnostic messages)
  const getFileNames = () => {
    const btns = fieldset ? fieldset.querySelectorAll('button') : [];
    const names = [];
    for (const btn of btns) {
      const t = btn.textContent.trim();
      if (t && /\.[a-z]{1,4}/i.test(t)) {
        const match = t.match(/_([^_]+\.[a-z]{1,4})/i);
        names.push(match ? match[1] : t.replace(/\d+줄.*$|\d+lines.*$/i, '').substring(0, 40));
      }
    }
    return names;
  };

  const beforeFiles = getFileNames();
  let attachBtns = fieldset
    ? fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]')
    : [];
  const actual = attachBtns.length;

  // Attachment gate: remove stale files from front if excess
  if (actual > expected) {
    const staleFiles = beforeFiles.slice(0, actual - expected);
    const freshFiles = beforeFiles.slice(actual - expected);
    const excess = actual - expected;
    for (let i = 0; i < excess; i++) {
      const btns = fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]');
      if (btns[0]) btns[0].click();
    }
    // Poll until count matches (100ms interval, 2s max)
    const ok = await new Promise(resolve => {
      const s = Date.now();
      const poll = setInterval(() => {
        const remain = fieldset.querySelectorAll('button[aria-label="Remove"], button[aria-label="제거"]').length;
        if (remain === expected) { clearInterval(poll); resolve(true); }
        else if (Date.now() - s > 2000) { clearInterval(poll); resolve(false); }
      }, 100);
    });
    if (!ok) {
      const remainFiles = getFileNames();
      return {
        sent: false, error: 'CLEANUP_FAILED',
        message: 'Stale attachments from a previous cycle were detected. Tried to remove ' + excess + ' stale file(s) [' + staleFiles.join(', ') + '] keeping ' + expected + ' fresh file(s) [' + freshFiles.join(', ') + ']. Removal did not complete within 2s. ' + remainFiles.length + ' file(s) remain: [' + remainFiles.join(', ') + ']. Retry this script.',
        remaining: remainFiles
      };
    }
  } else if (actual < expected) {
    return {
      sent: false, error: 'MISSING_ATTACHMENTS',
      message: 'Expected ' + expected + ' file(s) but only found ' + actual + ': [' + beforeFiles.join(', ') + ']. ' + (expected - actual) + ' file(s) missing. Ctrl+V paste may have failed or input was not focused. Re-run the file paste (Step 1), then retry this script.',
      found: beforeFiles
    };
  }

  // Type + send
  const sentWith = getFileNames();
  const el = document.querySelector('[contenteditable="true"][data-placeholder]')
    || document.querySelector('fieldset [contenteditable="true"]')
    || document.querySelector('[contenteditable="true"]');
  if (!el) return { error: 'INPUT_NOT_FOUND' };
  el.focus();
  el.textContent = '';
  document.execCommand('insertText', false, 'YOUR MESSAGE HERE');
  await new Promise(r => setTimeout(r, 300));
  const sendBtn = document.querySelector('button[aria-label="Send Message"], button[aria-label="메시지 보내기"]');
  if (!sendBtn) return { sent: false, error: 'SEND_BTN_NOT_FOUND' };
  sendBtn.click();

  const cleaned = actual > expected;
  return {
    sent: true,
    message: cleaned
      ? 'Removed ' + (actual - expected) + ' stale file(s) from front. Sent with ' + expected + ' file(s): [' + sentWith.join(', ') + '].'
      : expected > 0
        ? 'Sent with ' + expected + ' file(s): [' + sentWith.join(', ') + ']. No cleanup needed.'
        : 'Sent with no file attachments.',
    sentWith
  };
}
```
**Return values:**
- `sent: true` → message sent. `sentWith` lists the files that went with it. Always run the health check below to confirm delivery.
- `STILL_STREAMING` → previous response not finished. Wait via streaming check, then retry.
- `CLEANUP_FAILED` → stale attachments couldn't be removed in 2s. Retry the script.
- `MISSING_ATTACHMENTS` → fewer files than expected. Re-paste files (Step 1), then retry.
- No uid needed — DOM is manipulated directly via `evaluate_script`

### Health Check (after Step 2, single MCP call)
Confirms whether the message was actually sent. Waits 2s internally, then checks 4 indicators in a single evaluate_script:
```
chrome-devtools - evaluate_script
function: async () => {
  await new Promise(r => setTimeout(r, 2000));
  const input = document.querySelector('[contenteditable="true"][data-placeholder]')
    || document.querySelector('[contenteditable="true"]');
  const inputText = input ? input.textContent.trim() : '';
  const inputEmpty = inputText.length < 5;
  const stopBtn = document.querySelector(
    'button[aria-label="Stop Response"], button[aria-label="응답 중단"], button[aria-label="Stop response"]'
  );
  const isStreaming = !!stopBtn;
  const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
  const lastUserMsg = userMsgs[userMsgs.length - 1];
  let responseLen = 0;
  if (lastUserMsg) {
    let current = lastUserMsg;
    for (let depth = 0; depth < 10; depth++) {
      let parent = current.parentElement;
      if (!parent) break;
      let nextSib = parent.nextElementSibling;
      if (nextSib) {
        const text = nextSib.innerText;
        if (!text || text.trim().length === 0) { current = parent; continue; }
        if (text.includes('Claude is AI')) { current = parent; continue; }
        if (getComputedStyle(nextSib).opacity === '0') { current = parent; continue; }
        if (nextSib.children.length === 0 && text.length < 15) { current = parent; continue; }
        if (nextSib.querySelector('[data-testid="user-message"]')) { current = parent; continue; }
        responseLen = text.length;
        break;
      }
      current = parent;
    }
  }
  return { inputEmpty, inputTextLen: inputText.length, isStreaming, responseLen };
}
```
**Verdict:**
- Input empty + streaming → **sent successfully.** Proceed to streaming wait below.
- Input has text + not streaming → **send failed.** Resend.
- Input empty + not streaming → **ambiguous.** Check responseLen for further judgment.

**Resend procedure** (on send failure):
1. Run streaming check
2. Not streaming → resend via Enter
3. Re-run health check
4. After 2 retries still failing → report to user

## Wait for Response

After sending, wait for claude.ai to finish generating its response.

### Streaming Completion Detection (preferred: async Promise)
Single evaluate_script call that waits until response is complete. Checks every 3 seconds, 5-minute timeout:
```
chrome-devtools - evaluate_script
function: async () => {
  return new Promise(resolve => {
    const check = setInterval(() => {
      const stopBtn = document.querySelector('button[aria-label="응답 중단"], button[aria-label="Stop Response"]');
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
- Returns: `'DONE'` (complete) or `'TIMEOUT'` (exceeded 5 min)
- For complex prompts (web search, deep research): increase timeout to `600000` (10 min)
- On error (tab navigated/crashed): re-select tab (`select_page`) and retry

### Stability Check (single MCP call — prevents false completion)
After streaming wait finishes, confirm the response is truly complete. Measures response text length twice at 3-second intervals — if equal, it's done:
```
chrome-devtools - evaluate_script
function: async () => {
  const getLen = () => {
    const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
    const last = userMsgs[userMsgs.length - 1];
    if (!last) return 0;
    let current = last;
    for (let depth = 0; depth < 10; depth++) {
      let parent = current.parentElement;
      if (!parent) break;
      let nextSib = parent.nextElementSibling;
      if (nextSib) {
        const text = nextSib.innerText;
        if (!text || text.trim().length === 0) { current = parent; continue; }
        if (text.includes('Claude is AI')) { current = parent; continue; }
        if (getComputedStyle(nextSib).opacity === '0') { current = parent; continue; }
        if (nextSib.children.length === 0 && text.length < 15) { current = parent; continue; }
        if (nextSib.querySelector('[data-testid="user-message"]')) { current = parent; continue; }
        return text.length;
      }
      current = parent;
    }
    return 0;
  };
  const len1 = getLen();
  await new Promise(r => setTimeout(r, 3000));
  const len2 = getLen();
  return { len1, len2, stable: len1 === len2 && len1 > 0 };
}
```
- `stable: true` → proceed to response extraction.
- `stable: false` → text is still changing. Repeat stability check. (After 3 retries still unstable, attempt extraction anyway.)

### Error Response Principle
**If the extracted response looks wrong (too short, unexpected content), do not judge based on assumptions alone — take a screenshot or re-read the DOM to confirm the actual state before acting.**

### Streaming Detection (fallback: manual polling)
Use when the async method returns errors or MCP doesn't support async:
```
chrome-devtools - evaluate_script
function: () => {
  const stopBtn = document.querySelector('button[aria-label="응답 중단"], button[aria-label="Stop Response"], button[aria-label="Stop response"]');
  const streaming = document.querySelector('[data-is-streaming="true"]');
  return {
    isStreaming: !!(stopBtn || streaming),
    hasStopButton: !!stopBtn,
    hasStreamingAttr: !!streaming
  };
}
```
Run this every 3-5 seconds. When `isStreaming` becomes `false`, the response is complete.

## Read Response

**NEVER read via screenshot** — long responses won't fit on screen.

### (Recommended) Scroll to Bottom Before Extraction
Separate evaluate_script call to scroll down. Ensures lazy rendering completion + user visibility. Must be a separate call from extraction (browser needs time to render):
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
claude.ai currently doesn't use virtual scrolling so extraction works without scrolling, but recommended for future-proofing + user visibility.

### Extract Last Assistant Response
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

⚠️ **Server Instability**
claude.ai may show toast errors during outages.
Symptoms: frozen spinner, empty response, or old/irrelevant response extracted.
If suspected, wait before retrying rather than looping immediately.

## Artifact (File) Reception

When web Claude generates artifacts (code files etc.), save them locally with **zero context consumption**.

### Chrome Download Path Detection
Determine Chrome's download directory before receiving artifacts. Read from Chrome Preferences:
```
Bash - node -e "const p=require('path'),os=require('os'); const prefs=JSON.parse(require('fs').readFileSync(p.join(os.homedir(),'AppData/Local/Google/Chrome/User Data/Default/Preferences'),'utf8')); console.log(prefs.download?.default_directory || p.join(os.homedir(),'Downloads'))"
```
> macOS: `~/Library/Application Support/Google/Chrome/Default/Preferences`
> Linux: `~/.config/google-chrome/Default/Preferences`

### Artifact List Query
Check if the response contains artifacts:
```
chrome-devtools - evaluate_script
function: () => {
  const cards = document.querySelectorAll('[data-testid*="artifact"], [role="button"]');
  const artifacts = [];
  cards.forEach(c => {
    const text = c.textContent?.trim();
    if (text && (text.includes('Download') || text.includes('다운로드')) && !text.includes('all') && !text.includes('모두')) {
      const name = text.replace('Download', '').replace('다운로드', '').trim();
      artifacts.push(name);
    }
  });
  return { count: artifacts.length, artifacts: artifacts };
}
```

### Artifact Reception Procedure (download method, recommended)

Code files may not work with the "Copy" button, so **prefer the download method**. Works on all OS.

1. Click the artifact's "Download" button (set `artifactName` to the artifact title):
```
chrome-devtools - evaluate_script
function: () => {
  const artifactName = 'Utils'; // ← SET THIS to the artifact title
  const cards = document.querySelectorAll('[data-testid*="artifact"], [role="button"]');
  const card = Array.from(cards).find(c => c.textContent.includes(artifactName));
  if (!card) return 'CARD_NOT_FOUND';
  const dlBtn = Array.from(card.querySelectorAll('button')).find(btn => {
    const aria = btn.getAttribute('aria-label') || '';
    const text = btn.textContent?.trim() || '';
    return /download|다운로드/i.test(aria) || /download|다운로드/i.test(text);
  });
  if (dlBtn) { dlBtn.click(); return 'downloading ' + artifactName; }
  return 'DL_BTN_NOT_FOUND';
}
```

2. Wait for download to complete (1-2 seconds):
```
Bash - sleep 2
```

3. Find the latest file in the download folder (Chrome appends `(N)` for duplicates, so use glob+mtime):
```
Bash - ls -t "<download-path>/filename"* | head -1
```
Example: `ls -t ~/Downloads/utils*.py | head -1` → most recent `utils.py` or `utils (2).py`

4. Move to the desired location:
```
Bash - mv "<downloaded-file-path>" "<final-destination>"
```

5. Repeat steps 1-4 for additional artifacts.

### Notes
- Chrome names duplicate downloads as `filename (N).ext` (all OS, Chrome behavior). `ls -t glob | head -1` gets the latest.
- Responses without artifacts return a card count of 0.
- The "Download" button text varies by UI language (`Download` / `다운로드`).

## Token Saving — English Conversation Mode

Korean uses ~1.5-2x more tokens than English. For automated processing where the user isn't watching, communicate in English to save tokens.

### Rules
- **User is watching** (user said "discuss with claude.ai", "ask", etc. and waits for result): Use the user's language
- **Automated processing** (Claude Code collaborates with claude.ai on its own for problem-solving): Append `"Answer in English only."` to the message, process internally, then report to user in their language

## Tab Usage Rules

**Default: Use the currently open claude.ai chat. Do NOT navigate with navigate_page.**

1. If the user has a page open, remember the current URL (format: `https://claude.ai/chat/{chat-id}`)
2. If no `https://claude.ai/` tab exists among open tabs, navigate to the remembered URL (or `https://claude.ai/` if none remembered)

After page load, perform the input → send → read response procedure above.

## Saving Conversation Conclusions

After conversing with claude.ai, ask yourself before responding to the user:

**"Is there any decision or discovery from this conversation that exists only in my context and is not recorded in any file?"**

If yes, save to session memory. If no, don't save.

Format:
- keyword: searchable topic slug
- summary: 1-line summary
- decisions: list of decisions/findings (with rationale)
- Do NOT copy the entire conversation — extract conclusions only

## Multi-turn Conversations

For discussions, reviews, or verification: don't stop after one round. Read the response and follow up until a conclusion is reached. For simple questions, a single round is fine. When sending messages, always include the current situation and what kind of input you need (review, verification, opinion, direction).

Do NOT just dump materials and ask "what do you think?" Always include your own analysis and specific questions/counterpoints. Not "here's the code, please review" but "here's the code and my analysis. Specifically, I think X about Y — do you agree or have a counterargument?"

## Verification Protocol Tag (VERIFICATION_TAG)

When iterative verification is needed, append this tag to the end of verification request messages to web Claude. It forces a structured response format so the next action (fix/complete) is unambiguous.

**Tag (paste verbatim at the end of verification request messages):**
```
---
[VERIFICATION PROTOCOL]
After your review, end your response with exactly one of:
⚠️ CORRECTIONS: [N] — fix these and send back for re-verification.
✅ CONFIRMED — no issues found.
---
```

**Usage rules:**
- Append only to verification (VERIFY) messages
- Do NOT append to instruction request (INSTRUCT) messages
- Append independently from `"Answer in English only."` (the English directive goes on all messages separately)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| chrome-devtools MCP disconnected | Reconnect in `/mcp` |
| Input field not found | claude.ai UI updated — search `[contenteditable="true"]` via evaluate_script |
| Cannot read response | `[data-testid="user-message"]` selector changed — re-explore DOM |
| "Server running at: starting…" | MCP client (Claude Code) must invoke a tool for the server to start |

---

## DOM Selector Update Rules

**claude.ai's DOM structure can change at any time with UI updates.**

When a selector stops working:
1. Explore the actual DOM via `evaluate_script` to find new selectors
2. **Do NOT delete previous methods** — record as versioned history below
3. Update scripts to the latest version, keeping old selectors as fallbacks
4. Record the date, change, and reason in the changelog

## Verified Selectors & Methods

| Component | Selector / Value | Language | Verified | Notes |
|-----------|-----------------|----------|----------|-------|
| Stop button | `"Stop response"` | EN | 2026-03-25 | Primary |
| Stop button | `"응답 중단"` | KO | 2026-03-25 | Primary |
| Stop button | `"Stop Response"`, `"응답 중지"` | EN/KO | 2026-03-22 | Fallback |
| File remove | `"Remove"` | EN | 2026-03-25 | |
| File remove | `"제거"` | KO | 2026-03-23 | |
| Streaming wait | async Promise + setInterval(3s) | — | 2026-03-24 | Preferred |
| Streaming wait | repeated evaluate_script (3-5s) | — | 2026-03-22 | Fallback for async-unsupported MCP |
| File verification | DOM text search (~100 tokens) | — | 2026-03-23 | |
| Send button | `"Send Message"` | EN | 2026-03-28 | |
| Send button | `"메시지 보내기"` | KO | 2026-03-28 | |

### File Attachment Removal

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

#### Fallback Selector Search
If `aria-label="Remove"` / `"제거"` stops working:
1. **Enumerate all fieldset buttons**: Check aria-label, title, class, SVG presence
2. **Explore file card structure**: Find sibling buttons of filename elements
3. **Try aria-label variants**: `"Remove"`, `"remove"`, `"Delete"`, `"삭제"`, `"Close"`, `"제거"`
4. **Last resort**: Click SVG-only buttons (no text, only SVG child) next to filename buttons