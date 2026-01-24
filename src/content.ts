// Copilot Translator Content Script

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let tooltip: HTMLDivElement | null = null;
const translationCache = new Map<string, string>();
let isExtensionEnabled = true; // Default state

// Define types for better type safety
interface StorageResult {
  isEnabled?: boolean;
}

interface StorageChange {
  newValue: boolean;
  oldValue?: boolean;
}

// Initialize state from storage
if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.local.get(["isEnabled"], (result: Record<string, unknown>) => {
    const typedResult = result as StorageResult;
    isExtensionEnabled = typedResult.isEnabled !== false; // Default to true if undefined
  });

  // Listen for storage changes (real-time toggle)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.isEnabled) {
      const isEnabledChange = changes.isEnabled as StorageChange;
      isExtensionEnabled = isEnabledChange.newValue;
      if (!isExtensionEnabled) {
        hideTooltip(); // Hide tooltip immediately if turned off
      }
    }
  });
}

// Inject CSS for animations and buttons
const style = document.createElement("style");
style.textContent = `
  @keyframes copilot-dots {
    0%, 20% { content: '.'; }
    40% { content: '..'; }
    60% { content: '...'; }
    80%, 100% { content: ''; }
  }
  .copilot-loading::after {
    content: '.';
    animation: copilot-dots 1.5s infinite;
  }
  .copilot-actions {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .copilot-btn {
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
    font-family: inherit;
  }
  .copilot-btn:hover {
    background: rgba(255,255,255,0.1);
    color: #fff;
  }
  .copilot-content {
    margin-bottom: 4px;
    word-break: break-word;
  }
`;
document.head.appendChild(style);

// Configuration
const DEBOUNCE_DELAY = 750; // ms
const SERVER_URL = "http://localhost:3000/translate";
const TARGET_LANGUAGE = "Thai";

// Create Tooltip Element
function createTooltip() {
  if (tooltip) return tooltip;

  const div = document.createElement("div");
  div.className = "copilot-tooltip";
  div.style.position = "absolute";
  div.style.zIndex = "2147483647"; // Max z-index
  div.style.backgroundColor = "rgba(30, 30, 30, 0.95)";
  div.style.backdropFilter = "blur(4px)";
  div.style.color = "#fff";
  div.style.padding = "10px 14px";
  div.style.borderRadius = "8px";
  div.style.boxShadow =
    "0 8px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)";
  div.style.fontSize = "16px";
  div.style.fontFamily =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  div.style.maxWidth = "400px";
  div.style.lineHeight = "1.5";
  div.style.opacity = "0";
  div.style.transition = "opacity 0.2s, transform 0.2s";
  div.style.transform = "translateY(5px)";
  div.style.pointerEvents = "auto";

  document.body.appendChild(div);
  tooltip = div;
  return div;
}

function showLoading(x: number, y: number, isCode: boolean) {
  const el = createTooltip();
  const actionText = isCode ? "Analyzing Code" : "Thinking";
  el.innerHTML = `<span style="color: #646cff; font-weight: bold;">AI</span> <span class="copilot-loading">${actionText}</span>`;
  positionTooltip(el, x, y);
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
}

function positionTooltip(el: HTMLElement, x: number, y: number) {
  const top = y + 20;
  let left = x;
  const screenWidth = window.innerWidth;
  const estimatedWidth = 400;

  if (left + estimatedWidth > screenWidth + window.scrollX) {
    left = screenWidth + window.scrollX - estimatedWidth - 20;
    if (left < 0) left = 10;
  }

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function showTranslation(text: string, x: number, y: number) {
  const el = createTooltip();

  el.innerHTML = `
    <div class="copilot-content">${text}</div>
    <div class="copilot-actions">
      <button class="copilot-btn" id="copilot-btn-speak" title="Listen">
        🔊 Speak
      </button>
      <button class="copilot-btn" id="copilot-btn-copy" title="Copy to clipboard">
        📋 Copy
      </button>
    </div>
  `;

  // Attach Event Listeners
  const speakBtn = el.querySelector("#copilot-btn-speak");
  const copyBtn = el.querySelector("#copilot-btn-copy");

  if (speakBtn) {
    speakBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const contentToSpeak =
        el.querySelector(".copilot-content")?.textContent || text;
      const utterance = new SpeechSynthesisUtterance(contentToSpeak);
      utterance.lang = "th-TH";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const contentToCopy =
        el.querySelector(".copilot-content")?.textContent || text;
      navigator.clipboard.writeText(contentToCopy).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = "✅ Copied!";
        setTimeout(() => {
          if (copyBtn) copyBtn.innerHTML = originalText;
        }, 2000);
      });
    });
  }

  positionTooltip(el, x, y);
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
}

function hideTooltip() {
  if (tooltip) {
    tooltip.style.opacity = "0";
    tooltip.style.transform = "translateY(5px)";
    window.speechSynthesis.cancel();
  }
}

// Simple heuristic to detect if text looks like code
function isLikeCode(text: string): boolean {
  const codeIndicators = [
    /[{};]/,
    /\b(function|const|let|var|class|import|export|return|if|else|for|while|=>)\b/,
    /\b(public|private|protected|void|int|string|float)\b/,
    /\b(def|class|print|import|from)\b/,
    /<!--?[a-z][\s\S]*?>/i, // HTML tags (Fixed: removed extra leading quote)
  ];

  let score = 0;
  if (text.includes("\n") && /^\s+/.test(text)) score += 1;

  for (const pattern of codeIndicators) {
    if (pattern.test(text)) score += 1;
  }

  return score >= 1;
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

    const data = await response.json();
    translationCache.set(cacheKey, data.translation);
    showTranslation(data.translation, x, y);
  } catch (error) {
    console.error("Translation failed:", error);
    showTranslation("⚠️ Server error.", x, y);
  }
}

document.addEventListener("mouseup", handleSelection);
document.addEventListener("keyup", (e) => {
  if (e.key === "Escape") hideTooltip();
});
