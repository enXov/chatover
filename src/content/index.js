/**
 * ChatOver - Content Script
 * Injected into YouTube watch pages to detect live streams and manage overlay
 */

import browser from 'webextension-polyfill';

// Selectors for YouTube elements
const VIDEO_SELECTORS = [
    '#movie_player',
    '.html5-video-player',
    'ytd-player'
];

const CHAT_SELECTORS = [
    '#chat-container',
    'ytd-live-chat-frame',
    '#chatframe'
];

const CHAT_BUTTON_CONTAINER = '#chat-container #show-hide-button';

/**
 * Find element using multiple selectors (resilience against YouTube DOM changes)
 */
function findElement(selectors) {
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }
    return null;
}

/**
 * Check if this is a live stream page
 */
function isLiveStream() {
    const chatFrame = findElement(CHAT_SELECTORS);
    const liveIndicator = document.querySelector('.ytp-live-badge');
    return !!(chatFrame || liveIndicator);
}

/**
 * Create the "Open Panel" button for the overlay
 */
function createToggleButton() {
    const button = document.createElement('button');
    button.id = 'chatover-toggle-btn';
    button.className = 'chatover-toggle-btn';
    button.textContent = 'ChatOver';
    button.title = 'Toggle ChatOver overlay';

    button.addEventListener('click', () => {
        toggleOverlay();
    });

    return button;
}

/**
 * Toggle the chat overlay visibility
 */
function toggleOverlay() {
    let overlay = document.getElementById('chatover-overlay');

    if (!overlay) {
        overlay = createOverlay();
        const videoPlayer = findElement(VIDEO_SELECTORS);
        if (videoPlayer) {
            videoPlayer.appendChild(overlay);
        }
    }

    overlay.classList.toggle('chatover-hidden');

    // Save visibility state
    browser.storage.sync.set({ visible: !overlay.classList.contains('chatover-hidden') });
}

/**
 * Create the main chat overlay element
 */
function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'chatover-overlay';
    overlay.className = 'chatover-overlay';

    overlay.innerHTML = `
    <div class="chatover-header">
      <span class="chatover-title">ChatOver</span>
      <div class="chatover-controls">
        <button class="chatover-settings-btn" title="Settings">⚙️</button>
        <button class="chatover-close-btn" title="Close">✕</button>
      </div>
    </div>
    <div class="chatover-messages">
      <div class="chatover-placeholder">
        Chat messages will appear here when a live stream is active.
      </div>
    </div>
    <div class="chatover-input-container">
      <input type="text" class="chatover-input" placeholder="Type a message..." disabled />
      <button class="chatover-send-btn" disabled>Send</button>
    </div>
  `;

    // Add event listeners
    const closeBtn = overlay.querySelector('.chatover-close-btn');
    closeBtn.addEventListener('click', () => toggleOverlay());

    const settingsBtn = overlay.querySelector('.chatover-settings-btn');
    settingsBtn.addEventListener('click', () => openSettings());

    // Make overlay draggable
    makeDraggable(overlay);

    return overlay;
}

/**
 * Make an element draggable
 */
function makeDraggable(element) {
    const header = element.querySelector('.chatover-header');
    let isDragging = false;
    let startX, startY, initialX, initialY;

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.chatover-controls')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = element.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        element.style.left = `${initialX + deltaX}px`;
        element.style.top = `${initialY + deltaY}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            header.style.cursor = 'grab';

            // Save position
            const rect = element.getBoundingClientRect();
            browser.storage.sync.set({
                position: { x: rect.left, y: rect.top }
            });
        }
    });
}

/**
 * Open settings panel
 */
function openSettings() {
    console.log('ChatOver: Settings panel coming soon!');
    // TODO: Implement settings panel in Phase 3
}

/**
 * Initialize ChatOver
 */
async function init() {
    console.log('ChatOver: Initializing...');

    // Wait for YouTube to fully load
    await waitForElement('#content');

    // Check if this is a live stream
    if (!isLiveStream()) {
        console.log('ChatOver: Not a live stream, inactive.');
        return;
    }

    console.log('ChatOver: Live stream detected!');

    // Add toggle button
    const buttonContainer = document.querySelector(CHAT_BUTTON_CONTAINER);
    if (buttonContainer) {
        const toggleBtn = createToggleButton();
        buttonContainer.parentElement.insertBefore(toggleBtn, buttonContainer);
    }

    // Load saved settings and restore state
    const settings = await browser.storage.sync.get(['visible', 'position']);
    if (settings.visible) {
        toggleOverlay();

        if (settings.position) {
            const overlay = document.getElementById('chatover-overlay');
            if (overlay) {
                overlay.style.left = `${settings.position.x}px`;
                overlay.style.top = `${settings.position.y}px`;
                overlay.style.right = 'auto';
                overlay.style.bottom = 'auto';
            }
        }
    }
}

/**
 * Wait for an element to appear in the DOM
 */
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        }, timeout);
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
