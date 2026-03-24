# Page2 Left-To-Right Layout Design

## Context

The current task is to optimize the existing `Page 2` layout in the live draw.io document.
The user confirmed that the target is the draw.io page itself, not an application preview surface.

## Confirmed Constraints

- Optimize `Page 2` only.
- Use a left-to-right layout.
- Organize by system modules, not by business sequence.
- Do not force fixed lane labels up front.
- Do not add, remove, merge, or split nodes.
- Reorder only the existing nodes and connectors.
- Prefer readability over compactness.

## Recommended Layout

Use a single horizontal backbone across the middle of the page.
Place the longest or most central dependency chain on that backbone from left to right.
Place secondary modules above or below their closest backbone module instead of inserting them between backbone columns.

Reserve three routing bands:

- one center band for the backbone connectors
- one upper band for upward branch connectors
- one lower band for downward branch connectors

Keep connector movement mostly orthogonal.
Prefer horizontal travel first, then short vertical entry into the target node.
Reduce cross-page diagonals, backward edges, and overlapping connector channels where possible without changing the document structure.

## Validation Goals

After re-layout, `Page 2` should show:

- a clear left-to-right reading direction
- one obvious visual backbone
- fewer crossings than the current layout
- no ordinary node overlap
- more stable spacing between module groups
