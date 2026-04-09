# Connector Verification (Scripted)

Load this when the task needs verification or final sign-off for a diagram.

This verification is **script-only** for normal sign-off. It replaces subjective inspection with repeatable checks.

## Required Checks (Gate)

Do not treat apply success or a visible live canvas as completion.

For every verification pass:

1) Fetch the current XML to a temp file.

```bash
"$AI_DRAWIO_BIN" canvas document.get sess-123 --output-file /tmp/ai-drawio-current.drawio
```

2) Run the structural validator on the fetched XML.

```bash
python3 skills/ai-drawio-cli/scripts/validate_drawio_xml.py /tmp/ai-drawio-current.drawio
```

- Run from the repository root, or replace the script path with an absolute path.
- Any `FAIL` line or any `ERROR:` output is a failed verification.
- The validator aggregates all findings and exits non-zero only after reporting them, except for XML parse failures which abort immediately.
- Treat missing edge `source`/`target`, dangling references, duplicate ids, and malformed payload as hard failures.
- To intentionally skip specific checks, use script flags such as `--no-overlap`, `--no-arrows`, `--no-through-shape`, or `--no-crossings`.

The scripted validator covers these repeatable checks:

- Vertex overlap (positive-area rectangle overlap, excluding ancestor/descendant containment).
- Arrow direction (edges must define a non-none `endArrow` at the target).
- Connector-through-shape (edge polylines must not intersect other vertex rectangles).
- Edge crossings (detect line segment crossings; colinear shared-channel overlap is treated as an error).

## Final Response Rules

- Present a page-by-page summary based on the validator output (cells/vertices/edges + any warnings).
- Mark each page as passed, failed, or exception-approved. Do not give only a document-level verdict for a multi-page result.
- Call out any exception explicitly.
- Do not summarize verification with vague statements such as "checked" or "looks fine".
