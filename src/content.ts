let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let tooltip: HTMLDivElement | null = null;
const translationCache = new Map<string, string>();
let isExtensionEnabled = true;
let targetLanguage = "Thai";
let debounceDelay = 350;

const SERVER_URL = "http://localhost:5555/translate";

interface StorageResult {
  isEnabled?: boolean;
  targetLanguage?: string;
  debounceDelay?: number;
}

// Initialize state from storage
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.local.get(["isEnabled", "targetLanguage", "debounceDelay"], (result: StorageResult) => {
    isExtensionEnabled = result.isEnabled !== false;
    targetLanguage = result.targetLanguage || "Thai";
    debounceDelay = result.debounceDelay || 350;
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local") {
      if (changes.isEnabled) {
        isExtensionEnabled = changes.isEnabled.newValue as boolean;
        if (!isExtensionEnabled) hideTooltip();
      }
      if (changes.targetLanguage) {
        targetLanguage = changes.targetLanguage.newValue as string;
        translationCache.clear();
      }
      if (changes.debounceDelay) {
        debounceDelay = changes.debounceDelay.newValue as number;
      }
    }
  });
}

// Inject CSS
const style = document.createElement("style");
style.textContent = "\n  @keyframes copilot-fade-in {\n    from { opacity: 0; transform: translateY(5px); }\n    to { opacity: 1; transform: translateY(0); }\n  }\n  @keyframes copilot-spin {\n    to { transform: rotate(360deg); }\n  }\n  .copilot-tooltip {\n    font-family: 'Inter', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif;\n    line-height: 1.6;\n    letter-spacing: 0.01em;\n  }\n  .copilot-loading-spinner {\n    display: inline-block;\n    width: 16px;\n    height: 16px;\n    border: 2px solid rgba(255,255,255,0.3);\n    border-radius: 50%;\n    border-top-color: #fff;\n    animation: copilot-spin 1s ease-in-out infinite;\n    margin-right: 8px;\n    vertical-align: middle;\n  }\n  .copilot-header {\n    display: flex;\n    justify-content: flex-end;\n    margin-bottom: -20px;\n    position: relative;\n    z-index: 10;\n  }\n  .copilot-close {\n    background: none;\n    border: none;\n    color: #8b949e;\n    cursor: pointer;\n    font-size: 18px;\n    padding: 4px;\n    line-height: 1;\n    border-radius: 4px;\n    transition: all 0.2s;\n  }\n  .copilot-close:hover {\n    color: #fff;\n    background: rgba(255,255,255,0.1);\n  }\n  .copilot-actions {\n    margin-top: 12px;\n    padding-top: 10px;\n    border-top: 1px solid rgba(255,255,255,0.1);\n    display: flex;\n    gap: 8px;\n    justify-content: flex-end;\n  }\n  .copilot-btn {\n    background: rgba(255,255,255,0.05);\n    border: 1px solid rgba(255,255,255,0.1);\n    color: #e0e0e0;\n    cursor: pointer;\n    font-size: 13px;\n    font-weight: 500;\n    display: flex;\n    align-items: center;\n    gap: 6px;\n    padding: 6px 12px;\n    border-radius: 6px;\n    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);\n    font-family: inherit;\n  }\n  .copilot-btn:hover {\n    background: rgba(255,255,255,0.15);\n    color: #fff;\n    transform: translateY(-1px);\n    box-shadow: 0 2px 8px rgba(0,0,0,0.2);\n  }\n  .copilot-content {\n    margin-bottom: 8px;\n    word-break: break-word;\n    font-size: 15px;\n    color: #f0f0f0;\n  }\n  .copilot-content pre {\n    background: #111;\n    padding: 12px;\n    border-radius: 8px;\n    overflow-x: auto;\n    margin: 12px 0;\n    border: 1px solid #333;\n    font-size: 13px;\n  }\n  .copilot-content code {\n    font-family: 'JetBrains Mono', 'Fira Code', 'Menlo', monospace;\n    font-size: 85%;\n    background: rgba(255,255,255,0.15);\n    padding: 2px 6px;\n    border-radius: 4px;\n    color: #ff9d9d;\n  }\n  .copilot-content pre code {\n    background: transparent;\n    padding: 0;\n    color: #d4d4d4;\n    font-size: 100%;\n  }\n  .copilot-content p { margin: 8px 0; }\n  .copilot-content ul { margin: 8px 0; padding-left: 24px; }\n  .copilot-content li { margin-bottom: 4px; }\n  .copilot-content strong { color: #7ee787; font-weight: 600; }\n";
document.head.appendChild(style);

function hideTooltip() {
  if (tooltip) {
    tooltip.style.opacity = "0";
    tooltip.style.transform = "translateY(10px) scale(0.95)";
    setTimeout(() => {
      if (tooltip && tooltip.style.opacity === "0") {
        tooltip.remove();
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
  div.style.backgroundColor = "rgba(22, 27, 34, 0.95)";
  div.style.backdropFilter = "blur(16px) saturate(180%)";
  div.style.color = "#c9d1d9";
  div.style.padding = "16px";
  div.style.borderRadius = "12px";
  div.style.boxShadow = "0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)";
  div.style.fontSize = "15px";
  div.style.maxWidth = "450px";
  div.style.minWidth = "200px";
  div.style.opacity = "0";
  div.style.transition = "opacity 0.3s ease, transform 0.3s ease";
  div.style.transform = "translateY(10px) scale(0.95)";

  document.body.appendChild(div);
  tooltip = div;
  return div;
}

function positionTooltip(el: HTMLElement, x: number, y: number) {
  const spacing = 15;
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  // Temporarily set to measure
  el.style.visibility = "hidden";
  el.style.display = "block";
  const rect = el.getBoundingClientRect();
  el.style.display = "";
  el.style.visibility = "";

  let left = x;
  let top = y + spacing;

  // Horizontal overflow
  if (left + rect.width > screenWidth + scrollX - spacing) {
    left = screenWidth + scrollX - rect.width - spacing;
  }
  if (left < scrollX + spacing) left = scrollX + spacing;

  // Vertical overflow
  if (top + rect.height > screenHeight + scrollY - spacing) {
    top = y - rect.height - spacing; // Show above selection
  }

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
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
  html = html.split(/\n\n/).map(p => {
    if (p.trim().startsWith("<pre") || p.trim().startsWith("<ul")) return p;
    return `<p>${p}</p>`;
  }).join("");
  return html;
}

function showTranslation(text: string, x: number, y: number) {
  const el = createTooltip();
  const formattedHtml = parseMarkdown(text);

  el.innerHTML = `
    <div class="copilot-header">
      <button class="copilot-close" id="copilot-close-btn">×</button>
    </div>
    <div class="copilot-content">
      ${formattedHtml}
    </div>
    <div class="copilot-actions">
      <button class="copilot-btn" id="copilot-btn-speak">🔊 Speak</button>
      <button class="copilot-btn" id="copilot-btn-copy">📋 Copy</button>
    </div>
  `;

  el.querySelector("#copilot-close-btn")?.addEventListener("click", hideTooltip);

  el.querySelector("#copilot-btn-speak")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const utterance = new SpeechSynthesisUtterance(text);
    // Try to detect if it's Thai or English
    utterance.lang = /[฀-๿]/.test(text) ? "th-TH" : "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });

  el.querySelector("#copilot-btn-copy")?.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      const btn = e.currentTarget as HTMLButtonElement;
      const original = btn.textContent;
      btn.textContent = "✅ Copied!";
      setTimeout(() => btn.textContent = original, 2000);
    });
  });

  positionTooltip(el, x, y);
  el.style.opacity = "1";
  el.style.transform = "translateY(0) scale(1)";
}

function isLikeCode(text: string): boolean {
  const codeIndicators = [
    /[{};]/,
    /\b(function|const|let|var|class|import|export|return|if|else|for|while|=>)\b/,
    /\b(public|private|protected|void|int|string|float)\b/,
    /\b(def|class|print|import|from)\b/,
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
  const cacheKey = `${targetLanguage}:${isCode ? "CODE:" : "TEXT:"}${text}`;

  if (translationCache.has(cacheKey)) {
    showTranslation(translationCache.get(cacheKey)!, x, y);
    return;
  }

  const el = createTooltip();
  el.innerHTML = `
    <div style="display: flex; align-items: center; color: #8b949e; padding: 4px 0;">
      <span class="copilot-loading-spinner"></span>
      <span style="font-weight: 500;">${isCode ? "Analyzing Code..." : "Translating..."}</span>
    </div>
  `;
  positionTooltip(el, x, y);
  el.style.opacity = "1";
  el.style.transform = "translateY(0) scale(1)";

  try {
    const response = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: targetLanguage, mode: isCode ? "code" : "translate" }),
    });

    if (!response.ok) throw new Error("Server error");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No reader");

    const decoder = new TextDecoder();
    let accumulated = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      showTranslation(accumulated, x, y);
    }
    translationCache.set(cacheKey, accumulated);
  } catch (error) {
    showTranslation("⚠️ Error: " + error, x, y);
  }
}

function handleSelection(event: MouseEvent | KeyboardEvent) {
  if (debounceTimer) clearTimeout(debounceTimer);

  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  if (!selectedText || selectedText.length < 2) {
    if (event instanceof MouseEvent && tooltip && !tooltip.contains(event.target as Node)) {
      hideTooltip();
    }
    return;
  }

  if (!isExtensionEnabled) return;

  let x, y;
  if (event instanceof MouseEvent) {
    x = event.pageX;
    y = event.pageY;
  } else {
    // Keyboard event, position near selection
    const range = selection?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();
    x = (rect?.left || 0) + window.scrollX;
    y = (rect?.bottom || 0) + window.scrollY;
  }

  debounceTimer = setTimeout(() => {
    translateAndShow(selectedText, x, y);
  }, debounceDelay);
}

document.addEventListener("mouseup", (e) => {
  // If clicking inside tooltip, don't hide or re-trigger
  if (tooltip && tooltip.contains(e.target as Node)) return;
  handleSelection(e);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideTooltip();
  if (e.altKey && e.key.toLowerCase() === "t") {
    handleSelection(e);
  }
});
