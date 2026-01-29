let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let tooltip: HTMLDivElement | null = null;
const translationCache = new Map<string, string>();
let isExtensionEnabled = true; // Default state

// Configuration
const DEBOUNCE_DELAY = 350; // ms
const SERVER_URL = "http://localhost:5555/translate";
const TARGET_LANGUAGE = "Thai";

// Forward declarations to fix scoping if needed, 
// but in JS/TS hoisting usually works for functions.
// The issue likely was the replace block removing them or putting them inside another block.

// Initialize state from storage
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.local.get(["isEnabled"], (result) => {
    isExtensionEnabled = result.isEnabled !== false; // Default to true if undefined
  });

  // Listen for storage changes (real-time toggle)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.isEnabled) {
      isExtensionEnabled = changes.isEnabled.newValue as boolean;
      if (!isExtensionEnabled) {
        hideTooltip(); // Hide tooltip immediately if turned off
      }
    }
  });
}

// Inject CSS
const style = document.createElement("style");
style.textContent = `
  @keyframes copilot-fade-in {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes copilot-spin {
    to { transform: rotate(360deg); }
  }
  .copilot-tooltip {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
    letter-spacing: 0.01em;
  }
  .copilot-loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-radius: 50%;
    border-top-color: #fff;
    animation: copilot-spin 1s ease-in-out infinite;
    margin-right: 8px;
    vertical-align: middle;
  }
  .copilot-actions {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .copilot-btn {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    color: #e0e0e0;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: inherit;
  }
  .copilot-btn:hover {
    background: rgba(255,255,255,0.15);
    color: #fff;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .copilot-btn:active {
    transform: translateY(0);
  }
  .copilot-content {
    margin-bottom: 8px;
    word-break: break-word;
    font-size: 15px;
    color: #f0f0f0;
  }
  /* Markdown Styles */
  .copilot-content pre {
    background: #111;
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
    border: 1px solid #333;
    font-size: 13px;
  }
  .copilot-content code {
    font-family: 'JetBrains Mono', 'Fira Code', 'Menlo', monospace;
    font-size: 85%;
    background: rgba(255,255,255,0.15);
    padding: 2px 6px;
    border-radius: 4px;
    color: #ff9d9d;
  }
  .copilot-content pre code {
    background: transparent;
    padding: 0;
    color: #d4d4d4;
    font-size: 100%;
  }
  .copilot-content p {
    margin: 8px 0;
  }
  .copilot-content ul {
    margin: 8px 0;
    padding-left: 24px;
  }
  .copilot-content li {
    margin-bottom: 4px;
  }
  .copilot-content strong {
    color: #7ee787; /* GitHub Green */
    font-weight: 600;
  }
`;
document.head.appendChild(style);

function hideTooltip() {
  if (tooltip) {
    tooltip.style.opacity = "0";
    tooltip.style.transform = "translateY(10px) scale(0.95)";
    setTimeout(() => {
      if (tooltip && tooltip.style.opacity === "0") {
        tooltip.remove(); // Remove from DOM to clean up
        tooltip = null;
      }
    }, 200);
    window.speechSynthesis.cancel();
  }
}

function createTooltip() {
  if (tooltip) return tooltip;

  const div = document.createElement("div");
  div.className = "copilot-tooltip";
  div.style.position = "absolute";
  div.style.zIndex = "2147483647";
  div.style.backgroundColor = "rgba(22, 27, 34, 0.90)"; /* GitHub Dark Dimmed */
  div.style.backdropFilter = "blur(12px) saturate(180%)";
  div.style.color = "#c9d1d9";
  div.style.padding = "16px";
  div.style.borderRadius = "12px";
  div.style.boxShadow =
    "0 12px 24px -6px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)";
  div.style.fontSize = "15px";
  div.style.maxWidth = "500px";
  div.style.minWidth = "200px";
  div.style.opacity = "0";
  div.style.transition = "opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
  div.style.transform = "translateY(10px) scale(0.95)";
  div.style.pointerEvents = "auto";

  document.body.appendChild(div);
  tooltip = div;
  return div;
}

function positionTooltip(el: HTMLElement, x: number, y: number) {
  const spacing = 12;
  const top = y + spacing;
  let left = x;
  const screenWidth = window.innerWidth;
  // Estimate width roughly or measure if already in DOM (but hidden)
  const estimatedWidth = 500;

  if (left + estimatedWidth > screenWidth + window.scrollX) {
    left = screenWidth + window.scrollX - estimatedWidth - spacing;
    if (left < spacing) left = spacing;
  }

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function showLoading(x: number, y: number, isCode: boolean) {
  const el = createTooltip();
  const actionText = isCode ? "Analyzing Code..." : "Translating...";
  el.innerHTML = `
    <div style="display: flex; align-items: center; color: #8b949e;">
        <span class="copilot-loading-spinner"></span>
        <span style="font-weight: 500;">${actionText}</span>
    </div>
  `;
  positionTooltip(el, x, y);
  el.style.opacity = "1";
  el.style.transform = "translateY(0) scale(1)";
}

function parseMarkdown(text: string): string {
  if (!text) return "";
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/^\s*-\s+(.*)/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");
  html =
    html
      .split(/\n\n/)
      .map((p) => {
        if (p.trim().startsWith("<pre") || p.trim().startsWith("<ul")) return p;
        return `<p>${p}</p>`;
      })
      .join("");
  return html;
}

function showTranslation(text: string, x: number, y: number) {
  const el = createTooltip();
  const formattedHtml = parseMarkdown(text);

  let contentDiv = el.querySelector(".copilot-content");

  if (!contentDiv) {
    el.innerHTML = `
      <div class="copilot-content">${formattedHtml}</div>
      <div class="copilot-actions">
        <button class="copilot-btn" id="copilot-btn-speak" title="Listen">
          🔊 Speak
        </button>
        <button class="copilot-btn" id="copilot-btn-copy" title="Copy to clipboard">
          📋 Copy
        </button>
      </div>
    `;
    contentDiv = el.querySelector(".copilot-content");
  } else {
    contentDiv.innerHTML = formattedHtml;
  }

  const speakBtn = el.querySelector("#copilot-btn-speak");
  const copyBtn = el.querySelector("#copilot-btn-copy");

  if (speakBtn) {
    const newSpeakBtn = speakBtn.cloneNode(true);
    speakBtn.parentNode?.replaceChild(newSpeakBtn, speakBtn);
    newSpeakBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "th-TH";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  if (copyBtn) {
    const newCopyBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode?.replaceChild(newCopyBtn, copyBtn);
    newCopyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text).then(() => {
        const originalText = newCopyBtn.textContent;
        newCopyBtn.textContent = "✅ Copied!";
        setTimeout(() => {
          newCopyBtn.textContent = originalText;
        }, 2000);
      });
    });
  }

  positionTooltip(el, x, y);
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
}

function isLikeCode(text: string): boolean {
  const codeIndicators = [
    /[{};]/,
    /\b(function|const|let|var|class|import|export|return|if|else|for|while|=>)\b/,
    /\b(public|private|protected|void|int|string|float)\b/,
    /\b(def|class|print|import|from)\b/,
    /<!--?[a-z][\s\S]*?-->/i,
  ];

  let score = 0;
  if (text.includes("\n") && /^\s+/.test(text)) score += 1;
  for (const pattern of codeIndicators) {
    if (pattern.test(text)) score += 1;
  }
  return score >= 1;
}

async function translateAndShow(text: string, x: number, y: number) {
  const isCode = isLikeCode(text);
  const cacheKey = `${isCode ? "CODE:" : "TEXT:"}${text}`;

  if (translationCache.has(cacheKey)) {
    showTranslation(translationCache.get(cacheKey)!, x, y);
    return;
  }

  showLoading(x, y, isCode);

  try {
    const response = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language: TARGET_LANGUAGE,
        mode: isCode ? "code" : "translate",
      }),
    });

    if (!response.ok) throw new Error("Network error");
    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      accumulatedText += chunk;

      showTranslation(accumulatedText, x, y);
    }

    translationCache.set(cacheKey, accumulatedText);

  } catch (error) {
    console.error("Translation failed:", error);
    showTranslation("⚠️ Server error: " + error, x, y);
  }
}

function handleSelection(event: MouseEvent) {
  if (debounceTimer) clearTimeout(debounceTimer);

  if (tooltip && tooltip.contains(event.target as Node)) return;

  hideTooltip();

  if (!isExtensionEnabled) return;

  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  if (!selectedText) return;

  const x = event.pageX;
  const y = event.pageY;

  debounceTimer = setTimeout(() => {
    translateAndShow(selectedText, x, y);
  }, DEBOUNCE_DELAY);
}

document.addEventListener("mouseup", handleSelection);
document.addEventListener("keyup", (e) => {
  if (e.key === "Escape") hideTooltip();
});