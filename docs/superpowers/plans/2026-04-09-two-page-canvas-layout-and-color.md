# Two-Page Canvas Layout And Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the live draw.io document in `本地 AI 会话 3` so page 1 and page 2 form a coherent overview-to-detail sequence with improved layout and a shared professional light palette.

**Architecture:** Fetch the current draw.io XML through `ai-drawio`, patch the two page models in place, then apply the updated XML back to the same session. Verification uses the existing XML validator and fresh rendered preview export.

**Tech Stack:** `ai-drawio` CLI, draw.io `mxfile` XML, Python XML patching for the temporary document, repository validator script

---

### Task 1: Capture And Patch The Live Document

**Files:**
- Modify: `/tmp/ai-drawio-inspect/current.drawio`
- Create: `/tmp/ai-drawio-inspect/updated.drawio`

- [ ] **Step 1: Fetch the current live document**

Run: `/Applications/AI\ Drawio.app/Contents/MacOS/ai-drawio canvas document.get conversation-1775714312619506000-1 --output-file /tmp/ai-drawio-inspect/current.drawio`

Expected: JSON with `ok: true` and a `version` value.

- [ ] **Step 2: Patch page geometry and styles**

Update page 1 to strengthen the overview flow and page 2 to express the detail breakdown while applying one shared light blue-green palette.

- [ ] **Step 3: Save the patched document**

Write the patched XML to `/tmp/ai-drawio-inspect/updated.drawio`.

### Task 2: Apply And Verify

**Files:**
- Modify: `/tmp/ai-drawio-inspect/updated.drawio`
- Test: `skills/ai-drawio-cli/scripts/validate_drawio_xml.py`

- [ ] **Step 1: Apply the patched XML to the live session**

Run: `/Applications/AI\ Drawio.app/Contents/MacOS/ai-drawio canvas document.apply conversation-1775714312619506000-1 "Improve two-page layout and color hierarchy" --xml-file /tmp/ai-drawio-inspect/updated.drawio`

Expected: JSON with `ok: true`.

- [ ] **Step 2: Re-fetch the live document**

Run: `/Applications/AI\ Drawio.app/Contents/MacOS/ai-drawio canvas document.get conversation-1775714312619506000-1 --output-file /tmp/ai-drawio-inspect/verified.drawio`

Expected: JSON with `ok: true`.

- [ ] **Step 3: Run structural validation**

Run: `python3 skills/ai-drawio-cli/scripts/validate_drawio_xml.py /tmp/ai-drawio-inspect/verified.drawio`

Expected: no `FAIL` lines and exit code `0`.

- [ ] **Step 4: Export fresh preview images**

Run: `/Applications/AI\ Drawio.app/Contents/MacOS/ai-drawio canvas document.preview conversation-1775714312619506000-1 /tmp/ai-drawio-inspect`

Expected: JSON with both page preview paths.

- [ ] **Step 5: Inspect the two page previews**

Confirm:
- page 1 reads as overview
- page 2 reads as detail expansion
- both pages share one visual language
