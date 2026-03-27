---
description: "[INTERNAL] Post-completion violation audit — exhaustive rule compliance check for execute-loop sessions"
argument-hint: '_progress.md path [web claude cross-examine]'
---
Conduct an exhaustive rule violation audit for a just-completed work session and produce `_violations.md`. The user provides the `_progress.md` path via `$ARGUMENTS`.

## Foundational Premise

This command runs **after work is complete**. Do not run it during work. The violation audit is the final step — its result is reported to the user as the closing deliverable.

**Core principle**: Claude Code has a strong bias toward under-reporting its own violations. This command is designed to forcibly break that bias. "Not applicable" claims carry a burden of proof — unsubstantiated "N/A" is itself a violation.

## Input Parsing
- Extract the `_progress.md` path from `$ARGUMENTS`
- If keywords like "web claude", "together", "cross-examine" are present → enable web Claude cross-examination mode
- If `_progress.md` doesn't exist → ask the user for the correct path

## Preparation

1. Read `_progress.md` to understand the session:
   - Execution mode (web Claude verification / standalone)
   - Total item count
   - Completion status per item, CORRECTIONS count
2. Read the original command file to extract the **applicable rule set** (cmd_execute-loop-msg.md or the relevant command)
3. List the deliverable files in the output directory

## Phase 1: Claude Code Self-Audit

Answer **every** checklist item below without omission.
"Not applicable" must include evidence. **If you claim "no violation", prove why in one line. An unsubstantiated "N/A" is itself a violation.**

### A. Protocol Order Violations

Answer per item:

**A-1. Did WORK start only after INSTRUCT was fully received?**
- If "pre-reading files during INSTRUCT wait" was done: was it plain `Read`, or did it include analysis/pattern exploration?
- If analysis was done: did that analysis influence the final VERIFY?
- If an Agent subagent was spawned: quote the prompt sent to the Agent and distinguish "reading" from "analysis"

**A-2. Were all pre-flagged items from INSTRUCT checked?**
- If any were skipped: list each and explain why
- "Will supplement in the final report" also counts as **unchecked**
- Even if web Claude accepted it, Claude Code's violation is still a violation

**A-3. Did every VERIFY include INSTRUCT_REF and INSTRUCT_COVERAGE without omission?**

### B. Format Violations

**B-4. Was the RESPOND stage follow-up correctly performed?**
- On ⚠️ CORRECTIONS: were the issues actually fixed before re-sending?
- On ✅ CONFIRMED: was a conclusion file actually created?

**B-5. Were _progress.md instruct/challenge/artifact fields recorded before WORK started?**

**B-6. Was the verification tag (VERIFICATION PROTOCOL block) included in every VERIFY message?**

**B-7. Were INSTRUCT messages free of verification tags?** (including one is a violation)

### C. Content Accuracy

**C-8. Do the final report numbers (CRITICAL/WARNING/SUGGESTION) match the sum of individual documents?**
- Count manually and produce a comparison table:
  ```
  | Item | Per-doc C/W/S | Summary C/W/S | Match? |
  ```

**C-9. Among items judged "CHECKED CLEAN", were any actually problematic?**
- If an item was flagged in CORRECTIONS but was initially reported as CHECKED CLEAN, record it

**C-10. When receiving CORRECTIONS, did you claim "already addressed" for anything?**
- Verify whether it was actually addressed

### D. Communication Quality

**D-11. Was INSTRUCT request quality consistent across all items?**
- Compare character count of the first item's request vs the last item's request
- If >50% difference → record as "late-session acceleration" violation

**D-12. Did every web Claude message include your own analysis + specific questions (not just raw materials)?**

**D-13. Was any web Claude feedback ignored or downplayed?**
- List every instance of "will supplement in report" or "no impact" deferrals

### E. Self-Awareness (most important)

**E-14. Did you perform the A-D audit honestly?**
- Was there any item you were tempted to skip with "probably not a violation"?
- If so: why did you want to skip it, and is it actually a violation on re-examination?

**E-15. Are there items where you judged "violation but no impact"?**
- State the rationale for each
- **"Web Claude accepted it" alone is not rationale** — web Claude's acceptance is web Claude's judgment, not Claude Code's absolution
- **"The final output is correct" alone is also not rationale** — process violations and result quality are independent

## Phase 2: Web Claude Cross-Examination (web Claude mode only)

Send the Phase 1 results to web Claude with this request:

```
VIOLATION CROSS-EXAMINATION REQUEST

Below is Claude Code's self-reported violation audit for this session.

Please:
1. Verify each "N/A" claim — do you agree with the evidence provided?
2. Identify violations Claude Code missed — check conversation history for:
   - Times I started analysis before your INSTRUCT arrived
   - Times I ignored or minimized your feedback
   - Times my VERIFY didn't fully address your pre-flags
3. Report YOUR OWN violations:
   - Were your pre-flags comprehensive? List findings you discovered in CORRECTIONS that should have been pre-flagged.
   - Did you maintain consistent verification rigor? Compare CORRECTIONS rate for items 1-3 vs 7-9.
   - Did you use "will supplement in the report" or equivalent to defer checking? How many times?
   - Did you apply different standards to the same type of issue across items?
4. For each violation (mine or yours), state:
   - Whether it affected the final output quality
   - Whether it was a process violation or result violation

End with a summary table:
| Subject | Violation | Items | Severity | Output Impact |
```

After receiving web Claude's response:
- If web Claude identifies violations not in Phase 1 → add to the Phase 1 results
- Record web Claude's self-reported violations as well

## Phase 3: Write _violations.md

Create `_violations.md` in the same directory as `_progress.md`.

### File Structure

```markdown
# Rule Violation Report

**Date**: YYYY-MM-DD
**Authors**: Claude Code (executor) + Web Claude (reviewer) joint audit
**Target session**: (session name)

---

## Claude Code Violations

### Violation 1: (title)
- **Checklist item**: A-1 / B-4 etc.
- **Description**: ...
- **Affected items**: Item #N, #M
- **Rule text**: > quote
- **Cause**: ...
- **Impact**: (process violation / result violation)
- **Severity**: HIGH / MEDIUM / LOW

(repeat)

---

## Web Claude Violations (if applicable)

(same format)

---

## Per-Item Violation Matrix

| Item | A-1 | A-2 | B-4 | B-5 | C-8 | D-11 | ... |
|------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|

---

## Self-Awareness Reflection (E-14, E-15)

### Violations omitted from initial report
(Violations found in this audit vs what was reported to the user before this audit)

### Re-evaluation of "no impact" judgments
(Re-assess rationale for each)

---

## Joint Summary

| Subject | Violation Type | Count | Core Pattern |
|---------|---------------|-------|-------------|

(Structural analysis + improvement suggestions)
```

## Phase 4: Report to User

After writing `_violations.md`, report to the user:
1. Total violation count (Claude Code / web Claude)
2. Top 3 most severe violations
3. Comparison with previous runs (if applicable)
4. Structural improvement suggestions

## Rules

- **Under-reporting is strictly prohibited**: "No impact so it's not a violation" is not accepted. Process violations are violations regardless of outcome.
- **Web Claude acceptance ≠ absolution**: If web Claude accepted something with "will supplement in report", that's web Claude's leniency, not Claude Code's justification.
- **Late-session acceleration gets special scrutiny**: Check closely whether procedures were shortened in later items. This is a structural pattern confirmed across multiple prior runs.
- **"N/A" burden of proof**: For every checklist item, if you claim no violation, provide a one-line proof. Unsubstantiated "N/A" is treated as a violation.
- The user's natural language instructions always override this command's default behavior.
