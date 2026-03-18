---
name: drawio-diagramming
description: Draw.io diagram authoring guidance for `.drawio` documents and `mxGraphModel` XML. Use when an agent needs to create, edit, review, debug, or repair draw.io diagrams, especially for valid XML structure, node and edge patterns, routing, spacing, containers, groups, swimlanes, or malformed diagram markup.
---

# Drawio Diagramming

## Overview

Use this skill for draw.io XML content work: XML authoring technique, layout planning, connector routing, container structure, and validity review. Keep this file lean and load only the reference that matches the immediate problem.

This skill is only about diagram content. It does not define task routing, file-output policy, or how to operate the desktop app or `ai-drawio` CLI.
If the user wants the diagram drawn, rendered, or applied in live draw.io, you must also use `ai-drawio-cli` and continue to `canvas document.apply`.

## Workflow

1. Stay in this skill for content problems such as malformed XML, poor routing, overlapping edges, nested layout issues, or unclear container structure.
2. If the user wants the result applied to the live draw.io canvas, pair this skill with `ai-drawio-cli` and treat any generated XML or `.drawio` file as an intermediate artifact rather than completion.
3. Load only the reference file that matches the content problem:
   - `references/xml-authoring.md`
     - Use for `.drawio` structure, `mxGraphModel` structure, `mxCell` patterns, style keys, IDs, escaping, and XML well-formedness.
   - `references/layout-and-containers.md`
     - Use for edge routing, spacing, waypoints, arrowhead clearance, groups, swimlanes, containers, and parent-child layout.
4. Author or patch the smallest valid XML section that solves the content problem.
5. Validate the invariants before returning the XML content.

## Invariants

- Keep the document wrapper intact when working with a full `.drawio` file.
- Ensure each diagram page contains a valid `mxGraphModel` root structure.
- Keep `mxCell` IDs unique within the diagram.
- Use the correct `parent` for every vertex and edge.
- Give every edge an expanded `mxGeometry` child with `relative="1"` and `as="geometry"`.
- Use container parent-child relationships instead of visually stacking shapes.
- Escape XML special characters in attribute values.
- Avoid illegal XML comments such as `<!-- bad -- comment -->`.

## Quick Guidance

- Prefer simple geometry and explicit waypoints over clever style combinations.
- Increase node spacing before adding routing complexity.
- Use `orthogonalEdgeStyle` by default for diagrams that benefit from readable right-angle connectors.
- Treat container layout and edge routing as first-class design work, not cleanup after shapes are placed.

## References

- `references/xml-authoring.md`
- `references/layout-and-containers.md`
