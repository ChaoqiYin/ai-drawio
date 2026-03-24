# `ai-drawio-cli` with `drawio-diagramming`

Load this only when the task is diagram authoring or layout correction and `drawio-diagramming` applies.

## Role Split

- `drawio-diagramming` defines diagram rules.
- `ai-drawio-cli` owns execution flow and final sign-off.

## Authoring Rules

- Inherit `drawio-diagramming` `Priority Order` over convenience rules such as `Minimal Path Rule`.
- Apply `drawio-diagramming` during authoring, not only during final inspection.
- Before drafting XML, reusing existing XML, or choosing a minimal command path, turn the relevant `Priority Order` and `Quick Guidance` items into an authoring checklist.
- For each page in a multi-page document, build a separate authoring checklist instead of reusing one shared checklist for the whole document.
- If the source content defines a page-level reading direction such as `TB`, `BT`, `LR`, or `RL`, convert that direction into an explicit layout rule before placing nodes or routing edges.
- Use that checklist to plan layers, columns, connector channels, side entries and exits, spacing, and waypoint needs.
- If an existing layout conflicts with the checklist, restructure it instead of preserving weak geometry for convenience.
- Treat readability failures such as crowded fan-out from one side, ambiguous shared channels, or a layout that visually contradicts the source reading direction as real authoring failures, not cosmetic issues.
- Do not replace paired-skill requirements with generic checks such as "no obvious overlap".

## Inspection Rules

- For rendered inspection or final sign-off, also load `references/connector-verification.md`.
