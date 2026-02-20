# Copilot Instructions for this repository

## Big picture architecture

- This repo is a **Chrome Extension + local backend** system; both parts must be considered for feature work.
- Frontend extension (React popup + content script) lives in root `src/`; backend API server lives in `server/`.
- Primary flow: user selects text on a webpage → `src/content.ts` sends POST to `http://localhost:5555/translate` → `server/index.js` streams Copilot response back → tooltip renders streaming Markdown.
- The extension popup (`src/App.tsx`) only controls settings (`chrome.storage.local`); translation logic is in `src/content.ts`.

## Critical integration points

- `manifest.json` expects content script at **`content.js`** (not hashed).
- `vite.config.ts` has custom multi-entry output to force `src/content.ts` → `dist/content.js`; preserve this when changing build config.
- `src/content.ts` hardcodes `SERVER_URL = "http://localhost:5555/translate"`; backend `PORT` defaults to `5555` in `server/index.js`.
- Backend uses `@github/copilot-sdk` with a reused `globalSession`; on “session not found” it recreates the session and retries once.

## Developer workflows

- Install dependencies in **both** roots:
  - root: `npm install`
  - `server/`: `npm install`
- Run backend first (`server/`): `npm run dev` (or `npm start`).
- Build extension from root: `npm run build`, then ensure `manifest.json` is in `dist/` before loading unpacked extension.
- Lint from root: `npm run lint`.
- There is currently no automated test suite; validate via manual end-to-end check in Chrome (`chrome://extensions` + text selection on a page).

## Environment and auth assumptions

- Backend expects `server/.env` with at least:
  - `GH_TOKEN` (or authenticated `gh` CLI context)
  - `PORT` (default 5555)
- Chrome host permission only allows backend calls to `http://localhost:5555/*`; update both `manifest.json` and backend/client config if port/host changes.

## Project-specific coding patterns

- Keep content-script UI self-contained in `src/content.ts`: CSS is injected dynamically via `<style>` and tooltip DOM is created imperatively.
- Preserve storage key contract used by popup and content script:
  - `isEnabled`, `targetLanguage`, `debounceDelay`
- `translationCache` key format in content script is `${targetLanguage}:"TEXT"${text}`; keep consistent if modifying cache behavior.
- Tooltip rendering uses a lightweight custom Markdown parser (`parseMarkdown`) and streaming cursor UX; avoid introducing heavy parser deps unless needed.

## Change guidance for agents

- For selection/tooltip behavior, edit `src/content.ts` first; for settings UI, edit `src/App.tsx`.
- For model/session/prompt behavior, edit `server/index.js`.
- For build/manifest issues, inspect `manifest.json` + `vite.config.ts` together.
- When changing translation endpoint or CORS/permissions, update all three: `src/content.ts`, `server/index.js`, and `manifest.json`.
