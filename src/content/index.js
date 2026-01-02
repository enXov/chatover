/**
 * ChatOver - Content Script
 * Injected into YouTube watch pages to detect live streams and manage overlay
 */

import browser from 'webextension-polyfill';
import { getChatManager, ConnectionState, resetMessageSender, resetChatManager } from './chat/index.js';
import { MessageRenderer } from './chat/MessageRenderer.js';
import {
  loadSettings,
  addChangeListener,
  removeChangeListener,
  applySettingsToOverlay,
  SettingsPanel
} from './settings/index.js';

// Selectors for YouTube elements
const VIDEO_SELECTORS = [
  '#movie_player',
  '.html5-video-player',
  'ytd-player'
];

// Button placement - only in teaser carousel (below video, not in player controls)
const BUTTON_PLACEMENT_SELECTOR = '#teaser-carousel';

// Minimum overlay dimensions
const MIN_WIDTH = 280;
const MIN_HEIGHT = 300;

// State tracking
let isInitialized = false;
let isInitializing = false; // Lock to prevent parallel init
let initTimer = null; // Timer for debounced init
let currentInitToken = null; // Token to validate active init session
let messageRenderer = null;
let chatConnected = false;
let resizeObserver = null;
let isToggling = false; // Debounce lock for toggle button
let settingsPanel = null; // Settings panel instance
let settingsChangeListener = null; // Settings change listener

// Document-level event handlers (stored for cleanup)
let dragMoveHandler = null;
let dragUpHandler = null;
let resizeMoveHandler = null;
let resizeUpHandler = null;

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
 * Check if current URL is a YouTube watch page
 */
function isWatchPage() {
  return window.location.pathname === '/watch' && getVideoId() !== null;
}

/**
 * Wait for live stream indicators to appear in the DOM
 * This handles the case where YouTube's player loads asynchronously
 * Only checks for the live badge - chat container exists on all videos
 */
function waitForLiveStreamIndicator(timeout = 15000) {
  return new Promise((resolve) => {
    // Check immediately first
    if (isLiveStream()) {
      resolve(true);
      return;
    }

    // Use a flag to prevent double-resolution and ensure cleanup
    let resolved = false;
    let checkInterval = null;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      if (checkInterval) clearInterval(checkInterval);
    };

    const observer = new MutationObserver(() => {
      // Check live badge only (chat container exists on non-live videos too)
      if (!resolved && isLiveStream()) {
        cleanup();
        resolve(true);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    // Also poll periodically as backup (some style changes don't trigger mutation)
    checkInterval = setInterval(() => {
      if (!resolved && isLiveStream()) {
        cleanup();
        resolve(true);
      }
    }, 500);

    // Timeout
    setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeout);
  });
}


/**
 * Create the "Open Panel" button for the overlay
 * @param {boolean} forTeaserCarousel - If true, style for teaser carousel placement
 */
function createToggleButton(forTeaserCarousel = false) {
  // Remove existing button if present
  const existingBtn = document.getElementById('chatover-toggle-btn');
  if (existingBtn) existingBtn.remove();

  // Double check - if we already have a button (race condition), don't create another
  if (document.getElementById('chatover-toggle-btn')) return null;

  const button = document.createElement('button');
  button.id = 'chatover-toggle-btn';
  button.className = forTeaserCarousel ? 'chatover-toggle-btn chatover-toggle-btn-teaser' : 'chatover-toggle-btn ytp-button';
  button.textContent = 'ChatOver';
  button.title = 'Toggle ChatOver overlay';

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleOverlay();
  });

  return button;
}

/**
 * Insert toggle button into YouTube UI (teaser carousel only)
 */
function insertToggleButton() {
  // Safety check - do not insert if already exists
  if (document.getElementById('chatover-toggle-btn')) {
    return true;
  }

  const container = document.querySelector(BUTTON_PLACEMENT_SELECTOR);
  if (container) {
    // Find the Live chat section in the teaser carousel
    const liveChatSection = findLiveChatTeaserSection(container);
    if (liveChatSection) {
      const button = createToggleButton(true);
      if (button) {
        // Insert button at the end of the Live chat section
        liveChatSection.appendChild(button);
        return true;
      }
    }
  }

  return false;
}

/**
 * Find the Live chat section within the teaser carousel
 * Tries multiple strategies as YouTube's DOM can vary
 */
function findLiveChatTeaserSection(teaserCarousel) {
  // Strategy 1: Look for section with class containing 'ItemSection'
  const sections = teaserCarousel.querySelectorAll('[class*="ItemSection"], [class*="item-section"]');
  for (const section of sections) {
    if (section.textContent.includes('Live chat')) {
      return section;
    }
  }

  // Strategy 2: Look for any element containing "Live chat" text
  const allElements = teaserCarousel.querySelectorAll('*');
  for (const el of allElements) {
    // Check direct text content (not children)
    const directText = Array.from(el.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent)
      .join('');
    if (directText.includes('Live chat')) {
      // Return the parent container that likely holds the whole section
      return el.closest('[class*="carousel"], [class*="teaser"]') || el.parentElement;
    }
  }

  // Strategy 3: Find 'Open panel' button and get its container
  const openPanelBtn = teaserCarousel.querySelector('button');
  if (openPanelBtn && openPanelBtn.textContent.includes('Open panel')) {
    return openPanelBtn.parentElement;
  }

  // Strategy 4: Just return the teaser carousel itself as last resort
  return teaserCarousel;
}

/**
 * Toggle the chat overlay visibility
 * Uses debounce lock to prevent race conditions from rapid clicks
 */
function toggleOverlay() {
  // Debounce - prevent rapid double-clicks from causing issues
  if (isToggling) {
    return;
  }
  isToggling = true;

  // Release the lock after a short delay
  setTimeout(() => {
    isToggling = false;
  }, 300);

  let overlay = document.getElementById('chatover-overlay');

  if (!overlay) {
    // Find the video player container
    const videoPlayer = findElement(VIDEO_SELECTORS);
    if (!videoPlayer) {
      isToggling = false;
      return;
    }

    overlay = createOverlay();
    // Append to video player for containment
    videoPlayer.style.position = 'relative';
    videoPlayer.appendChild(overlay);
    restoreOverlayState(overlay);

    // Initialize chat when overlay is first created
    initializeChat(overlay);

    // Observe video player resize to constrain overlay position
    // This handles theater mode switches, window resize, etc.
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    resizeObserver = new ResizeObserver(() => {
      constrainOverlayToParent();
    });
    resizeObserver.observe(videoPlayer);

    // Show overlay immediately (newly created, so show it)
    overlay.classList.remove('chatover-hidden');

    // Connect to chat
    connectChat();

    // Save visibility state
    browser.storage.sync.set({ visible: true });
    return;
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
async function initializeChat(overlay) {
  const messagesContainer = overlay.querySelector('.chatover-messages');

  // Load and apply settings
  await loadSettings();
  applySettingsToOverlay(overlay);

  // Create message renderer (uses default max messages of 50)
  messageRenderer = new MessageRenderer(messagesContainer);

  // Set up input handling
  const input = overlay.querySelector('.chatover-input');
  setupInputHandler(input);

  // Update connection status indicator
  updateConnectionStatus(overlay, ConnectionState.DISCONNECTED);

  // Listen for settings changes
  settingsChangeListener = (key, value) => {
    handleSettingsChange(overlay, key, value);
  };
  addChangeListener(settingsChangeListener);
}

/**
 * Connect to live chat
 */
async function connectChat() {
  const videoId = getVideoId();
  if (!videoId) {
    return;
  }

  const overlay = document.getElementById('chatover-overlay');
  if (!overlay) return;

  // Prevent double connection
  if (chatConnected) return;

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

      // Remove loading placeholder now that we're connected
      const placeholder = overlay.querySelector('.chatover-placeholder');
      if (placeholder) {
        placeholder.remove();
      }
    } else if (state === ConnectionState.ERROR || state === ConnectionState.ENDED) {
      chatConnected = false;
      disableInput(overlay);
    }
  });

  chatManager.on('error', (error) => {
    console.error('ChatOver: Chat error:', error);
    if (messageRenderer) {
      // Check for specific error codes
      if (error.code === 'NO_LIVE_CHAT') {
        // Stream is offline or doesn't have live chat - don't retry
        // Remove loading placeholder (spinner and "Connecting to chat..." text)
        const placeholder = overlay.querySelector('.chatover-placeholder');
        if (placeholder) {
          placeholder.remove();
        }
        messageRenderer.showStatus('Live chat not available', 'error');
        // Update input placeholder
        const input = overlay.querySelector('.chatover-input');
        if (input) {
          input.placeholder = 'Live chat not available';
        }
        // Update status indicator
        const statusIndicator = overlay.querySelector('.chatover-status-indicator');
        if (statusIndicator) {
          statusIndicator.title = 'Live chat not available';
        }
      } else {
        // Other connection errors - show retry message
        messageRenderer.showStatus('Chat connection error. Retrying...', 'error');
      }
    }
  });

  // Connect to chat
  updateConnectionStatus(overlay, ConnectionState.CONNECTING);
  await chatManager.connect(videoId);
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

  const MAX_MESSAGE_LENGTH = 200;

  // Get progress bar element
  const progressBar = input.parentElement?.querySelector('.chatover-input-progress-bar');

  // Update progress bar based on input length
  const updateProgressBar = () => {
    if (!progressBar) return;

    const length = input.value.length;
    const percentage = Math.min((length / MAX_MESSAGE_LENGTH) * 100, 100);

    progressBar.style.width = `${percentage}%`;

    // Update color based on percentage
    progressBar.classList.remove('warning', 'danger');
    if (percentage >= 95) {
      progressBar.classList.add('danger');
    } else if (percentage >= 80) {
      progressBar.classList.add('warning');
    }
  };

  // Listen for input changes
  input.addEventListener('input', updateProgressBar);

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = input.value.trim();

      if (text) {
        // Use ChatManager to send via youtubei.js
        const chatManager = getChatManager();
        const result = await chatManager.sendMessage(text);

        if (result.success) {
          input.value = '';
          updateProgressBar(); // Reset progress bar
        } else {
          console.error('ChatOver: Failed to send message:', result.error);

          // Show specific error message based on error type
          if (result.error === 'not_signed_in') {
            if (messageRenderer) {
              messageRenderer.showStatus('Cannot send: Sign in to YouTube to chat', 'error');
            }
          } else if (result.error === 'restricted') {
            if (messageRenderer) {
              messageRenderer.showStatus('Cannot send: Please wait or check chat restrictions', 'error');
            }
          } else if (result.error === 'not_connected') {
            if (messageRenderer) {
              messageRenderer.showStatus('Cannot send: Chat not connected', 'error');
            }
          }

          // Show visual error on input
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
 * Stop keyboard and scroll events from bubbling to YouTube player
 * This prevents YouTube shortcuts (k, j, l, m, f, etc.) from triggering
 * when the overlay has focus, and prevents page scroll when scrolling in overlay
 */
function stopEventCapture(element) {
  const preventPropagation = (e) => {
    e.stopPropagation();
  };

  // Keyboard events
  element.addEventListener('keydown', preventPropagation);
  element.addEventListener('keyup', preventPropagation);
  element.addEventListener('keypress', preventPropagation);

  // Scroll/wheel events - prevent page scrolling when scrolling inside overlay
  element.addEventListener('wheel', preventPropagation, { passive: true });
  element.addEventListener('mousewheel', preventPropagation, { passive: true });
  element.addEventListener('DOMMouseScroll', preventPropagation, { passive: true });
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
                <div class="chatover-loading-spinner"></div>
                <div class="chatover-loading-text">Connecting to chat...</div>
            </div>
        </div>
        <div class="chatover-input-container">
            <input type="text" class="chatover-input" placeholder="Connecting..." disabled maxlength="200" />
            <div class="chatover-input-progress"><div class="chatover-input-progress-bar"></div></div>
        </div>
        <div class="chatover-resize"></div>
    `;

  // Add event listeners
  const settingsBtn = overlay.querySelector('.chatover-settings-btn');
  settingsBtn.addEventListener('click', () => openSettings());

  // Make overlay draggable and resizable
  makeDraggable(overlay);
  makeResizable(overlay);

  // Prevent YouTube keyboard shortcuts and page scroll when overlay is focused
  stopEventCapture(overlay);

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
    // Don't drag if clicking on selectable text (check if selection is enabled via class)
    const overlay = e.target.closest('.chatover-overlay');
    if (overlay) {
      // Message text selection
      if (overlay.classList.contains('chatover-selectable-messages') &&
        e.target.closest('.chatover-message-text-inner')) return;
      // Username selection
      if (overlay.classList.contains('chatover-selectable-usernames') &&
        e.target.closest('.chatover-message-author-inner')) return;
    }

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    // Get current position relative to parent
    initialX = element.offsetLeft;
    initialY = element.offsetTop;

    element.style.cursor = 'grabbing';
    e.preventDefault();
  });

  // Remove old handlers if they exist (prevents duplicates)
  if (dragMoveHandler) document.removeEventListener('mousemove', dragMoveHandler);
  if (dragUpHandler) document.removeEventListener('mouseup', dragUpHandler);

  // Create and store handlers for later cleanup
  dragMoveHandler = (e) => {
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
  };

  dragUpHandler = () => {
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
  };

  document.addEventListener('mousemove', dragMoveHandler);
  document.addEventListener('mouseup', dragUpHandler);
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

  // Remove old handlers if they exist (prevents duplicates)
  if (resizeMoveHandler) document.removeEventListener('mousemove', resizeMoveHandler);
  if (resizeUpHandler) document.removeEventListener('mouseup', resizeUpHandler);

  // Create and store handlers for later cleanup
  resizeMoveHandler = (e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Apply new size with minimum constraints
    const newWidth = Math.max(MIN_WIDTH, startWidth + deltaX);
    const newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);

    element.style.width = `${newWidth}px`;
    element.style.height = `${newHeight}px`;
  };

  resizeUpHandler = () => {
    if (isResizing) {
      isResizing = false;

      // Save size
      browser.storage.sync.set({
        size: { width: element.offsetWidth, height: element.offsetHeight }
      });
    }
  };

  document.addEventListener('mousemove', resizeMoveHandler);
  document.addEventListener('mouseup', resizeUpHandler);
}

/**
 * Open settings panel
 */
function openSettings() {
  // Get video player to position panel
  const videoPlayer = findElement(VIDEO_SELECTORS);
  if (!videoPlayer) {
    console.error('ChatOver: Cannot open settings - video player not found');
    return;
  }

  // Close existing panel if open
  if (settingsPanel && settingsPanel.isOpen) {
    settingsPanel.close();
    return;
  }

  // Create and open settings panel
  settingsPanel = new SettingsPanel(videoPlayer);
  settingsPanel.open(() => {
    // Callback when panel is closed
    settingsPanel = null;
  });
}

/**
 * Handle settings changes in real-time
 * @param {HTMLElement} overlay - The overlay element
 * @param {string} key - The changed setting key
 * @param {*} value - The new value
 */
function handleSettingsChange(overlay, key, value) {
  if (!overlay) return;

  // Apply all settings to overlay
  applySettingsToOverlay(overlay);

  // Handle reset specifically
  if (key === 'reset') {
    // On reset, re-apply all settings
    applySettingsToOverlay(overlay);
  }
}

/**
 * Constrain overlay position to stay within parent bounds
 * Called on fullscreen changes, theater mode switches, and any container resize
 */
function constrainOverlayToParent() {
  const overlay = document.getElementById('chatover-overlay');
  if (!overlay) return;

  const parent = overlay.parentElement;
  if (!parent) return;

  const parentWidth = parent.offsetWidth;
  const parentHeight = parent.offsetHeight;
  const overlayWidth = overlay.offsetWidth;
  const overlayHeight = overlay.offsetHeight;

  // Calculate maximum positions
  const maxX = Math.max(0, parentWidth - overlayWidth);
  const maxY = Math.max(0, parentHeight - overlayHeight);

  // Get current position
  const currentX = overlay.offsetLeft;
  const currentY = overlay.offsetTop;

  // Constrain to bounds
  const newX = Math.max(0, Math.min(currentX, maxX));
  const newY = Math.max(0, Math.min(currentY, maxY));

  // Only update if position changed
  if (newX !== currentX || newY !== currentY) {
    overlay.style.left = `${newX}px`;
    overlay.style.top = `${newY}px`;
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';

    // Update saved position
    browser.storage.sync.set({ position: { x: newX, y: newY } });
  }
}

/**
 * Cleanup overlay and button
 */
function cleanup() {
  // Clear any pending init timer
  if (initTimer) {
    clearTimeout(initTimer);
    initTimer = null;
  }

  // Invalidate current init session
  currentInitToken = null;

  const overlay = document.getElementById('chatover-overlay');
  const button = document.getElementById('chatover-toggle-btn');

  // Reset ChatManager singleton (fully releases all resources including listeners)
  resetChatManager();

  // Disconnect resize observer
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // Remove document-level event listeners (prevent memory leaks)
  if (dragMoveHandler) {
    document.removeEventListener('mousemove', dragMoveHandler);
    dragMoveHandler = null;
  }
  if (dragUpHandler) {
    document.removeEventListener('mouseup', dragUpHandler);
    dragUpHandler = null;
  }
  if (resizeMoveHandler) {
    document.removeEventListener('mousemove', resizeMoveHandler);
    resizeMoveHandler = null;
  }
  if (resizeUpHandler) {
    document.removeEventListener('mouseup', resizeUpHandler);
    resizeUpHandler = null;
  }

  // Clear message renderer properly (removes scroll listener)
  if (messageRenderer) {
    messageRenderer.destroy();
    messageRenderer = null;
  }

  // Close settings panel if open
  if (settingsPanel) {
    settingsPanel.destroy();
    settingsPanel = null;
  }

  // Remove settings change listener
  if (settingsChangeListener) {
    removeChangeListener(settingsChangeListener);
    settingsChangeListener = null;
  }

  // Reset MessageSender singleton (clears stale iframe references)
  resetMessageSender();

  if (overlay) overlay.remove();
  if (button) button.remove();

  isInitialized = false;
  isInitializing = false;
  chatConnected = false;
}

/**
 * Initialize ChatOver
 */
async function init() {
  // Generate a unique token for this session
  const thisInitToken = Date.now() + Math.random();
  currentInitToken = thisInitToken;

  // Prevent double initialization
  if (isInitialized || isInitializing) return;

  isInitializing = true;

  // Wait for YouTube to fully load
  try {
    await waitForElement('#content', 10000);
  } catch (e) {
    isInitializing = false;
    return;
  }

  // Check if validation token is still valid (i.e., cleanup wasn't called)
  if (currentInitToken !== thisInitToken) {
    isInitializing = false;
    return;
  }

  // Check if we're on a watch page
  if (!isWatchPage()) {
    isInitializing = false;
    return;
  }

  // Wait for live stream indicators (handles async YouTube player loading)
  const isLive = await waitForLiveStreamIndicator(15000);

  // Check token again after async wait
  if (currentInitToken !== thisInitToken) {
    isInitializing = false;
    return;
  }

  if (!isLive) {
    isInitializing = false;
    return;
  }

  console.log('ChatOver: Initialized for live stream');
  isInitialized = true;
  isInitializing = false;

  // Insert toggle button (with retry for dynamic loading)
  const insertButton = () => {
    // Token check again for delayed execution
    if (currentInitToken !== thisInitToken) return;

    if (!insertToggleButton()) {
      setTimeout(insertButton, 1000);
    }
  };
  insertButton();

  // Load saved settings and restore state
  const settings = await browser.storage.sync.get(['visible']);

  // Final token check
  if (currentInitToken !== thisInitToken) {
    return;
  }

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
document.addEventListener('fullscreenchange', constrainOverlayToParent);
document.addEventListener('webkitfullscreenchange', constrainOverlayToParent);

// Listen for YouTube SPA navigation
window.addEventListener('yt-navigate-finish', () => {
  cleanup();
  if (initTimer) clearTimeout(initTimer);
  initTimer = setTimeout(init, 500);
});

// Also handle popstate for browser back/forward
window.addEventListener('popstate', () => {
  cleanup();
  if (initTimer) clearTimeout(initTimer);
  initTimer = setTimeout(init, 500);
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (initTimer) clearTimeout(initTimer);
    initTimer = setTimeout(init, 500);
  });
} else {
  // If we inject after load, run init
  if (initTimer) clearTimeout(initTimer);
  initTimer = setTimeout(init, 500);
}
