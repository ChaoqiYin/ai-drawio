---
name: drawio-diagramming
description: Draw.io diagram authoring guidance for `.drawio` documents and `mxGraphModel` XML. Use when an agent needs to create, edit, review, debug, or repair draw.io diagrams, especially for valid XML structure, node and edge patterns, routing, spacing, containers, groups, swimlanes, or malformed diagram markup.
---

# Drawio Diagramming

## Overview

Use this skill for draw.io XML content work: XML authoring technique, layout planning, connector routing, container structure, and validity review. Keep this file lean and load only the reference that matches the immediate problem.

This skill is content-only. It does not define task routing, file-output policy, or how to operate any editor, desktop app, or CLI tool. Any delivery skill that uses it remains responsible for execution flow, enforcement, and acceptance checks.

## Priority Order

1. Treat the `Quick Guidance` section below as the highest-priority default for diagram layout decisions within this skill unless the user explicitly overrides it.
2. When convenience, compactness, or minimal-edit choices conflict with readability, non-overlap, or clear connector routing, follow `Quick Guidance`.

## Workflow

1. Stay in this skill for content problems such as malformed XML, poor routing, overlapping edges, nested layout issues, or unclear container structure.
2. Load only the reference file that matches the content problem:
   - `references/xml-authoring.md` for `.drawio` structure, `mxGraphModel` structure, `mxCell` patterns, style keys, IDs, escaping, and XML well-formedness.
   - `references/layout-and-containers.md` for edge routing, spacing, waypoints, arrowhead clearance, groups, swimlanes, containers, and parent-child layout.
3. Use `Quick Guidance` to shape node placement, spacing, exits, entries, and routing before finalizing XML content.
4. Author or patch the smallest valid XML section that solves the content problem.
5. Prefer solving routing problems by improving node placement, column structure, and spacing before adding extra edge complexity.
6. Validate the invariants before returning the XML content.

## Invariants

- Keep the document wrapper intact when working with a full `.drawio` file.
- Ensure each diagram page contains a valid `mxGraphModel` root structure.
- Keep `mxCell` IDs unique within the diagram.
- Use the correct `parent` for every vertex and edge.
- Give every edge an expanded `mxGeometry` child with `relative="1"` and `as="geometry"`.
- Use container parent-child relationships instead of visually stacking shapes.
- Escape XML special characters in attribute values.
- Avoid illegal XML comments such as `<!-- bad -- comment -->`.
- Keep arrow direction aligned with the final segment direction at the target end of the connector.
- If a connector enters from the left or right side of a shape, make the final segment horizontal unless the user explicitly wants otherwise.
- If a connector enters from the top or bottom side of a shape, make the final segment vertical unless the user explicitly wants otherwise.

## Quick Guidance

- Unless the user explicitly says which objects may overlap, treat overlap-free layout as a required layout property rather than a preference.
- By default, do not allow ordinary shapes to overlap other ordinary shapes or connector paths.
- By default, do not allow connector paths or arrowheads to pass through ordinary shapes.
- By default, do not allow important connector paths to visually collapse onto the same narrow channel when separate routing would be clearer.
- Treat containers as layout boundaries rather than overlap violations for their child content.
- Minimize connector crossings by default and accept them only when the alternative would make the layout less readable.
- Plan layout in layers, columns, and connector channels before finalizing node positions or edge routing.
- Prefer simple geometry and explicit waypoints over clever style combinations.
- Increase node spacing before adding routing complexity.
- For dense or compact diagrams, use explicit exits, entries, and waypoints for critical edges instead of relying on automatic orthogonal routing alone.
- Use `orthogonalEdgeStyle` by default for diagrams that benefit from readable right-angle connectors.
- Treat container layout and edge routing as first-class design work, not cleanup after shapes are placed.
- Prefer fewer bends over decorative routing. If a connector can be made clear with a straight line, do not add a waypoint.
- Prefer horizontal and vertical connectors over diagonal connectors unless the user explicitly prefers diagonal routing.
- If only one connector uses a given side of a shape, prefer the center point of that side for the entry or exit.
- If multiple connectors share one side of a shape, spread them along that side only as much as needed to avoid overlap or ambiguity.
- When one shape side has a single connector, do not move that connector away from the side center unless doing so avoids a real overlap, crossing, or label collision.
- For opposing left-to-right flows, favor layered columns and direct center-to-center channels before introducing detours.
- When two connectors enter the same target side, keep each connector's final segment direction consistent with the side semantics and separate them by entry position rather than by adding unnecessary bends.

## References

- `references/xml-authoring.md`
- `references/layout-and-containers.md`
