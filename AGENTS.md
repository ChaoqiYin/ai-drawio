# Repository Guidelines

## Project Structure & Module Organization
`app/` contains the Next.js shell. Keep route files in `app/(internal)/` and shared client helpers in `app/(internal)/_lib/` and `app/(internal)/_components/`. `src-tauri/src/` contains the Rust desktop shell, CLI bridge, and control server. `webapp/` is the bundled draw.io source; treat it as upstream content and avoid ad hoc edits unless the change is explicitly about draw.io assets. `scripts/prepare-drawio.ts` copies `webapp/` into `public/drawio/` during frontend builds. Put regression tests in `tests/` and design or implementation notes in `docs/`.

## Build, Test, and Development Commands
`npm install` installs the Node toolchain. `npm run web:dev` starts the Next.js shell on `127.0.0.1:3001`. `npm run dev` regenerates icons and launches `tauri dev`. `npm run build:web` prepares draw.io assets and builds the static frontend export. `npm run build` rebuilds icons and creates the Tauri app bundle. `npm run test:node` runs the TypeScript test suite with Node's built-in test runner. For Rust-only validation, use `cargo check --manifest-path src-tauri/Cargo.toml`.

## Coding Style & Naming Conventions
Match the existing file style instead of introducing a new formatter profile. TypeScript in this repo uses single quotes, semicolons, and descriptive camelCase helpers; React components and store modules use PascalCase filenames only when the file exports a component type, otherwise keep kebab-case or descriptive lower-case names aligned with nearby files. Rust code should stay `rustfmt`-friendly with small modules and explicit command names. Do not hand-edit generated outputs in `public/drawio/`, `out/`, or `src-tauri/target/`.
For ordinary internal pages, prefer a vertical flex shell with a fixed-height top navigation or page header and a `flex-1 min-h-0` body that consumes the remaining height. Keep primary scrolling inside the lower content region instead of on the whole page. When that lower region is split again into panels or columns, keep `min-w-0`, `min-h-0`, and `overflow-hidden` constraints in place so width and height calculations stay stable.

## Testing Guidelines
Add tests under `tests/*.test.ts`. Prefer focused regression tests that lock down route behavior, store transitions, CLI contracts, and source-level invariants. Follow the existing pattern: import from `node:test` and `node:assert/strict`, then keep each test name specific, for example `test("getDrawioCopyPlan maps webapp into public drawio", ...)`.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit-style prefixes such as `feat:`, `refactor:`, and `docs:`. Keep the prefix and write a short imperative summary. Pull requests should explain the user-visible change, list verification commands, and link the relevant plan or issue when one exists. Include screenshots for UI changes and terminal examples for CLI behavior changes.
