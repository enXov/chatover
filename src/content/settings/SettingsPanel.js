/**
 * ChatOver - Settings Panel
 * UI component for adjusting overlay settings
 */

import { getSettings, setSetting, resetSettings, getDefaultSettings } from './SettingsManager.js';

/**
 * SettingsPanel class - Creates and manages the settings UI
 */
export class SettingsPanel {
  constructor(videoPlayer) {
    this.videoPlayer = videoPlayer;
    this.panel = null;
    this.isOpen = false;
    this.onClose = null;
  }

  /**
   * Open the settings panel
   * @param {Function} onCloseCallback - Called when panel is closed
   */
  open(onCloseCallback) {
    if (this.isOpen) return;

    this.onClose = onCloseCallback;
    this.panel = this.createPanel();
    this.videoPlayer.appendChild(this.panel);
    this.isOpen = true;

    // Animate in
    requestAnimationFrame(() => {
      this.panel.classList.add('chatover-settings-open');
    });
  }

  /**
   * Close the settings panel
   */
  close() {
    if (!this.isOpen || !this.panel) return;

    this.panel.classList.remove('chatover-settings-open');

    // Wait for animation to complete
    setTimeout(() => {
      if (this.panel && this.panel.parentNode) {
        this.panel.remove();
      }
      this.panel = null;
      this.isOpen = false;

      if (this.onClose) {
        this.onClose();
      }
    }, 200);
  }

  /**
   * Create the settings panel DOM
   * @returns {HTMLElement}
   */
  createPanel() {
    const settings = getSettings();
    const defaults = getDefaultSettings();

    const panel = document.createElement('div');
    panel.className = 'chatover-settings-panel';

    panel.innerHTML = `
      <div class="chatover-settings-header">
        <span class="chatover-settings-title">ChatOver Settings</span>
        <button class="chatover-settings-close" title="Close">✕</button>
      </div>
      <div class="chatover-settings-content">
        <!-- Font Sizes Section -->
        <div class="chatover-settings-section">
          <div class="chatover-settings-section-title">Font Sizes</div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Username Font Size</span>
              <span class="chatover-settings-value" data-for="usernameFontSize">${settings.usernameFontSize}px</span>
            </label>
            <input type="range" class="chatover-settings-slider" 
                   data-setting="usernameFontSize" 
                   min="10" max="20" step="1" 
                   value="${settings.usernameFontSize}">
          </div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Message Font Size</span>
              <span class="chatover-settings-value" data-for="messageFontSize">${settings.messageFontSize}px</span>
            </label>
            <input type="range" class="chatover-settings-slider" 
                   data-setting="messageFontSize" 
                   min="10" max="24" step="1" 
                   value="${settings.messageFontSize}">
          </div>
        </div>
        
        <!-- Appearance Section -->
        <div class="chatover-settings-section">
          <div class="chatover-settings-section-title">Appearance</div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Background Opacity</span>
              <span class="chatover-settings-value" data-for="transparency">${Math.round(settings.transparency * 100)}%</span>
            </label>
            <input type="range" class="chatover-settings-slider" 
                   data-setting="transparency" 
                   min="0" max="1" step="0.05" 
                   value="${settings.transparency}">
          </div>
          
          <div class="chatover-settings-group chatover-settings-toggle-group">
            <label class="chatover-settings-label">
              <span>Text Outline</span>
            </label>
            <label class="chatover-settings-toggle">
              <input type="checkbox" data-setting="textOutline" ${settings.textOutline ? 'checked' : ''}>
              <span class="chatover-settings-toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
      <div class="chatover-settings-footer">
        <button class="chatover-settings-btn chatover-settings-reset">Reset to Defaults</button>
      </div>
    `;

    // Event listeners
    this.setupEventListeners(panel);

    // Stop event propagation to prevent YouTube shortcuts
    this.stopEventCapture(panel);

    return panel;
  }

  /**
   * Set up event listeners for the panel
   * @param {HTMLElement} panel 
   */
  setupEventListeners(panel) {
    // Close button
    const closeBtn = panel.querySelector('.chatover-settings-close');
    closeBtn.addEventListener('click', () => this.close());

    // Reset button
    const resetBtn = panel.querySelector('.chatover-settings-reset');
    resetBtn.addEventListener('click', async () => {
      await resetSettings();
      this.updateAllControls(panel);
    });

    // Slider inputs
    const sliders = panel.querySelectorAll('.chatover-settings-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', (e) => {
        const setting = e.target.dataset.setting;
        let value = parseFloat(e.target.value);

        // Update display value
        const valueDisplay = panel.querySelector(`.chatover-settings-value[data-for="${setting}"]`);
        if (valueDisplay) {
          if (setting === 'transparency') {
            valueDisplay.textContent = `${Math.round(value * 100)}%`;
          } else if (setting === 'maxMessages') {
            valueDisplay.textContent = value;
          } else {
            valueDisplay.textContent = `${value}px`;
          }
        }

        // Save setting
        setSetting(setting, value);
      });
    });

    // Toggle inputs
    const toggles = panel.querySelectorAll('input[type="checkbox"]');
    toggles.forEach(toggle => {
      toggle.addEventListener('change', (e) => {
        const setting = e.target.dataset.setting;
        setSetting(setting, e.target.checked);
      });
    });
  }

  /**
   * Update all controls to reflect current settings
   * @param {HTMLElement} panel 
   */
  updateAllControls(panel) {
    const settings = getSettings();

    // Update sliders
    const sliders = panel.querySelectorAll('.chatover-settings-slider');
    sliders.forEach(slider => {
      const setting = slider.dataset.setting;
      slider.value = settings[setting];

      // Update display value
      const valueDisplay = panel.querySelector(`.chatover-settings-value[data-for="${setting}"]`);
      if (valueDisplay) {
        if (setting === 'transparency') {
          valueDisplay.textContent = `${Math.round(settings[setting] * 100)}%`;
        } else if (setting === 'maxMessages') {
          valueDisplay.textContent = settings[setting];
        } else {
          valueDisplay.textContent = `${settings[setting]}px`;
        }
      }
    });

    // Update toggles
    const toggles = panel.querySelectorAll('input[type="checkbox"]');
    toggles.forEach(toggle => {
      const setting = toggle.dataset.setting;
      toggle.checked = settings[setting];
    });
  }

  /**
   * Stop keyboard events from bubbling to YouTube
   * @param {HTMLElement} element 
   */
  stopEventCapture(element) {
    const preventPropagation = (e) => {
      e.stopPropagation();
    };

    element.addEventListener('keydown', preventPropagation);
    element.addEventListener('keyup', preventPropagation);
    element.addEventListener('keypress', preventPropagation);
    element.addEventListener('wheel', preventPropagation, { passive: true });
  }

  /**
   * Destroy the panel and clean up
   */
  destroy() {
    if (this.panel && this.panel.parentNode) {
      this.panel.remove();
    }
    this.panel = null;
    this.isOpen = false;
  }
}
