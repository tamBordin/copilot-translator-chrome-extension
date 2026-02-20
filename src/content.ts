let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let tooltip: HTMLDivElement | null = null;
const translationCache = new Map<string, string>();
let isExtensionEnabled = true;
let targetLanguage = "Thai";
let debounceDelay = 350;
let isAltDown = false;

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
  @keyframes copilot-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  .copilot-tooltip {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
    letter-spacing: 0.01em;
    transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
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
    margin-bottom: -15px;
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
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  .copilot-actions.visible {
    opacity: 1;
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
    transition: all 0.2s;
    font-family: inherit;
  }
  .copilot-btn:hover {
    background: rgba(255,255,255,0.15);
    color: #fff;
  }
  .copilot-content {
    word-break: break-word;
    font-size: 16px;
    color: #f0f0f0;
    max-height: 350px;
    overflow-y: auto;
    padding-right: 4px;
    min-height: 20px;
  }
  .copilot-streaming-cursor {
    display: inline-block;
    width: 8px;
    height: 16px;
    background: #7ee787;
    margin-left: 4px;
    vertical-align: middle;
    animation: copilot-blink 0.8s infinite;
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
    font-family: 'JetBrains Mono', monospace;
    font-size: 85%;
    background: rgba(255,255,255,0.1);
    padding: 2px 4px;
    border-radius: 4px;
  }
  .copilot-content p { margin: 8px 0; }
  .copilot-content strong { color: #7ee787; }
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
  div.style.backgroundColor = "rgba(22, 27, 34, 0.98)";
  div.style.backdropFilter = "blur(20px) saturate(180%)";
  div.style.color = "#c9d1d9";
  div.style.padding = "16px";
  div.style.borderRadius = "12px";
  div.style.boxShadow = "0 20px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)";
  div.style.fontSize = "15px";
  div.style.maxWidth = "450px";
  div.style.minWidth = "200px";
  div.style.opacity = "0";
  div.style.transform = "translateY(10px) scale(0.95)";

  div.innerHTML = `
    <div class="copilot-header">
      <button class="copilot-close" id="copilot-close-btn">×</button>
    </div>
    <div class="copilot-content" id="copilot-content-root"></div>
    <div class="copilot-actions" id="copilot-actions-root">
      <button class="copilot-btn" id="copilot-btn-speak">🔊 Speak</button>
      <button class="copilot-btn" id="copilot-btn-copy">📋 Copy</button>
    </div>
  `;

  div.querySelector("#copilot-close-btn")?.addEventListener("click", hideTooltip);
  
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

  const rect = el.getBoundingClientRect();

  let left = x - rect.width / 2;
  if (left + rect.width > screenWidth + scrollX - 20) left = screenWidth + scrollX - rect.width - 20;
  if (left < scrollX + 20) left = scrollX + 20;

  const clientY = y - scrollY;
  const spaceBelow = screenHeight - clientY - 40;
  const spaceAbove = clientY - 40;
  
  let top;
  if (spaceBelow >= 300 || spaceBelow > spaceAbove) {
    top = y + spacing;
  } else {
    top = y - rect.height - spacing;
  }

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function updateTooltipContent(html: string, isStreaming: boolean = false) {
  if (!tooltip) return;
  const contentRoot = tooltip.querySelector("#copilot-content-root");
  if (contentRoot) {
    let finalHtml = html;
    if (isStreaming) {
      const cursor = '<span class="copilot-streaming-cursor"></span>';
      // Try to inject cursor before the very last closing tag to keep it inline
      // We look for the last </ to insert before it.
      // This works for </p>, </code></pre>, </ul>, etc.
      const lastCloseTagIndex = finalHtml.lastIndexOf("</");
      if (lastCloseTagIndex !== -1) {
        finalHtml = finalHtml.substring(0, lastCloseTagIndex) + cursor + finalHtml.substring(lastCloseTagIndex);
      } else {
        // Fallback if no closing tag found (plain text)
        finalHtml += cursor;
      }
    }
    contentRoot.innerHTML = finalHtml;
    
    // Auto-scroll to bottom while streaming
    if (isStreaming) {
      contentRoot.scrollTop = contentRoot.scrollHeight;
    }
  }

  if (!isStreaming) {
    tooltip.querySelector("#copilot-actions-root")?.classList.add("visible");
  }
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

async function translateAndShow(text: string, x: number, y: number) {
  const cacheKey = `${targetLanguage}:"TEXT"${text}`;

  if (translationCache.has(cacheKey)) {
    const cached = translationCache.get(cacheKey)!;
    const el = createTooltip();
    positionTooltip(el, x, y);
    el.style.opacity = "1";
    el.style.transform = "translateY(0) scale(1)";
    updateTooltipContent(parseMarkdown(cached), false);
    
    // Actions listeners
    el.querySelector("#copilot-btn-speak")?.replaceWith(el.querySelector("#copilot-btn-speak")!.cloneNode(true));
    el.querySelector("#copilot-btn-copy")?.replaceWith(el.querySelector("#copilot-btn-copy")!.cloneNode(true));
    
    el.querySelector("#copilot-btn-speak")?.addEventListener("click", () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cached);
      utterance.lang = /[฀-๿]/.test(cached) ? "th-TH" : "en-US";
      window.speechSynthesis.speak(utterance);
    });

    el.querySelector("#copilot-btn-copy")?.addEventListener("click", (e) => {
      navigator.clipboard.writeText(cached).then(() => {
        const btn = e.currentTarget as HTMLButtonElement;
        const original = btn.textContent;
        btn.textContent = "✅ Copied!";
        setTimeout(() => (btn.textContent = original), 2000);
      });
    });
    return;
  }

  const el = createTooltip();
  updateTooltipContent(`
    <div style="display: flex; align-items: center; color: #8b949e; padding: 10px 0;">
      <span class="copilot-loading-spinner"></span>
      <span style="font-weight: 500;">Translating...</span>
    </div>
  `, true);
  
  positionTooltip(el, x, y);
  el.style.opacity = "1";
  el.style.transform = "translateY(0) scale(1)";

  try {
    const response = await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: targetLanguage, mode: "translate" }),
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
      updateTooltipContent(parseMarkdown(accumulated), true);
      positionTooltip(el, x, y); // Dynamic resize support
    }

    translationCache.set(cacheKey, accumulated);
    updateTooltipContent(parseMarkdown(accumulated), false);

    // Setup actions
    el.querySelector("#copilot-btn-speak")?.addEventListener("click", () => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(accumulated);
      utterance.lang = /[฀-๿]/.test(accumulated) ? "th-TH" : "en-US";
      window.speechSynthesis.speak(utterance);
    });

    el.querySelector("#copilot-btn-copy")?.addEventListener("click", (e) => {
      navigator.clipboard.writeText(accumulated).then(() => {
        const btn = e.currentTarget as HTMLButtonElement;
        const original = btn.textContent;
        btn.textContent = "✅ Copied!";
        setTimeout(() => (btn.textContent = original), 2000);
      });
    });

  } catch (error) {
    updateTooltipContent(`<div style="color: #ff7b72;">⚠️ Error: ${error}</div>`, false);
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
  // ถ้า Alt ค้างอยู่ และมี selection ให้แปล
  if (isAltDown) {
    handleSelection(e);
    return;
  }

  // คลิกข้างนอก tooltip ให้ซ่อน
  if (tooltip && !tooltip.contains(e.target as Node)) {
    hideTooltip();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideTooltip();

  if (e.key === "Alt") {
    isAltDown = true;
  }

  if (e.altKey && e.key.toLowerCase() === "t") {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();

    if (selectedText && selectedText.length >= 2) {
      e.preventDefault();
      e.stopPropagation();
      handleSelection(e);
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "Alt") {
    isAltDown = false;
  }
});
