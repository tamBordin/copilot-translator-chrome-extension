# Copilot Translator Chrome Extension 🚀

**Copilot Translator** is a powerful Chrome Extension that leverages the **GitHub Copilot SDK** to provide intelligent, context-aware translations and code explanations directly within your browser.

Unlike traditional translators, this extension:
*   **Understands Code:** Detects code snippets automatically and provides technical explanations instead of literal translations.
*   **Tech-Savvy:** Translates English to Thai using industry-standard technical terms and transliterations favored by developers.
*   **Privacy-Focused:** Requires a local backend server to communicate with GitHub Copilot, keeping your tokens under your control.

## ✨ Key Features

*   **🔛 Easy Toggle:** Enable or disable the extension via a simple switch in the popup.
*   **🧠 Smart Code Detection:** Automatically switches between "Translate Mode" and "Code Explanation Mode" based on the selected content.
*   **⚡️ Caching:** Instant results for previously translated phrases.
*   **🛠 Action Buttons:**
    *   📋 **Copy:** One-click copy to clipboard.
    *   🔊 **Speak:** Text-to-speech for pronunciation.
*   **🎨 Modern UI:** Glassmorphism tooltip with loading animations.

## 🏗 Architecture

The project consists of two parts:

1.  **Frontend (Chrome Extension):**
    *   Built with **React + TypeScript + Vite**.
    *   Injects a Content Script to handle text selection and display the tooltip.
    *   Communicates with the local backend server.

2.  **Backend (Local Server):**
    *   Located in `server/`.
    *   Built with **Node.js + Express**.
    *   Uses **@github/copilot-sdk** to securely communicate with the GitHub Copilot CLI.

## 🛠 Setup & Installation

### 1. Prerequisites
*   [Node.js](https://nodejs.org/) installed.
*   [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated (`gh auth login`).
*   **GitHub Copilot Extension** for CLI installed:
    ```bash
    gh extension install github/gh-copilot
    ```

### 2. Backend Setup (Local Server)
You must run the local server for the extension to work.

1.  Navigate to the server directory:
    ```bash
    cd server
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file (copy from example):
    ```bash
    cp .env.example .env
    ```
4.  Open `.env` and paste your GitHub Personal Access Token (PAT) if needed (or rely on `gh` CLI auth):
    ```env
    GH_TOKEN=your_github_pat_here
    PORT=3000
    ```
5.  Start the server:
    ```bash
    npm run dev
    ```
    *(The server runs at `http://localhost:3000`)*

### 3. Frontend Setup (Extension)

1.  Return to the project root:
    ```bash
    cd ..
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the extension:
    ```bash
    npm run build && cp manifest.json dist/ && cp -r public/* dist/ 2>/dev/null || :
    ```

### 4. Install in Chrome

1.  Open Chrome and go to `chrome://extensions/`.
2.  Enable **Developer mode** (top right toggle).
3.  Click **Load unpacked**.
4.  Select the **`dist/`** folder from this project.

## 📖 How to Use

1.  **Activate:** Click the extension icon in the toolbar and toggle the switch to **Active** (🟢).
2.  **Select Text:** Highlight any text or code snippet on a webpage.
3.  **Wait:** A tooltip will appear with the AI translation or code explanation.
    *   *Note: If it's code, it will analyze the logic. If it's text, it will translate to Thai.*
4.  **Interact:** Use the **Copy** or **Speak** buttons inside the tooltip.
5.  **Disable:** To stop translating, toggle the switch to **Inactive** (⚪️).

## 🧰 Tech Stack
*   **Frontend:** React 19, TypeScript, Vite
*   **Backend:** Express.js, @github/copilot-sdk
*   **Tools:** ESLint, nodemon, dotenv

---
**Note:** This project is for educational and personal use, demonstrating how to integrate GitHub Copilot SDK into a browser environment.