// Copilot Translator Content Script

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let tooltip: HTMLDivElement | null = null;
const translationCache = new Map<string, string>();
let isExtensionEnabled = true; // Default state

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

// Inject CSS for animations, buttons, and markdown content
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
    font-size: 14px;
  }
  /* Markdown Styles */
  .copilot-content pre {
    background: #1e1e1e;
    padding: 10px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
    border: 1px solid #333;
  }
  .copilot-content code {
    font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    background: rgba(255,255,255,0.1);
    padding: 2px 4px;
    border-radius: 4px;
  }
  .copilot-content pre code {
    background: transparent;
    padding: 0;
    color: #d4d4d4;
  }
  .copilot-content p {
    margin: 8px 0;
  }
  .copilot-content ul {
    margin: 8px 0;
    padding-left: 20px;
  }
  .copilot-content strong {
    color: #4ec9b0; /* VS Code Cyan-ish for emphasis */
    font-weight: 600;
  }
`;
document.head.appendChild(style);

// Configuration
const DEBOUNCE_DELAY = 750; // ms
const SERVER_URL = "http://localhost:5555/translate";
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
  div.style.maxWidth = "600px";
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
  const estimatedWidth = 600;

  if (left + estimatedWidth > screenWidth + window.scrollX) {
    left = screenWidth + window.scrollX - estimatedWidth - 20;
    if (left < 0) left = 10;
  }

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

// Simple Markdown Parser (No External Libs)
function parseMarkdown(text: string): string {
  if (!text) return "";

  // 1. Escape HTML first (Security)
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Code Blocks (``` ... ```)
  html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // 3. Inline Code (` ... `)
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 4. Bold (** ... **)
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // 5. Italic (* ... *)
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // 6. Lists (- item)
  html = html.replace(/^\s*-\s+(.*)/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>"); // Wrap lists (simplified)

  // 7. Line breaks to paragraphs (double newline)
  // Split by double newline, wrap non-empty in <p>
  html = html
    .split(/\n\n/)
    .map((p) => {
      // If it's already a pre/ul block, don't wrap in p
      if (p.trim().startsWith("<pre") || p.trim().startsWith("<ul")) return p;
      return `<p>${p.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");

  return html;
}

function showTranslation(text: string, x: number, y: number) {
  const el = createTooltip();

  // Parse Markdown to HTML
  const formattedHtml = parseMarkdown(text);

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

  // Attach Event Listeners
  const speakBtn = el.querySelector("#copilot-btn-speak");
  const copyBtn = el.querySelector("#copilot-btn-copy");

  if (speakBtn) {
    speakBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Speak raw text, not HTML
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "th-TH";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text).then(() => {
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
    /<!--?[a-z][\s\S]*?-->/i, // HTML tags
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
