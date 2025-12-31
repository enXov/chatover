/**
 * ChatOver - Settings Manager
 * Handles loading, saving, and applying user settings
 */

import browser from 'webextension-polyfill';

// Default settings
const DEFAULT_SETTINGS = {
    usernameFontSize: 13,   // Username font size
    messageFontSize: 14,    // Message text font size
    transparency: 0.5,      // Background opacity (0 = transparent, 1 = fully opaque)
    textOutline: true       // Text shadow/outline toggle
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
    overlay.style.setProperty('--chatover-transparency', settings.transparency);

    // Apply text outline class
    if (settings.textOutline) {
        overlay.classList.add('chatover-text-outline');
    } else {
        overlay.classList.remove('chatover-text-outline');
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
