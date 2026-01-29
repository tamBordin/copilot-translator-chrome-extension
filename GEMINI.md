# Copilot Translator Chrome Extension

## Project Overview

**Copilot Translator** is a powerful Chrome Extension that leverages the **GitHub Copilot SDK** to provide intelligent, context-aware translations and code explanations directly within the browser.

Unlike traditional translators, this extension:
1.  **Understands Code:** It detects code snippets automatically and provides technical explanations instead of literal translations.
2.  **Tech-Savvy:** It translates English to Thai using industry-standard technical terms and transliterations favored by Thai developers.
3.  **Privacy-Focused:** Requires a local backend server to communicate with GitHub Copilot, ensuring your tokens remain under your control.

### Key Features
*   **Smart Trigger:** Simply **Select/Highlight** text to trigger the translator (with a short delay).
*   **Smart Code Detection:** Automatically switches between "Translate Mode" and "Code Explanation Mode" based on the selected content.
*   **Caching:** Instant results for previously translated phrases.
*   **Action Buttons:**
    *   📋 **Copy:** One-click copy to clipboard.
    *   🔊 **Speak:** Text-to-speech for pronunciation.
*   **Modern UI:** Glassmorphism tooltip with loading animations.

## Architecture

The project consists of two parts:

1.  **Frontend (Chrome Extension):**
    *   Built with **React 19 + TypeScript + Vite**.
    *   Uses **Content Scripts** (`src/content.ts`) to inject the UI into webpages.
    *   Handles user interactions (selection, shortcuts, buttons).

2.  **Backend (Local Server):**
    *   Located in `server/`.
    *   Built with **Node.js + Express**.
    *   Uses **@github/copilot-sdk** to communicate with the GitHub Copilot CLI.
    *   Requires a valid `GH_TOKEN` to function.

## Setup & Usage

### 1. Prerequisites
*   Node.js installed.
*   GitHub CLI (`gh`) installed and authenticated.
*   GitHub Copilot Extension for CLI installed: `gh extension install github/gh-copilot`.

### 2. Start the Backend Server
You must run the local server for the extension to work.

```bash
cd server
npm install
# Create a .env file and set your GH_TOKEN, or set it via environment variable
node index.js
# Or for auto-reload during development:
npm run dev
```

### 3. Build the Extension
```bash
npm run build && cp manifest.json dist/
```
*Note: Vite handles copying files from the `public/` directory automatically.*

### 4. Install in Chrome
1.  Open `chrome://extensions/`.
2.  Enable **Developer mode**.
3.  Click **Load unpacked**.
4.  Select the `dist/` folder from this project.

### 5. How to Use
1.  Open any webpage.
2.  Click the extension icon and ensure the **Status is Active** (🟢).
3.  **Select/Highlight** any text or code you want to understand.
4.  A tooltip will appear with the result after a brief pause.
5.  To temporarily stop the extension, click the icon and toggle the switch to **Inactive** (⚪️).

## Development

*   **Frontend:** Edit files in `src/`. The main logic is in `src/content.ts`.
*   **Backend:** Edit `server/index.js` to change the system prompt or SDK logic.
*   **Styles:** CSS is injected via JS in `src/content.ts` (using `document.createElement('style')`).

## Technology Stack
*   **Frontend:** React 19, TypeScript, Vite
*   **Backend:** Express.js, @github/copilot-sdk
*   **Tools:** ESLint, nodemon
