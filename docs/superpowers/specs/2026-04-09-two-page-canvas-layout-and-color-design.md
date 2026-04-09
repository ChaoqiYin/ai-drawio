# Two-Page Canvas Layout And Color Design

**Goal:** Refine the live draw.io document in `本地 AI 会话 3` so the two pages read as one coherent narrative, with clearer page roles, improved spacing, and a shared light blue-green visual system.

## Scope

This change targets the current live canvas document opened through `ai-drawio`.

- Page 1 should act as the high-level overview page.
- Page 2 should act as the structural breakdown page.
- Both pages should share one restrained, efficient visual language.

This work does not change the underlying product UI shell, the conversation timeline UI, or draw.io runtime code.

## Current Problems

- The two pages feel visually unrelated even though they describe one system.
- Default neutral styles make the diagrams feel unfinished rather than intentionally calm.
- Page 1 communicates the main flow, but hierarchy is weak and major groups do not stand out enough.
- Page 2 contains the more detailed structure, but its grouping and placement do not strongly express “detail expansion from page 1”.

## Approved Direction

The approved direction is:

- Narrative across two pages, not within one page
- Light, professional color palette
- Efficiency-tool tone rather than showcase or poster styling

## Page Roles

### Page 1: Overview

Page 1 remains a left-to-right overview flow:

- User demand
- AI
- Schema definition cluster
- Schema render engine
- Large-screen result
- Editor feedback loop

The page should read quickly in one pass. The Schema definition cluster is the dominant middle anchor. Supporting nodes should remain readable but secondary.

### Page 2: Breakdown

Page 2 becomes the structural expansion of page 1:

- Global schema cluster on the left
- AST schema cluster on the upper right
- Render engine centered below the two inputs
- Output branches below the engine

This page should feel like “what page 1 unfolds into”, not like an unrelated second sketch.

## Layout Changes

### Page 1

- Strengthen the central cluster by giving the Schema definition container a calmer tinted surface and clearer border.
- Keep the primary process left-to-right with more intentional alignment.
- Keep the editor feedback path visually lighter than the main forward flow so it reads as a secondary loop.
- Preserve enough whitespace around the main nodes so the page remains skimmable.

### Page 2

- Make the left global-schema group larger and more stable.
- Place the AST group higher and to the right so it reads as a secondary but related source.
- Keep the render engine centered below the two inputs as the convergence point.
- Keep the lower outputs aligned and readable as two explicit result branches.

## Color System

Use a restrained light palette:

- Base surfaces: white to cool off-white
- Primary borders: soft desaturated blue
- Supporting accents: muted blue-green
- Text: dark blue-gray instead of harsh black

Semantic application:

- Page containers and major groups use the lightest tinted fills.
- Main pipeline nodes use slightly stronger blue emphasis.
- Supporting or output nodes use softer green-blue emphasis.
- Connector strokes stay darker than fills but lighter than black.

## Non-Goals

- No dark mode treatment
- No highly decorative gradients
- No page-level illustrations or ornamental shapes
- No major changes to the diagram content model or wording unless needed for clarity

## Verification

The result is acceptable only if:

- both pages still validate structurally
- no nodes overlap
- connector routing remains readable
- page 1 clearly reads as overview
- page 2 clearly reads as detailed expansion
- both pages visibly belong to the same visual system
