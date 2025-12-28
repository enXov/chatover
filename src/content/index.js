/**
 * ChatOver - Content Script
 * Injected into YouTube watch pages to detect live streams and manage overlay
 */

import browser from 'webextension-polyfill';
import { getChatManager, ConnectionState } from './chat/index.js';
import { MessageRenderer } from './chat/MessageRenderer.js';

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
let messageRenderer = null;
let chatConnected = false;

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
 * Extract video ID from current URL
 */
function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
}

/**
 * Check if this is an active live stream (not replay, not normal video)
 */
function isLiveStream() {
    // Check for the live badge - this is the most reliable indicator
    const liveBadge = document.querySelector('.ytp-live-badge');

    // If there's no live badge, it's not a live stream
    if (!liveBadge) {
        return false;
    }

    // The live badge must be visible (display !== 'none')
    // On replays, YouTube hides the badge with display: none
    const computedStyle = window.getComputedStyle(liveBadge);
    const isVisible = computedStyle.display !== 'none';

    return isVisible;
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
        // Find the video player container
        const videoPlayer = findElement(VIDEO_SELECTORS);
        if (!videoPlayer) {
            console.log('ChatOver: Could not find video player');
            return;
        }

        overlay = createOverlay();
        // Append to video player for containment
        videoPlayer.style.position = 'relative';
        videoPlayer.appendChild(overlay);
        restoreOverlayState(overlay);

        // Initialize chat when overlay is first created
        initializeChat(overlay);
    }

    overlay.classList.toggle('chatover-hidden');
    const isVisible = !overlay.classList.contains('chatover-hidden');

    // Connect/disconnect chat based on visibility
    if (isVisible && !chatConnected) {
        connectChat();
    }

    // Save visibility state
    browser.storage.sync.set({ visible: isVisible });
}

/**
 * Initialize chat components for the overlay
 */
function initializeChat(overlay) {
    const messagesContainer = overlay.querySelector('.chatover-messages');
    const placeholder = messagesContainer.querySelector('.chatover-placeholder');

    // Remove placeholder
    if (placeholder) {
        placeholder.remove();
    }

    // Create message renderer
    messageRenderer = new MessageRenderer(messagesContainer);

    // Set up input handling
    const input = overlay.querySelector('.chatover-input');
    setupInputHandler(input);

    // Update connection status indicator
    updateConnectionStatus(overlay, ConnectionState.DISCONNECTED);
}

/**
 * Connect to live chat
 */
async function connectChat() {
    const videoId = getVideoId();
    if (!videoId) {
        console.log('ChatOver: No video ID found');
        return;
    }

    const overlay = document.getElementById('chatover-overlay');
    if (!overlay) return;

    const chatManager = getChatManager();

    // Set up event listeners
    chatManager.on('message', (message) => {
        if (messageRenderer) {
            messageRenderer.addMessage(message);
        }
    });

    chatManager.on('state', (state) => {
        updateConnectionStatus(overlay, state);

        if (state === ConnectionState.CONNECTED) {
            chatConnected = true;
            enableInput(overlay);
        } else if (state === ConnectionState.ERROR || state === ConnectionState.ENDED) {
            chatConnected = false;
            disableInput(overlay);
        }
    });

    chatManager.on('error', (error) => {
        console.error('ChatOver: Chat error:', error);
        if (messageRenderer) {
            messageRenderer.showStatus('Chat connection error. Retrying...', 'error');
        }
    });

    // Connect to chat
    updateConnectionStatus(overlay, ConnectionState.CONNECTING);
    await chatManager.connect(videoId);
}

/**
 * Disconnect from live chat
 */
function disconnectChat() {
    const chatManager = getChatManager();
    chatManager.disconnect();
    chatConnected = false;
}

/**
 * Update connection status indicator in overlay
 */
function updateConnectionStatus(overlay, state) {
    let statusIndicator = overlay.querySelector('.chatover-status-indicator');

    if (!statusIndicator) {
        // Create status indicator
        statusIndicator = document.createElement('div');
        statusIndicator.className = 'chatover-status-indicator';
        const header = overlay.querySelector('.chatover-header');
        header.insertBefore(statusIndicator, header.firstChild);
    }

    // Update indicator based on state
    statusIndicator.className = 'chatover-status-indicator';

    switch (state) {
        case ConnectionState.CONNECTING:
            statusIndicator.classList.add('chatover-status-connecting');
            statusIndicator.title = 'Connecting to chat...';
            break;
        case ConnectionState.CONNECTED:
            statusIndicator.classList.add('chatover-status-connected');
            statusIndicator.title = 'Connected to chat';
            break;
        case ConnectionState.ERROR:
            statusIndicator.classList.add('chatover-status-error');
            statusIndicator.title = 'Chat connection error';
            break;
        case ConnectionState.ENDED:
            statusIndicator.classList.add('chatover-status-ended');
            statusIndicator.title = 'Stream ended';
            break;
        default:
            statusIndicator.classList.add('chatover-status-disconnected');
            statusIndicator.title = 'Not connected';
    }
}

/**
 * Set up the input handler for sending messages
 */
function setupInputHandler(input) {
    if (!input) return;

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const text = input.value.trim();

            if (text) {
                // Use ChatManager to send via youtubei.js
                const chatManager = getChatManager();
                const sent = await chatManager.sendMessage(text);

                if (sent) {
                    input.value = '';
                } else {
                    console.log('ChatOver: Failed to send message');
                    // Show error briefly
                    input.classList.add('chatover-input-error');
                    setTimeout(() => input.classList.remove('chatover-input-error'), 1000);
                }
            }
        }
    });
}

/**
 * Enable the input field
 */
function enableInput(overlay) {
    const input = overlay.querySelector('.chatover-input');
    if (input) {
        input.disabled = false;
        input.placeholder = 'Type a message...';
    }
}

/**
 * Disable the input field
 */
function disableInput(overlay) {
    const input = overlay.querySelector('.chatover-input');
    if (input) {
        input.disabled = true;
        input.placeholder = 'Chat not connected';
    }
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
            <div class="chatover-controls">
                <button class="chatover-settings-btn" title="Settings">⚙️</button>
            </div>
        </div>
        <div class="chatover-messages">
            <div class="chatover-placeholder">
                Connecting to chat...
            </div>
        </div>
        <div class="chatover-input-container">
            <input type="text" class="chatover-input" placeholder="Connecting..." disabled />
        </div>
        <div class="chatover-resize"></div>
    `;

    // Add event listeners
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
 * Make an element draggable from anywhere on the overlay (constrained to parent)
 */
function makeDraggable(element) {
    let isDragging = false;
    let startX, startY, initialX, initialY;

    element.addEventListener('mousedown', (e) => {
        // Don't drag if clicking on controls, resize handle, or input
        if (e.target.closest('.chatover-controls')) return;
        if (e.target.closest('.chatover-resize')) return;
        if (e.target.closest('.chatover-input')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // Get current position relative to parent
        initialX = element.offsetLeft;
        initialY = element.offsetTop;

        element.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Get parent (video player) dimensions
        const parent = element.parentElement;
        if (!parent) return;

        const parentWidth = parent.offsetWidth;
        const parentHeight = parent.offsetHeight;

        // Constrain to parent bounds
        const newX = Math.max(0, Math.min(parentWidth - element.offsetWidth, initialX + deltaX));
        const newY = Math.max(0, Math.min(parentHeight - element.offsetHeight, initialY + deltaY));

        element.style.left = `${newX}px`;
        element.style.top = `${newY}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            element.style.cursor = 'default';

            // Save position as percentage of parent for responsive positioning
            const parent = element.parentElement;
            if (parent) {
                browser.storage.sync.set({
                    position: {
                        x: element.offsetLeft,
                        y: element.offsetTop
                    }
                });
            }
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

    // Disconnect chat
    disconnectChat();

    if (overlay) overlay.remove();
    if (button) button.remove();

    messageRenderer = null;
    isInitialized = false;
    chatConnected = false;
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
    cleanup();
    setTimeout(init, 500);
});

// Also handle popstate for browser back/forward
window.addEventListener('popstate', () => {
    console.log('ChatOver: Popstate navigation detected');
    cleanup();
    setTimeout(init, 500);
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
