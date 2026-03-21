# Bundle executable discovery

Resolve the packaged `ai-drawio` binary as an absolute path before running any draw.io CLI command.

## Default macOS location

Prefer the packaged executable under the standard app bundle location:

```bash
/Applications/AI Drawio.app/Contents/MacOS/ai-drawio
```

## Discovery fallback

If the app is not installed under `/Applications`, discover the bundle first and then derive the executable path from the bundle location.

```bash
mdfind "kMDItemCFBundleIdentifier == 'com.example.ai-drawio'"
```

- Use the first matching `.app` bundle that actually contains `Contents/MacOS/ai-drawio`.
- After discovery, store the executable path and reuse it consistently for the rest of the task.
- Do not fall back to PATH lookup.
- Do not use `type`, `which`, `command -v`, or shell aliases to locate `ai-drawio`.
