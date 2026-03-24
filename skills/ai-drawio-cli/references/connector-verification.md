# Connector Verification

Load this when the task needs rendered inspection or final sign-off for a diagram.

## Inspection Rules

- Do not treat apply success, preview export, or a visible live canvas as completion.
- If no paired content skill defines stricter requirements, this file is the default rendered sign-off standard for the document.
- Build an explicit connector checklist before declaring any draft acceptable.
- For multi-page documents, build and complete a separate checklist for every page. Do not sign off one page based on another page's result.
- Verify every connector for endpoints, side semantics, first and final segment direction, arrowhead alignment at the target, crossings, and overlap or channel crowding.
- Verify each page's overall reading direction against the source diagram semantics. A source flow such as left-to-right must still read left-to-right after layout, and a top-to-bottom flow must still read top-to-bottom, unless the user explicitly approved a different layout.
- Run whole-diagram checks for ordinary-shape overlap, connector-through-shape violations, connector crossings, crowded shared-channel review, and excessive same-side fan-out that harms readability even if nothing technically overlaps.
- If PNG review is insufficient, inspect SVG paths or XML geometry.
- Treat any unchecked item as failed.

## Final Response Rules

- Present the completed checklist in a scannable form, page by page.
- Mark each page as passed, failed, or exception-approved. Do not give only a document-level verdict for a multi-page result.
- Call out any exception explicitly.
- Do not summarize verification with vague statements such as "checked", "looks fine", or "preview exported successfully".
