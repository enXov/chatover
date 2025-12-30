/**
 * ChatOver - Background Service Worker
 * Handles extension lifecycle and message passing
 */

import browser from 'webextension-polyfill';

// Initialize default settings on install
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings on install
    browser.storage.sync.set({
      visible: false,
      position: { x: 20, y: 20 },
      size: { width: 350, height: 500 },
      settings: {
        fontSize: 14,
        usernameFontSize: 13,
        messageFontSize: 14,
        transparency: 0.85,
        textOutline: true,
        maxMessages: 50
      }
    });
  }
});

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((message) => {
  switch (message.type) {
  case 'GET_SETTINGS':
    return browser.storage.sync.get('settings');

  case 'SAVE_SETTINGS':
    return browser.storage.sync.set({ settings: message.settings });

  default:
    return Promise.resolve({ error: 'Unknown message type' });
  }
});

console.log('ChatOver: Background service worker started');
