/**
 * ChatOver - Settings Manager
 * Handles loading, saving, and applying user settings
 */

import browser from 'webextension-polyfill';

// Default settings
const DEFAULT_SETTINGS = {
    usernameFontSize: 13,      // Username font size
    messageFontSize: 14,       // Message text font size
    inputFontSize: 13,         // Input field font size
    transparency: 0.5,         // Background opacity (0 = transparent, 1 = fully opaque)
    textOutline: true,         // Text shadow/outline toggle
    backgroundColor: '#000000', // Background color (hex)
    messageTextColor: '#eeeeee', // Message text color (hex)
    messageHoverColor: '#1a1a1a', // Message hover background color (hex)
    messageHoverOpacity: 0.3,     // Message hover background opacity (0-1)
    outlineThickness: 1,       // Text outline thickness in pixels
    outlineColor: '#000000',   // Text outline color (hex)
    // Username colors by role
    ownerColor: '#ffd600',     // Channel owner username color (yellow)
    moderatorColor: '#5e84f1', // Moderator username color (blue)
    memberColor: '#2ba640',    // Member username color (green)
    verifiedColor: '#aaaaaa',  // Verified channel username color (gray)
    regularUserColor: '#aaaaaa', // Regular user username color (gray)
    // Avatar settings
    avatarSize: 24,            // Avatar size in pixels
    showAvatars: true,         // Show/hide avatars
    // Layout settings
    messageSpacing: 0,         // Gap between messages in pixels (0 = touching)
    messageBorderRadius: 8,    // Border radius of message items in pixels
    // Text selection settings
    selectableMessages: true,  // Allow selecting message text
    selectableUsernames: true, // Allow selecting username text
    // Message direction setting
    messageDirection: 'bottom', // 'bottom' = newest at bottom (default), 'top' = newest at top
    // Input area settings
    inputBackgroundColor: '#000000', // Input background color
    inputBackgroundOpacity: 0.5,     // Input background opacity (0-1)
    inputTextColor: '#ffffff',       // Input text color
    inputPlaceholderColor: '#999999', // Input placeholder color
    inputAlwaysVisible: false         // Always show input (vs hover-only)
};

// Debounce timer for saving
let saveTimeout = null;
const SAVE_DEBOUNCE_MS = 500;

// Current settings in memory
let currentSettings = { ...DEFAULT_SETTINGS };

// Listeners for settings changes
const changeListeners = new Set();

/**
 * Load settings from browser.storage.sync
 * @returns {Promise<Object>} The loaded settings
 */
export async function loadSettings() {
    try {
        const result = await browser.storage.sync.get('settings');
        if (result.settings) {
            // Merge with defaults to ensure all keys exist
            currentSettings = { ...DEFAULT_SETTINGS, ...result.settings };
        } else {
            // No settings saved yet, use defaults
            currentSettings = { ...DEFAULT_SETTINGS };
        }
        return currentSettings;
    } catch (error) {
        console.error('ChatOver: Failed to load settings:', error);
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * Save settings to browser.storage.sync (debounced)
 * @param {Object} settings - The settings to save
 */
export function saveSettings(settings) {
    currentSettings = { ...currentSettings, ...settings };

    // Clear previous timeout
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    // Debounced save
    saveTimeout = setTimeout(async () => {
        try {
            await browser.storage.sync.set({ settings: currentSettings });
            console.log('ChatOver: Settings saved');
        } catch (error) {
            console.error('ChatOver: Failed to save settings:', error);
        }
    }, SAVE_DEBOUNCE_MS);
}

/**
 * Get the current settings
 * @returns {Object} Current settings
 */
export function getSettings() {
    return { ...currentSettings };
}

/**
 * Get a specific setting value
 * @param {string} key - The setting key
 * @returns {*} The setting value
 */
export function getSetting(key) {
    return currentSettings[key] ?? DEFAULT_SETTINGS[key];
}

/**
 * Update a specific setting and save
 * @param {string} key - The setting key
 * @param {*} value - The new value
 */
export function setSetting(key, value) {
    currentSettings[key] = value;
    saveSettings(currentSettings);
    notifyListeners(key, value);
}

/**
 * Reset settings to defaults
 */
export async function resetSettings() {
    currentSettings = { ...DEFAULT_SETTINGS };
    try {
        await browser.storage.sync.set({ settings: currentSettings });
        notifyListeners('reset', currentSettings);
        console.log('ChatOver: Settings reset to defaults');
    } catch (error) {
        console.error('ChatOver: Failed to reset settings:', error);
    }
}

/**
 * Add a listener for settings changes
 * @param {Function} callback - Callback function(key, value)
 */
export function addChangeListener(callback) {
    changeListeners.add(callback);
}

/**
 * Remove a settings change listener
 * @param {Function} callback - The callback to remove
 */
export function removeChangeListener(callback) {
    changeListeners.delete(callback);
}

/**
 * Notify all listeners of a settings change
 * @param {string} key - The changed setting key
 * @param {*} value - The new value
 */
function notifyListeners(key, value) {
    changeListeners.forEach(callback => {
        try {
            callback(key, value);
        } catch (error) {
            console.error('ChatOver: Settings listener error:', error);
        }
    });
}

/**
 * Apply current settings to the overlay DOM
 * @param {HTMLElement} overlay - The overlay element
 */
export function applySettingsToOverlay(overlay) {
    if (!overlay) return;

    const settings = getSettings();

    // Apply CSS custom properties for real-time updates
    overlay.style.setProperty('--chatover-username-font-size', `${settings.usernameFontSize}px`);
    overlay.style.setProperty('--chatover-message-font-size', `${settings.messageFontSize}px`);
    overlay.style.setProperty('--chatover-input-font-size', `${settings.inputFontSize}px`);
    overlay.style.setProperty('--chatover-transparency', settings.transparency);
    overlay.style.setProperty('--chatover-background-color', settings.backgroundColor);
    overlay.style.setProperty('--chatover-message-text-color', settings.messageTextColor);
    overlay.style.setProperty('--chatover-message-hover-color', settings.messageHoverColor);
    // Convert hex color + opacity to rgba for proper hover background
    const hoverHex = settings.messageHoverColor;
    const hoverOpacity = settings.messageHoverOpacity;
    const r = parseInt(hoverHex.slice(1, 3), 16);
    const g = parseInt(hoverHex.slice(3, 5), 16);
    const b = parseInt(hoverHex.slice(5, 7), 16);
    overlay.style.setProperty('--chatover-message-hover-rgba', `rgba(${r}, ${g}, ${b}, ${hoverOpacity})`);
    overlay.style.setProperty('--chatover-outline-thickness', `${settings.outlineThickness}px`);
    overlay.style.setProperty('--chatover-outline-color', settings.outlineColor);
    // Username colors by role
    overlay.style.setProperty('--chatover-owner-color', settings.ownerColor);
    overlay.style.setProperty('--chatover-moderator-color', settings.moderatorColor);
    overlay.style.setProperty('--chatover-member-color', settings.memberColor);
    overlay.style.setProperty('--chatover-verified-color', settings.verifiedColor);
    overlay.style.setProperty('--chatover-regular-user-color', settings.regularUserColor);
    // Avatar settings
    overlay.style.setProperty('--chatover-avatar-size', `${settings.avatarSize}px`);
    // Layout settings
    overlay.style.setProperty('--chatover-message-spacing', `${settings.messageSpacing}px`);
    overlay.style.setProperty('--chatover-message-border-radius', `${settings.messageBorderRadius}px`);

    // Apply text outline class
    if (settings.textOutline) {
        overlay.classList.add('chatover-text-outline');
    } else {
        overlay.classList.remove('chatover-text-outline');
    }

    // Apply avatar visibility class
    if (!settings.showAvatars) {
        overlay.classList.add('chatover-hide-avatars');
    } else {
        overlay.classList.remove('chatover-hide-avatars');
    }

    // Apply text selection classes
    if (settings.selectableMessages) {
        overlay.classList.add('chatover-selectable-messages');
    } else {
        overlay.classList.remove('chatover-selectable-messages');
    }

    if (settings.selectableUsernames) {
        overlay.classList.add('chatover-selectable-usernames');
    } else {
        overlay.classList.remove('chatover-selectable-usernames');
    }

    // Apply message direction class
    if (settings.messageDirection === 'top') {
        overlay.classList.add('chatover-messages-top');
    } else {
        overlay.classList.remove('chatover-messages-top');
    }

    // Input area styling - parse hex color to RGB for rgba support
    const inputBgHex = settings.inputBackgroundColor;
    const inputBgR = parseInt(inputBgHex.slice(1, 3), 16);
    const inputBgG = parseInt(inputBgHex.slice(3, 5), 16);
    const inputBgB = parseInt(inputBgHex.slice(5, 7), 16);
    overlay.style.setProperty('--chatover-input-bg-r', inputBgR);
    overlay.style.setProperty('--chatover-input-bg-g', inputBgG);
    overlay.style.setProperty('--chatover-input-bg-b', inputBgB);
    overlay.style.setProperty('--chatover-input-bg-opacity', settings.inputBackgroundOpacity);
    overlay.style.setProperty('--chatover-input-text-color', settings.inputTextColor);
    overlay.style.setProperty('--chatover-input-placeholder-color', settings.inputPlaceholderColor);

    // Apply input always visible class
    if (settings.inputAlwaysVisible) {
        overlay.classList.add('chatover-input-always-visible');
    } else {
        overlay.classList.remove('chatover-input-always-visible');
    }
}

/**
 * Get the default settings
 * @returns {Object} Default settings
 */
export function getDefaultSettings() {
    return { ...DEFAULT_SETTINGS };
}

export { DEFAULT_SETTINGS };
