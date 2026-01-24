/// <reference types="chrome" />
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    // Load state from storage on mount
    chrome.storage.local.get(
      ["isEnabled"],
      (result: { isEnabled: boolean }) => {
        // Default to true if not set
        setIsEnabled(result.isEnabled !== false);
      },
    );
  }, []);

  const toggleSwitch = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    chrome.storage.local.set({ isEnabled: newState });
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

      <div className="footer">
        <p>Powered by GitHub Copilot SDK</p>
      </div>
    </div>
  );
}

export default App;
