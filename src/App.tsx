/// <reference types="chrome" />
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [targetLanguage, setTargetLanguage] = useState("Thai");
  const [debounceDelay, setDebounceDelay] = useState(350);

  useEffect(() => {
    // Load state from storage on mount
    chrome.storage.local.get(
      ["isEnabled", "targetLanguage", "debounceDelay"],
      (result: { isEnabled?: boolean; targetLanguage?: string; debounceDelay?: number }) => {
        setIsEnabled(result.isEnabled !== false);
        setTargetLanguage(result.targetLanguage || "Thai");
        setDebounceDelay(result.debounceDelay || 350);
      },
    );
  }, []);

  const toggleSwitch = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    chrome.storage.local.set({ isEnabled: newState });
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setTargetLanguage(newLang);
    chrome.storage.local.set({ targetLanguage: newLang });
  };

  const handleDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDelay = parseInt(e.target.value, 10);
    setDebounceDelay(newDelay);
    chrome.storage.local.set({ debounceDelay: newDelay });
  };

  return (
    <div className="container">
      <h1>Copilot Translator</h1>

      <div className={`status-card ${isEnabled ? "active" : "inactive"}`}>
        <div className="status-icon">{isEnabled ? "🟢" : "⚪️"}</div>
        <div className="status-text">
          <p>
            <strong>Status:</strong> {isEnabled ? "Active" : "Inactive"}
          </p>
          <p className="description">
            {isEnabled
              ? "Highlight text to translate."
              : "Extension is paused."}
          </p>
        </div>

        <label className="switch">
          <input type="checkbox" checked={isEnabled} onChange={toggleSwitch} />
          <span className="slider round"></span>
        </label>
      </div>

      <div className="settings">
        <div className="setting-item">
          <label htmlFor="language">Target Language</label>
          <select 
            id="language" 
            value={targetLanguage} 
            onChange={handleLanguageChange}
          >
            <option value="Thai">Thai</option>
            <option value="English">English</option>
            <option value="Japanese">Japanese</option>
            <option value="Chinese">Chinese</option>
            <option value="Korean">Korean</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
          </select>
        </div>

        <div className="setting-item">
          <div className="setting-header">
            <label htmlFor="delay">Trigger Delay (ms)</label>
            <span className="value-badge">{debounceDelay}ms</span>
          </div>
          <input 
            type="range" 
            id="delay" 
            min="100" 
            max="1000" 
            step="50"
            value={debounceDelay} 
            onChange={handleDelayChange}
          />
        </div>
      </div>

      <div className="footer">
        <p>Powered by GitHub Copilot SDK</p>
      </div>
    </div>
  );
}

export default App;
