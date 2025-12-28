/**
 * ChatManager - Core chat connection and message handling
 * Uses youtubei.js to receive live chat messages from YouTube
 */

import { Innertube } from 'youtubei.js/web';
import { MessageParser } from './MessageParser.js';

/**
 * Connection states for the chat manager
 */
export const ConnectionState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    ERROR: 'error',
    ENDED: 'ended'
};

/**
 * ChatManager handles the connection to YouTube live chat
 * and emits parsed messages to subscribers
 */
export class ChatManager {
    constructor() {
        this.innertube = null;
        this.livechat = null;
        this.videoId = null;
        this.connectionState = ConnectionState.DISCONNECTED;
        this.listeners = {
            message: [],
            state: [],
            error: [],
            metadata: []
        };
        this.parser = new MessageParser();
    }

    /**
     * Connect to a live chat for the given video ID
     * @param {string} videoId - YouTube video ID
     */
    async connect(videoId) {
        if (this.livechat) {
            this.disconnect();
        }

        this.videoId = videoId;
        this._setState(ConnectionState.CONNECTING);

        try {
            // Initialize Innertube if not already done
            if (!this.innertube) {
                // In browser extensions, fetch loses its window context
                // We need to pass a bound fetch function to avoid "Illegal invocation" error
                const customFetch = (input, init) => {
                    // Ensure cookies are sent
                    const newInit = { ...init, credentials: 'include' };
                    return window.fetch(input, newInit);
                };

                this.innertube = await Innertube.create({
                    retrieve_player: false,
                    generate_session_locally: true,
                    fetch: customFetch,
                    cookie: document.cookie // Explicitly pass cookies so it can generate auth headers
                });
            }

            // Get video info to access live chat
            const info = await this.innertube.getInfo(videoId);

            // Check if this is a live stream with chat
            if (!info.livechat) {
                throw new Error('This video does not have live chat available');
            }

            // Get the live chat instance
            this.livechat = info.getLiveChat();

            // Set up event listeners
            this._setupLiveChatListeners();

            // Start receiving messages
            this.livechat.start();

            this._setState(ConnectionState.CONNECTED);
            console.log('ChatOver: Connected to live chat for video', videoId);

        } catch (error) {
            console.error('ChatOver: Failed to connect to live chat:', error);
            this._setState(ConnectionState.ERROR);
            this._emit('error', error);
        }
    }

    /**
     * Disconnect from the current live chat
     */
    disconnect() {
        if (this.livechat) {
            this.livechat.stop();
            this.livechat = null;
        }
        this.videoId = null;
        this._setState(ConnectionState.DISCONNECTED);
        console.log('ChatOver: Disconnected from live chat');
    }

    /**
     * Send a message to the live chat via youtubei.js
     * @param {string} text - Message text to send
     * @returns {Promise<boolean>} True if message was sent successfully
     */
    async sendMessage(text) {
        if (!text || !text.trim()) {
            return false;
        }

        if (!this.livechat || this.connectionState !== ConnectionState.CONNECTED) {
            console.log('ChatOver: Cannot send message - not connected to chat');
            return false;
        }

        try {
            // Use youtubei.js LiveChat sendMessage method
            await this.livechat.sendMessage(text.trim());
            console.log('ChatOver: Message sent via youtubei.js');
            return true;
        } catch (error) {
            console.error('ChatOver: Failed to send message:', error);
            this._emit('error', error);
            return false;
        }
    }

    /**
     * Subscribe to events
     * @param {'message' | 'state' | 'error' | 'metadata'} event - Event type
     * @param {Function} callback - Callback function
     */
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    /**
     * Unsubscribe from events
     * @param {'message' | 'state' | 'error' | 'metadata'} event - Event type
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    /**
     * Get current connection state
     */
    getState() {
        return this.connectionState;
    }

    /**
     * Set up listeners for the live chat instance
     * @private
     */
    _setupLiveChatListeners() {
        // Handle initial chat data (pinned messages, viewer info)
        this.livechat.on('start', (initialData) => {
            console.log('ChatOver: Live chat started', initialData.viewer_name || 'Guest');
        });

        // Handle new chat messages/actions
        this.livechat.on('chat-update', (action) => {
            this._handleChatAction(action);
        });

        // Handle metadata updates (views, likes)
        this.livechat.on('metadata-update', (metadata) => {
            this._emit('metadata', metadata);
        });

        // Handle errors
        this.livechat.on('error', (error) => {
            console.error('ChatOver: Live chat error:', error);

            // Handle transient network errors (like Failed to fetch)
            if (error && (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError'))) {
                console.log('ChatOver: Transient network error, attempting to resume chat...');

                // Don't change state to ERROR, keep it as CONNECTED but maybe show a warning?
                // We'll just try to restart the polling if it stopped
                setTimeout(() => {
                    if (this.connectionState !== ConnectionState.DISCONNECTED) {
                        try {
                            this.livechat.start();
                        } catch (e) {
                            console.error('ChatOver: Failed to restart chat:', e);
                        }
                    }
                }, 2000);
                return;
            }

            this._setState(ConnectionState.ERROR);
            this._emit('error', error);
        });

        // Handle stream end
        this.livechat.on('end', () => {
            console.log('ChatOver: Live stream ended');
            this._setState(ConnectionState.ENDED);
        });
    }

    /**
     * Handle a chat action from youtubei.js
     * @private
     */
    _handleChatAction(action) {
        // Parse the action into our normalized message format
        const message = this.parser.parseAction(action);

        if (message) {
            this._emit('message', message);
        }
    }

    /**
     * Update connection state and notify listeners
     * @private
     */
    _setState(state) {
        this.connectionState = state;
        this._emit('state', state);
    }

    /**
     * Emit an event to all subscribers
     * @private
     */
    _emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`ChatOver: Error in ${event} listener:`, error);
                }
            });
        }
    }
}

// Singleton instance for the extension
let chatManagerInstance = null;

/**
 * Get the singleton ChatManager instance
 */
export function getChatManager() {
    if (!chatManagerInstance) {
        chatManagerInstance = new ChatManager();
    }
    return chatManagerInstance;
}
