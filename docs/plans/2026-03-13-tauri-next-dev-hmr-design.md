# Tauri Next Dev HMR Design

## Goal

Restore automatic page updates in desktop development mode by connecting `tauri dev` to a live Next.js development server with HMR, while keeping production builds on static export output.

## Decision

Use a split configuration:

- Development: `tauri dev` starts `next dev` and points the Tauri window to a local `devUrl`.
- Production: `tauri build` still runs the static export pipeline and loads files from `../out`.

## Scope

- Update `package.json` scripts for a dedicated web development server command.
- Update `src-tauri/tauri.conf.json` to use `beforeDevCommand` + `devUrl` for development.
- Update `next.config.mjs` so static export is enabled only outside development mode.

## Expected Behavior

- Running `npm run dev` should start Tauri plus a persistent Next dev server.
- Editing `app/` components should trigger live reload or HMR in the desktop window.
- Running `npm run build:web` should still export static files into `out/`.

## Risks

- If `output: "export"` stays enabled in development, Next dev may not behave like a normal HMR server.
- If the dev server binds to an unexpected host or port, Tauri will fail to connect.

## Testing

- Add a source-level test covering:
  - `package.json` contains a dedicated Next dev script
  - `src-tauri/tauri.conf.json` uses `beforeDevCommand` + `devUrl`
  - `next.config.mjs` only enables static export outside development mode
- Run focused tests.
- Run full Node tests.
- Run `npm run build:web`.
- Run `cargo check --manifest-path src-tauri/Cargo.toml`.
