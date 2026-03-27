---
description: "[INTERNAL] Execute tasks from a document plan sequentially with INSTRUCT/WORK/VERIFY cycle and optional web Claude verification"
argument-hint: '"path" [instructions] [web claude verify] [commit per item] [Phase N only] [context N%]'
---
Execute a documented work plan item by item in sequence. The user provides a path and instructions via `$ARGUMENTS`.

## Foundational Premise: Role Structure

```
User (principal)
  └─ Issues the initial work directive
  └─ Does not intervene until completion (receives only the final result)

Web Claude (manager)
  └─ Receives the user's directive and formulates a concrete work plan
  └─ Instructs Claude Code on what to do, in what order, from what perspective
  └─ Reviews Claude Code's work and either requests corrections or approves
  └─ Drives progress autonomously until all items are complete

Claude Code (executor)
  └─ Performs actual work per web Claude's instructions
  └─ Raises scope concerns before starting WORK
  └─ May offer opinions on work results
  └─ Negotiates with web Claude on disagreements until consensus
```

**Core principle**: The user directs once, then web Claude drives everything to completion. Claude Code does not judge and proceed alone. Only in standalone mode does Claude Code use its own judgment.

## Input Parsing
- Separate the path (file or directory) and natural language instructions from `$ARGUMENTS`
- If a directory, treat README.md as the main document
- If keywords like "web claude", "verify", "discuss", "claude.ai", "review", "together" are present → enable web Claude verification mode
- The user's natural language instructions always override this command's default behavior

## Step 0: Pre-flight Checks (before the user steps away)
Tell the user:
> "Checking prerequisites before starting."

### Document Path Check (required)
- Verify `$ARGUMENTS` contains a path that exists
- If missing or invalid → ask the user for the path → wait
- If a directory, confirm README.md exists; if not, ask which file is the main document

### Web Claude Communication Skill (verification mode only)
All communication with web Claude follows the `ask-claude-web` skill procedures.

### Web Claude Check (verification mode only)
Check in order:
1. chrome-devtools MCP connection (`list_pages` call)
2. claude.ai tab exists and is the only one
3. Input field is accessible (`evaluate_script` to find `contenteditable`)

- All OK → "Ready." → proceed immediately
- Any failure → describe the specific issue + ask user to fix → wait
  - MCP not connected: "Reconnect chrome-devtools in /mcp"
  - No tab: "Open a claude.ai tab"
  - Multiple tabs: ask which tab to use
  - Input field inaccessible: "MCP reconnect needed"

## Step 1: Generate Execution Plan + Show to User

Read the main document and identify the work items in natural language (no fixed format — each document may differ).

### Create _progress.md
Create `_progress.md` in the same directory as the main document. If it already exists, read it and resume. If any item is marked as interrupted, check session memory first.

`_progress.md` structure:
```
# Execution Plan

## Info
- Source document: (path)
- Mode: (web Claude verification / standalone)
- Total items: N
- Created: YYYY-MM-DD

## Workflow

🔁 **Web Claude verification mode — per item:**
  A. INSTRUCT — send work context to web Claude → web Claude directs approach/focus/challenge type
  B. WORK — execute work per web Claude's instructions
  C. PREP — compile work results + own analysis + specific questions/counterarguments
  D. VERIFY — send brief to web Claude, receive response
  E. RESPOND + RECORD — produce deliverable, fix/negotiate → record conclusions to file

🔁 **Standalone mode — per item:**
  A. WORK — execute work
  B. SELF-VERIFY — self-check (GOTO loop until 0 issues)

🔁 **Loop ends when: all items complete OR context exceeds 400k tokens**

## Key Constraints (extracted from document)
- (auto-extracted caveats and dependencies from the source document)

## On Interruption
- Last state saved to session memory — check before resuming

---

# Progress

- [ ] Item 1: ... [challenge: pending]
      instruct: (pending)
      artifact: pending
- [ ] Item 2: ... [challenge: pending]
      instruct: (pending)
      artifact: pending

# Discovered Issues (out of scope — report to user at completion)
(none)
```

**Item List Immutability Principle**: The item list is finalized at Step 1 and must not be added to, deleted from, or split afterward. Scope is the user's decision. If out-of-scope issues are discovered during execution, record them in the "Discovered Issues" section immediately.

### Display Plan in Chat
If there are 5+ items, display this notice at the top of the plan output:
> "⚠️ There are N items. For quality, I recommend processing in batches of 5. If you agree, type 'proceed with first 5 then pause'."
If the user says nothing, proceed with all items (do not wait).

Output in this order:
1. `📋 Execution plan generated. Press ESC to abort if anything looks wrong.`
2. Output the **full contents** of `_progress.md` verbatim. Do not summarize or truncate.
3. `Proceeding now.`

Proceed to the loop immediately after display.

## Loop (Web Claude Verification Mode)

### A. INSTRUCT — Request Direction from Web Claude
- Send web Claude the current item's work context (**file list required** + scope + document content)
- "Please provide INSTRUCT: work approach, focus areas, challenge type. Answer in English only."
- Confirm work method, perspective, order, and challenge type from web Claude's response
- Record challenge and instruct fields in _progress.md
- From item 5 onward, include a role reminder at the start of INSTRUCT request messages:
  "[Role: You are the reviewer. Maintain consistent verification standards.]"

### B. WORK — Execute Work
- Reading target files while waiting for INSTRUCT is allowed, but final analysis and conclusions must reflect INSTRUCT content
- Check all pre-flagged items from INSTRUCT (must be reported in VERIFY's INSTRUCT_COVERAGE)
- Read the item's details from the main document + related docs + source code
- If web Claude's instructions appear to miss scope, raise the concern before proceeding
- Out-of-scope issues discovered → record in "Discovered Issues" immediately

### C. PREP — Prepare Brief
- Compile work results + own analysis + specific questions/counterarguments
- Follow the challenge format specified by web Claude in INSTRUCT

### D. VERIFY — Send to Web Claude + Receive Response
- Send the brief prepared in PREP to web Claude
- **First line of the message must contain `INSTRUCT_REF: Item #N`** — this proves that INSTRUCT was actually received for this item. Cannot be written for items without INSTRUCT. Web Claude will refuse to verify without this field.
- **Next line must contain `INSTRUCT_COVERAGE`** — judgment for each pre-flagged item from web Claude's INSTRUCT:
  ```
  INSTRUCT_COVERAGE:
  - Pre-flagged #1 (double CDR): FOUND HIGH — burst_cooldown CDR double-applied
  - Pre-flagged #2 (stale _shooter): CHECKED CLEAN — null guard at L47
  - Pre-flagged #3 (burst timing): NOT A BUG — last write wins
  ```
  - Every pre-flagged item gets one of: FOUND / CHECKED CLEAN / NOT A BUG / WAIVE + 1-line rationale
  - WAIVE — 1-line exemption reason required. Deferral language ("supplement later", "revisit") is prohibited
  - If web Claude finds omitted items → CORRECTIONS
- Append the following verification tag at the end of the message (use this command-specific tag instead of the skill's default tag). Do NOT append to INSTRUCT messages:
```
---
[VERIFICATION PROTOCOL]
If no "INSTRUCT_REF: Item #" line appears in the message above, respond ONLY with:
🚫 MISSING_INSTRUCT — cannot verify without INSTRUCT reference. Stopping review.
Otherwise, review the content and end with exactly one of:
⚠️ CORRECTIONS: [N] — fix these and send back for re-verification.
✅ CONFIRMED — no issues found.
---
```
- Check the status marker at the end of the response:
  - `✅ CONFIRMED` → proceed to E (consensus)
  - `⚠️ CORRECTIONS: [N]` → proceed to E (fixes needed)
  - `🚫 MISSING_INSTRUCT` → request INSTRUCT for this item (include target files + context) → receive web Claude's response → return to A
  - No marker → request marker from web Claude

### E. RESPOND + RECORD
- **If ⚠️ CORRECTIONS:**
  → Fix the issues, re-send to web Claude (include INSTRUCT_REF + verification tag) → return to D → repeat until resolved
- **If ✅ CONFIRMED:**
  → Record to conclusion file → record artifact path in _progress.md → mark item complete
  → Next item → repeat from A
  → All items complete → proceed to Completion

## Loop (Standalone Mode)

### A. WORK — Execute Work
- Claude Code proceeds with its own judgment, no manager
- Read the item's details from the main document + related docs + source code

### B. SELF-VERIFY — Self-check (GOTO loop until 0 issues)
- B-1. "What did I get wrong?" (start with adversarial self-questioning)
- B-2. Issue found → fix immediately → repeat B-1
- B-3. 0 issues confirmed → record to conclusion file → record artifact path → mark item complete
- Next item → repeat from A

## Conditional Context Check

During the loop, before starting each item, ask yourself:
> "Do I know the current execution mode and which item I'm working on?"
- Confident → continue
- Uncertain → re-read _progress.md

## Completion
- When all items are complete, **before** reporting to the user, request a violation check from web Claude:
  - Check only verifiable facts based on conversation history
  - Append the following tag at the end of the message:
  ```
  ---
  [VIOLATION CHECK]
  Review the conversation history and check ONLY verifiable facts:
  1. For each item: was INSTRUCT request sent before VERIFY? (message order)
  2. For each VERIFY: does INSTRUCT_REF match an actual INSTRUCT exchange?
  3. For each VERIFY: are INSTRUCT pre-flagged items addressed? (INSTRUCT_COVERAGE)
  4. Did any message contain false claims about previous messages?
  List violations with message references, or state:
  ✅ NO_VIOLATIONS — all verifiable protocol facts check out.
  ---
  ```
- **Include** web Claude's violation check result in the user report (do not omit)
- Then report progress and conclusions to the user
- If the "Discovered Issues" section has entries, include them in the report

## Context Management
If context usage exceeds 400k tokens:
1. Save current state to session memory (current item, remaining work, key decisions)
2. Record interruption in the progress file:
   - Mark the current item as "interrupted — in progress" (specify current stage A-E)
   - Add note: "Check session memory before resuming"
3. Report the interruption reason to the user → wait

## Rules
- The user's natural language instructions always override this command's default behavior
- Commits are not managed by this command. If the document has a commit strategy, follow it. If the user asks, execute it.
- Plan document formats vary — parse using natural language understanding
- Communication with web Claude is in English; user-facing reports follow the user's language
- When verification finds issues, fix them immediately. Never defer fixes to "later"
- When communicating with web Claude, always include your own analysis + specific questions (never just dump materials)
