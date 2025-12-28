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

// Multiple selector options for toggle button placement
const BUTTON_PLACEMENT_SELECTORS = [
    '.ytp-right-controls',           // Fullscreen-compatible position
    '#chat-container #show-hide-button', // Near chat toggle
    '#secondary-inner'               // Sidebar fallback
];

// Minimum overlay dimensions
const MIN_WIDTH = 280;
const MIN_HEIGHT = 300;

// State tracking
let isInitialized = false;

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
    // Remove existing button if present
    const existingBtn = document.getElementById('chatover-toggle-btn');
    if (existingBtn) existingBtn.remove();

    const button = document.createElement('button');
    button.id = 'chatover-toggle-btn';
    button.className = 'chatover-toggle-btn ytp-button';
    button.textContent = 'ChatOver';
    button.title = 'Toggle ChatOver overlay';

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleOverlay();
    });

    return button;
}

/**
 * Insert toggle button into YouTube UI
 */
function insertToggleButton() {
    const button = createToggleButton();

    // Try each placement selector
    for (const selector of BUTTON_PLACEMENT_SELECTORS) {
        const container = document.querySelector(selector);
        if (container) {
            if (selector === '.ytp-right-controls') {
                // Insert at beginning of right controls for visibility
                container.insertBefore(button, container.firstChild);
            } else {
                container.parentElement?.insertBefore(button, container);
            }
            console.log('ChatOver: Button inserted at', selector);
            return true;
        }
    }

    console.log('ChatOver: Could not find button container');
    return false;
}

/**
 * Toggle the chat overlay visibility
 */
function toggleOverlay() {
    let overlay = document.getElementById('chatover-overlay');

    if (!overlay) {
        overlay = createOverlay();
        // Append to body for fullscreen compatibility
        document.body.appendChild(overlay);
        restoreOverlayState(overlay);
    }

    overlay.classList.toggle('chatover-hidden');
    const isVisible = !overlay.classList.contains('chatover-hidden');

    // Save visibility state
    browser.storage.sync.set({ visible: isVisible });
}

/**
 * Toggle minimize state
 */
function toggleMinimize() {
    const overlay = document.getElementById('chatover-overlay');
    if (!overlay) return;

    overlay.classList.toggle('chatover-minimized');
    const isMinimized = overlay.classList.contains('chatover-minimized');

    // Save minimized state
    browser.storage.sync.set({ minimized: isMinimized });
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
                <button class="chatover-minimize-btn" title="Minimize">─</button>
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
        <div class="chatover-resize"></div>
    `;

    // Add event listeners
    const closeBtn = overlay.querySelector('.chatover-close-btn');
    closeBtn.addEventListener('click', () => toggleOverlay());

    const minimizeBtn = overlay.querySelector('.chatover-minimize-btn');
    minimizeBtn.addEventListener('click', () => toggleMinimize());

    const settingsBtn = overlay.querySelector('.chatover-settings-btn');
    settingsBtn.addEventListener('click', () => openSettings());

    // Make overlay draggable and resizable
    makeDraggable(overlay);
    makeResizable(overlay);

    return overlay;
}

/**
 * Restore overlay state from storage
 */
async function restoreOverlayState(overlay) {
    const settings = await browser.storage.sync.get(['position', 'size', 'minimized']);

    if (settings.position) {
        overlay.style.left = `${settings.position.x}px`;
        overlay.style.top = `${settings.position.y}px`;
        overlay.style.right = 'auto';
        overlay.style.bottom = 'auto';
    }

    if (settings.size) {
        overlay.style.width = `${settings.size.width}px`;
        overlay.style.height = `${settings.size.height}px`;
    }

    if (settings.minimized) {
        overlay.classList.add('chatover-minimized');
    }
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
        if (element.classList.contains('chatover-minimized')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        const rect = element.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;

        header.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Constrain to viewport
        const newX = Math.max(0, Math.min(window.innerWidth - element.offsetWidth, initialX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - element.offsetHeight, initialY + deltaY));

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
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
 * Make an element resizable via bottom-right corner
 */
function makeResizable(element) {
    const resizeHandle = element.querySelector('.chatover-resize');
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = element.offsetWidth;
        startHeight = element.offsetHeight;
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Apply new size with minimum constraints
        const newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
        const newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);

        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;

            // Save size
            browser.storage.sync.set({
                size: { width: element.offsetWidth, height: element.offsetHeight }
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
 * Handle fullscreen changes
 */
function handleFullscreenChange() {
    const overlay = document.getElementById('chatover-overlay');
    if (!overlay) return;

    // Constrain overlay to viewport when fullscreen changes
    const rect = overlay.getBoundingClientRect();
    const maxX = window.innerWidth - overlay.offsetWidth;
    const maxY = window.innerHeight - overlay.offsetHeight;

    if (rect.left > maxX || rect.top > maxY) {
        overlay.style.left = `${Math.max(0, Math.min(rect.left, maxX))}px`;
        overlay.style.top = `${Math.max(0, Math.min(rect.top, maxY))}px`;
    }
}

/**
 * Cleanup overlay and button
 */
function cleanup() {
    const overlay = document.getElementById('chatover-overlay');
    const button = document.getElementById('chatover-toggle-btn');
    if (overlay) overlay.remove();
    if (button) button.remove();
    isInitialized = false;
}

/**
 * Initialize ChatOver
 */
async function init() {
    // Prevent double initialization
    if (isInitialized) return;

    console.log('ChatOver: Initializing...');

    // Wait for YouTube to fully load
    try {
        await waitForElement('#content', 10000);
    } catch (e) {
        console.log('ChatOver: YouTube content not loaded');
        return;
    }

    // Check if this is a live stream
    if (!isLiveStream()) {
        console.log('ChatOver: Not a live stream, inactive.');
        cleanup();
        return;
    }

    console.log('ChatOver: Live stream detected!');
    isInitialized = true;

    // Insert toggle button (with retry for dynamic loading)
    const insertButton = () => {
        if (!insertToggleButton()) {
            setTimeout(insertButton, 1000);
        }
    };
    insertButton();

    // Load saved settings and restore state
    const settings = await browser.storage.sync.get(['visible']);
    if (settings.visible) {
        toggleOverlay();
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

// Listen for fullscreen changes
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

// Listen for YouTube SPA navigation
window.addEventListener('yt-navigate-finish', () => {
    console.log('ChatOver: YouTube navigation detected');
    isInitialized = false;
    setTimeout(init, 500);
});

// Also handle popstate for browser back/forward
window.addEventListener('popstate', () => {
    console.log('ChatOver: Popstate navigation detected');
    isInitialized = false;
    setTimeout(init, 500);
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
