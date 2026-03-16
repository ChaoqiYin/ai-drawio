# Session Workspace Spacing Polish Design

**Date:** 2026-03-13

## Goal

Loosen the spacing rhythm of the `/session` workspace page so the header, sidebar, toolbar, and canvas area feel less compressed while preserving the existing desktop shell structure.

## Scope

- Only adjust the internal session workspace page.
- Keep the existing layout architecture, routing, and draw.io integration unchanged.
- Do not modify the home page.
- Do not modify anything under `webapp/`.

## Approved Direction

- Increase the outer shell padding slightly so the page does not feel pinned to the viewport edge.
- Add a little more separation between the header card and the main split body.
- Give the sidebar panel more internal breathing room around its title, description, alerts, and scrollable message list.
- Add more vertical separation between the right-side toolbar card and the canvas frame.
- Slightly relax the canvas frame radius and surrounding spacing so it reads as the main focus area.

## Constraints

- No structural changes to the flex shell.
- No new modules or extra interface sections.
- No spacing changes that cause horizontal overflow.
- Keep the page efficient and workspace-oriented rather than decorative.

## Verification

- Add minimal source-level assertions for the new spacing hooks.
- Run the session workspace source-level test.
- Run the full Node test suite.
- Run the web build.
