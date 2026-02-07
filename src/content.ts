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
  chrome.storage.local.get(
    ["isEnabled", "targetLanguage", "debounceDelay"],
    (result: StorageResult) => {
      isExtensionEnabled = result.isEnabled !== false;
      targetLanguage = result.targetLanguage || "Thai";
      debounceDelay = result.debounceDelay || 350;
    },
  );

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
  .copilot-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: -20px;
    position: relative;
    z-index: 10;
  }
  .copilot-close {
    background: none;
    border: none;
    color: #8b949e;
    cursor: pointer;
    font-size: 18px;
    padding: 4px;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .copilot-close:hover {
    color: #fff;
    background: rgba(255,255,255,0.1);
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
  .copilot-content {
    margin-bottom: 8px;
    word-break: break-word;
    font-size: 17px;
    color: #f0f0f0;
    max-height: 300px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .copilot-content::-webkit-scrollbar {
    width: 4px;
  }
  .copilot-content::-webkit-scrollbar-track {
    background: transparent;
  }
  .copilot-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
  }
  .copilot-content::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
  }
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
  .copilot-content p { margin: 8px 0; }
  .copilot-content ul { margin: 8px 0; padding-left: 24px; }
  .copilot-content li { margin-bottom: 4px; }
  .copilot-content strong { color: #7ee787; font-weight: 600; }
`;
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
  div.style.boxShadow =
    "0 12px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)";
  div.style.fontSize = "15px";
  div.style.maxWidth = "500px";
  div.style.minWidth = "250px";
  div.style.opacity = "0";
  div.style.transition = "opacity 0.3s ease, transform 0.3s ease";
  div.style.transform = "translateY(10px) scale(0.95)";

  document.body.appendChild(div);
  tooltip = div;
  return div;
}

function positionTooltip(el: HTMLElement, x: number, y: number) {
  const spacing = 12;
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

  // 1. Horizontal Positioning (Centered)
  let left = x - rect.width / 2;
  // Constraint to screen edges
  if (left + rect.width > screenWidth + scrollX - spacing) {
    left = screenWidth + scrollX - rect.width - spacing;
  }
  if (left < scrollX + spacing) left = scrollX + spacing;

  // 2. Vertical Positioning (Stable)
  // Calculate space relative to viewport
  const clientY = y - scrollY;
  const spaceBelow = screenHeight - clientY - spacing;
  const spaceAbove = clientY - spacing;
  
  const PREFERRED_HEIGHT = 320; // Slightly more than max-height + padding

  let top;
  // Logic: Prefer below if it fits, or if it has more space than above
  // Only flip to top if strictly better and necessary
  const fitsBelow = spaceBelow >= Math.min(rect.height, PREFERRED_HEIGHT);
  const fitsAbove = spaceAbove >= Math.min(rect.height, PREFERRED_HEIGHT);

  if (fitsBelow) {
    top = y + spacing;
  } else if (fitsAbove) {
    top = y - rect.height - spacing;
  } else {
    // Neither fits perfectly, pick the side with more space
    if (spaceAbove > spaceBelow) {
      top = y - rect.height - spacing;
    } else {
      top = y + spacing;
    }
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
  html = html
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

  el.querySelector("#copilot-close-btn")?.addEventListener(
    "click",
    hideTooltip,
  );

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
      setTimeout(() => (btn.textContent = original), 2000);
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
      <span style="font-weight: 500;">${"Translating..."}</span>
    </div>
  `;
  positionTooltip(el, x, y);
  el.style.opacity = "1";
  el.style.transform = "translateY(0) scale(1)";

  try {
    const response = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language: targetLanguage,
        mode: "translate",
      }),
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
    if (
      event instanceof MouseEvent &&
      tooltip &&
      !tooltip.contains(event.target as Node)
    ) {
      hideTooltip();
    }
    return;
  }

  if (!isExtensionEnabled) return;

  // Calculate center of selection
  let x, y;
  const range = selection?.getRangeAt(0);
  const rect = range?.getBoundingClientRect();

  if (rect) {
    x = rect.left + rect.width / 2 + window.scrollX;
    y = rect.bottom + window.scrollY;
  } else if (event instanceof MouseEvent) {
    // Fallback to mouse position if range rect is missing (rare)
    x = event.pageX;
    y = event.pageY;
  } else {
    // Default fallback
    x = 0;
    y = 0;
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
