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
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Input Font Size</span>
              <span class="chatover-settings-value" data-for="inputFontSize">${settings.inputFontSize}px</span>
            </label>
            <input type="range" class="chatover-settings-slider" 
                   data-setting="inputFontSize" 
                   min="10" max="18" step="1" 
                   value="${settings.inputFontSize}">
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
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Background Color</span>
              <span class="chatover-settings-value" data-for="backgroundColor">${settings.backgroundColor}</span>
            </label>
            <input type="color" class="chatover-settings-color" 
                   data-setting="backgroundColor" 
                   value="${settings.backgroundColor}">
          </div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Message Text Color</span>
              <span class="chatover-settings-value" data-for="messageTextColor">${settings.messageTextColor}</span>
            </label>
            <input type="color" class="chatover-settings-color" 
                   data-setting="messageTextColor" 
                   value="${settings.messageTextColor}">
          </div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Message Hover Color</span>
              <span class="chatover-settings-value" data-for="messageHoverColor">${settings.messageHoverColor}</span>
            </label>
            <input type="color" class="chatover-settings-color" 
                   data-setting="messageHoverColor" 
                   value="${settings.messageHoverColor}">
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
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Outline Thickness</span>
              <span class="chatover-settings-value" data-for="outlineThickness">${settings.outlineThickness}px</span>
            </label>
            <input type="range" class="chatover-settings-slider" 
                   data-setting="outlineThickness" 
                   min="0" max="5" step="0.5" 
                   value="${settings.outlineThickness}">
          </div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Outline Color</span>
              <span class="chatover-settings-value" data-for="outlineColor">${settings.outlineColor}</span>
            </label>
            <input type="color" class="chatover-settings-color" 
                   data-setting="outlineColor" 
                   value="${settings.outlineColor}">
          </div>
        </div>
        
        <!-- Username Colors Section -->
        <div class="chatover-settings-section">
          <div class="chatover-settings-section-title">Username Colors</div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Channel Owner</span>
              <span class="chatover-settings-value" data-for="ownerColor">${settings.ownerColor}</span>
            </label>
            <input type="color" class="chatover-settings-color" 
                   data-setting="ownerColor" 
                   value="${settings.ownerColor}">
          </div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Moderator</span>
              <span class="chatover-settings-value" data-for="moderatorColor">${settings.moderatorColor}</span>
            </label>
            <input type="color" class="chatover-settings-color" 
                   data-setting="moderatorColor" 
                   value="${settings.moderatorColor}">
          </div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Member</span>
              <span class="chatover-settings-value" data-for="memberColor">${settings.memberColor}</span>
            </label>
            <input type="color" class="chatover-settings-color" 
                   data-setting="memberColor" 
                   value="${settings.memberColor}">
          </div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Verified Channel (✓)</span>
              <span class="chatover-settings-value" data-for="verifiedColor">${settings.verifiedColor}</span>
            </label>
            <input type="color" class="chatover-settings-color" 
                   data-setting="verifiedColor" 
                   value="${settings.verifiedColor}">
          </div>
          
          <div class="chatover-settings-group">
            <label class="chatover-settings-label">
              <span>Regular Users</span>
              <span class="chatover-settings-value" data-for="regularUserColor">${settings.regularUserColor}</span>
            </label>
            <input type="color" class="chatover-settings-color" 
                   data-setting="regularUserColor" 
                   value="${settings.regularUserColor}">
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
          } else if (setting === 'outlineThickness') {
            valueDisplay.textContent = `${value}px`;
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

    // Color inputs
    const colorInputs = panel.querySelectorAll('.chatover-settings-color');
    colorInputs.forEach(colorInput => {
      colorInput.addEventListener('input', (e) => {
        const setting = e.target.dataset.setting;
        const value = e.target.value;

        // Update display value
        const valueDisplay = panel.querySelector(`.chatover-settings-value[data-for="${setting}"]`);
        if (valueDisplay) {
          valueDisplay.textContent = value;
        }

        // Save setting
        setSetting(setting, value);
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

    // Update color inputs
    const colorInputs = panel.querySelectorAll('.chatover-settings-color');
    colorInputs.forEach(colorInput => {
      const setting = colorInput.dataset.setting;
      colorInput.value = settings[setting];

      // Update display value
      const valueDisplay = panel.querySelector(`.chatover-settings-value[data-for="${setting}"]`);
      if (valueDisplay) {
        valueDisplay.textContent = settings[setting];
      }
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
