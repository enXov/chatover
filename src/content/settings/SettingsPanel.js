/**
 * ChatOver - Settings Panel
 * UI component for adjusting overlay settings
 * Features: draggable, resizable, collapsible sections
 */

import browser from 'webextension-polyfill';
import { getSettings, setSetting, resetSettings, getDefaultSettings } from './SettingsManager.js';

// Minimum dimensions for the settings panel
const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;

/**
 * SettingsPanel class - Creates and manages the settings UI
 */
export class SettingsPanel {
  constructor(videoPlayer) {
    this.videoPlayer = videoPlayer;
    this.panel = null;
    this.isOpen = false;
    this.onClose = null;

    // Track collapsed sections
    this.collapsedSections = new Set();

    // Drag state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragInitialX = 0;
    this.dragInitialY = 0;

    // Resize state
    this.isResizing = false;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.resizeStartWidth = 0;
    this.resizeStartHeight = 0;

    // Bound handlers for cleanup
    this.boundDragMove = this.handleDragMove.bind(this);
    this.boundDragUp = this.handleDragUp.bind(this);
    this.boundResizeMove = this.handleResizeMove.bind(this);
    this.boundResizeUp = this.handleResizeUp.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundClickOutside = this.handleClickOutside.bind(this);
  }

  /**
   * Open the settings panel
   */
  async open(onCloseCallback) {
    if (this.isOpen) return;

    this.onClose = onCloseCallback;
    this.panel = await this.createPanel();
    this.videoPlayer.appendChild(this.panel);
    this.isOpen = true;

    // Add document-level event listeners
    document.addEventListener('mousemove', this.boundDragMove);
    document.addEventListener('mouseup', this.boundDragUp);
    document.addEventListener('mousemove', this.boundResizeMove);
    document.addEventListener('mouseup', this.boundResizeUp);
    document.addEventListener('keydown', this.boundKeyDown);

    setTimeout(() => {
      document.addEventListener('click', this.boundClickOutside);
    }, 100);

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

    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragUp);
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeUp);
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('click', this.boundClickOutside);

    setTimeout(() => {
      if (this.panel && this.panel.parentNode) {
        this.panel.remove();
      }
      this.panel = null;
      this.isOpen = false;
      if (this.onClose) this.onClose();
    }, 200);
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') this.close();
  }

  handleClickOutside(e) {
    if (this.panel && !this.panel.contains(e.target)) this.close();
  }

  /**
   * Create the settings panel DOM with collapsible sections
   */
  async createPanel() {
    const settings = getSettings();
    const savedState = await this.loadPanelState();

    // Load collapsed sections state
    try {
      const stored = await browser.storage.sync.get('settingsCollapsedSections');
      if (stored.settingsCollapsedSections) {
        this.collapsedSections = new Set(stored.settingsCollapsedSections);
      }
    } catch { }

    const panel = document.createElement('div');
    panel.className = 'chatover-settings-panel';

    // Apply saved or default position/size
    if (savedState.position) {
      panel.style.left = `${savedState.position.x}px`;
      panel.style.top = `${savedState.position.y}px`;
    } else {
      const playerRect = this.videoPlayer.getBoundingClientRect();
      const panelWidth = savedState.size?.width || 360;
      const panelHeight = savedState.size?.height || 480;
      panel.style.left = `${(playerRect.width - panelWidth) / 2}px`;
      panel.style.top = `${(playerRect.height - panelHeight) / 2}px`;
    }

    if (savedState.size) {
      panel.style.width = `${savedState.size.width}px`;
      panel.style.height = `${savedState.size.height}px`;
    }

    panel.innerHTML = `
      <!-- Header -->
      <div class="chatover-settings-header">
        <div class="chatover-settings-header-left">
          <span class="chatover-settings-icon">⚙️</span>
          <span class="chatover-settings-title">Settings</span>
        </div>
        <button class="chatover-settings-close" title="Close">×</button>
      </div>
      
      <div class="chatover-settings-content">
        <!-- Text Section -->
        ${this.createSection('text', '📝', 'Text', `
          ${this.createSlider('usernameFontSize', 'Username Size', settings.usernameFontSize, 10, 20, 1, 'px')}
          ${this.createSlider('messageFontSize', 'Message Size', settings.messageFontSize, 10, 24, 1, 'px')}
          ${this.createSlider('inputFontSize', 'Input Size', settings.inputFontSize, 10, 18, 1, 'px')}
          ${this.createSlider('messageSpacing', 'Message Spacing', settings.messageSpacing, 0, 16, 1, 'px')}
          ${this.createSlider('messageBorderRadius', 'Border Radius', settings.messageBorderRadius, 0, 16, 1, 'px')}
          ${this.createToggle('textOutline', 'Text Shadow', settings.textOutline)}
          ${this.createSlider('outlineThickness', 'Shadow Thickness', settings.outlineThickness, 0, 5, 0.5, 'px')}
          ${this.createColor('outlineColor', 'Shadow Color', settings.outlineColor)}
        `)}
        
        <!-- Colors Section -->
        ${this.createSection('colors', '🎨', 'Colors', `
          ${this.createColor('backgroundColor', 'Background', settings.backgroundColor)}
          ${this.createSlider('transparency', 'Opacity', settings.transparency, 0, 1, 0.05, '%', true)}
          ${this.createColor('messageTextColor', 'Text', settings.messageTextColor)}
          ${this.createColor('messageHoverColor', 'Hover', settings.messageHoverColor)}
        `)}
        
        <!-- Username Colors Section -->
        ${this.createSection('usernames', '👤', 'Username Colors', `
          ${this.createColorRow('ownerColor', '👑', 'Owner', settings.ownerColor)}
          ${this.createColorRow('moderatorColor', '🛡️', 'Moderator', settings.moderatorColor)}
          ${this.createColorRow('memberColor', '💎', 'Member', settings.memberColor)}
          ${this.createColorRow('verifiedColor', '✓', 'Verified', settings.verifiedColor)}
          ${this.createColorRow('regularUserColor', '👤', 'Regular', settings.regularUserColor)}
        `)}
        
        <!-- Avatars Section -->
        ${this.createSection('avatars', '🖼️', 'Avatars', `
          ${this.createToggle('showAvatars', 'Show Avatars', settings.showAvatars)}
          ${this.createSlider('avatarSize', 'Size', settings.avatarSize, 16, 32, 2, 'px')}
        `)}
      </div>
      
      <div class="chatover-settings-footer">
        <button class="chatover-settings-btn chatover-settings-reset">
          <span>↺</span> Reset All
        </button>
      </div>
      
      <div class="chatover-settings-resize"></div>
    `;

    this.setupEventListeners(panel);
    this.stopEventCapture(panel);

    return panel;
  }

  /**
   * Create a collapsible section
   */
  createSection(id, icon, title, content) {
    const isCollapsed = this.collapsedSections.has(id);
    return `
      <div class="chatover-settings-section ${isCollapsed ? 'collapsed' : ''}" data-section="${id}">
        <div class="chatover-settings-section-header">
          <span class="chatover-settings-section-icon">${icon}</span>
          <span class="chatover-settings-section-title">${title}</span>
          <span class="chatover-settings-section-arrow">${isCollapsed ? '▸' : '▾'}</span>
        </div>
        <div class="chatover-settings-section-body">
          ${content}
        </div>
      </div>
    `;
  }

  /**
   * Create a slider control
   */
  createSlider(key, label, value, min, max, step, unit, isPercentage = false) {
    const displayValue = isPercentage ? `${Math.round(value * 100)}%` : `${value}${unit}`;
    return `
      <div class="chatover-settings-row">
        <span class="chatover-settings-row-label">${label}</span>
        <div class="chatover-settings-row-control">
          <input type="range" class="chatover-settings-slider" 
                 data-setting="${key}" 
                 min="${min}" max="${max}" step="${step}" 
                 value="${value}">
          <span class="chatover-settings-value" data-for="${key}">${displayValue}</span>
        </div>
      </div>
    `;
  }

  /**
   * Create a toggle control
   */
  createToggle(key, label, checked) {
    return `
      <div class="chatover-settings-row">
        <span class="chatover-settings-row-label">${label}</span>
        <label class="chatover-settings-toggle">
          <input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''}>
          <span class="chatover-settings-toggle-slider"></span>
        </label>
      </div>
    `;
  }

  /**
   * Create a color picker control
   */
  createColor(key, label, value) {
    return `
      <div class="chatover-settings-row">
        <span class="chatover-settings-row-label">${label}</span>
        <div class="chatover-settings-row-control">
          <input type="color" class="chatover-settings-color" 
                 data-setting="${key}" 
                 value="${value}">
        </div>
      </div>
    `;
  }

  /**
   * Create a color row with icon (for username colors)
   */
  createColorRow(key, icon, label, value) {
    return `
      <div class="chatover-settings-color-row">
        <span class="chatover-settings-color-icon">${icon}</span>
        <span class="chatover-settings-color-label">${label}</span>
        <input type="color" class="chatover-settings-color-picker" 
               data-setting="${key}" 
               value="${value}">
      </div>
    `;
  }

  async loadPanelState() {
    try {
      const result = await browser.storage.sync.get(['settingsPanelPosition', 'settingsPanelSize']);
      return {
        position: result.settingsPanelPosition || null,
        size: result.settingsPanelSize || null
      };
    } catch {
      return { position: null, size: null };
    }
  }

  async savePanelPosition(x, y) {
    try {
      await browser.storage.sync.set({ settingsPanelPosition: { x, y } });
    } catch (error) {
      console.error('ChatOver: Failed to save settings panel position:', error);
    }
  }

  async savePanelSize(width, height) {
    try {
      await browser.storage.sync.set({ settingsPanelSize: { width, height } });
    } catch (error) {
      console.error('ChatOver: Failed to save settings panel size:', error);
    }
  }

  async saveCollapsedSections() {
    try {
      await browser.storage.sync.set({ settingsCollapsedSections: [...this.collapsedSections] });
    } catch (error) {
      console.error('ChatOver: Failed to save collapsed sections:', error);
    }
  }

  setupEventListeners(panel) {
    // Close button
    const closeBtn = panel.querySelector('.chatover-settings-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Header drag
    const header = panel.querySelector('.chatover-settings-header');
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.chatover-settings-close')) return;

      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragInitialX = panel.offsetLeft;
      this.dragInitialY = panel.offsetTop;
      header.style.cursor = 'grabbing';
      e.preventDefault();
    });

    // Section collapse toggle
    const sectionHeaders = panel.querySelectorAll('.chatover-settings-section-header');
    sectionHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.chatover-settings-section');
        const sectionId = section.dataset.section;
        const arrow = header.querySelector('.chatover-settings-section-arrow');

        if (section.classList.contains('collapsed')) {
          section.classList.remove('collapsed');
          arrow.textContent = '▾';
          this.collapsedSections.delete(sectionId);
        } else {
          section.classList.add('collapsed');
          arrow.textContent = '▸';
          this.collapsedSections.add(sectionId);
        }
        this.saveCollapsedSections();
      });
    });

    // Resize handle
    const resizeHandle = panel.querySelector('.chatover-settings-resize');
    resizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      this.resizeStartX = e.clientX;
      this.resizeStartY = e.clientY;
      this.resizeStartWidth = panel.offsetWidth;
      this.resizeStartHeight = panel.offsetHeight;
      e.preventDefault();
      e.stopPropagation();
    });

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

        const valueDisplay = panel.querySelector(`.chatover-settings-value[data-for="${setting}"]`);
        if (valueDisplay) {
          if (setting === 'transparency') {
            valueDisplay.textContent = `${Math.round(value * 100)}%`;
          } else {
            valueDisplay.textContent = `${value}px`;
          }
        }

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

    // Color inputs (both types)
    const colorInputs = panel.querySelectorAll('.chatover-settings-color, .chatover-settings-color-picker');
    colorInputs.forEach(colorInput => {
      colorInput.addEventListener('input', (e) => {
        const setting = e.target.dataset.setting;
        setSetting(setting, e.target.value);
      });
    });
  }

  handleDragMove(e) {
    if (!this.isDragging || !this.panel) return;

    const deltaX = e.clientX - this.dragStartX;
    const deltaY = e.clientY - this.dragStartY;
    const parent = this.videoPlayer;
    if (!parent) return;

    const newX = Math.max(0, Math.min(parent.offsetWidth - this.panel.offsetWidth, this.dragInitialX + deltaX));
    const newY = Math.max(0, Math.min(parent.offsetHeight - this.panel.offsetHeight, this.dragInitialY + deltaY));

    this.panel.style.left = `${newX}px`;
    this.panel.style.top = `${newY}px`;
  }

  handleDragUp() {
    if (this.isDragging && this.panel) {
      this.isDragging = false;
      const header = this.panel.querySelector('.chatover-settings-header');
      if (header) header.style.cursor = 'grab';
      this.savePanelPosition(this.panel.offsetLeft, this.panel.offsetTop);
    }
  }

  handleResizeMove(e) {
    if (!this.isResizing || !this.panel) return;

    const deltaX = e.clientX - this.resizeStartX;
    const deltaY = e.clientY - this.resizeStartY;
    const newWidth = Math.max(MIN_WIDTH, this.resizeStartWidth + deltaX);
    const newHeight = Math.max(MIN_HEIGHT, this.resizeStartHeight + deltaY);

    this.panel.style.width = `${newWidth}px`;
    this.panel.style.height = `${newHeight}px`;
  }

  handleResizeUp() {
    if (this.isResizing && this.panel) {
      this.isResizing = false;
      this.savePanelSize(this.panel.offsetWidth, this.panel.offsetHeight);
    }
  }

  updateAllControls(panel) {
    const settings = getSettings();

    // Update sliders
    panel.querySelectorAll('.chatover-settings-slider').forEach(slider => {
      const setting = slider.dataset.setting;
      slider.value = settings[setting];
      const valueDisplay = panel.querySelector(`.chatover-settings-value[data-for="${setting}"]`);
      if (valueDisplay) {
        if (setting === 'transparency') {
          valueDisplay.textContent = `${Math.round(settings[setting] * 100)}%`;
        } else {
          valueDisplay.textContent = `${settings[setting]}px`;
        }
      }
    });

    // Update toggles
    panel.querySelectorAll('input[type="checkbox"]').forEach(toggle => {
      toggle.checked = settings[toggle.dataset.setting];
    });

    // Update color inputs
    panel.querySelectorAll('.chatover-settings-color, .chatover-settings-color-picker').forEach(colorInput => {
      colorInput.value = settings[colorInput.dataset.setting];
    });
  }

  stopEventCapture(element) {
    const preventPropagation = (e) => e.stopPropagation();
    element.addEventListener('keydown', preventPropagation);
    element.addEventListener('keyup', preventPropagation);
    element.addEventListener('keypress', preventPropagation);
    element.addEventListener('wheel', preventPropagation, { passive: true });
  }

  destroy() {
    document.removeEventListener('mousemove', this.boundDragMove);
    document.removeEventListener('mouseup', this.boundDragUp);
    document.removeEventListener('mousemove', this.boundResizeMove);
    document.removeEventListener('mouseup', this.boundResizeUp);
    document.removeEventListener('keydown', this.boundKeyDown);
    document.removeEventListener('click', this.boundClickOutside);

    if (this.panel && this.panel.parentNode) this.panel.remove();
    this.panel = null;
    this.isOpen = false;
  }
}
