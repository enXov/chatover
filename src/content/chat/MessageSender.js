/**
 * MessageSender - Send messages via YouTube's native chat input
 * Uses YouTube's existing authentication context
 */

/**
 * Selectors for YouTube's chat elements
 */
const CHAT_FRAME_SELECTORS = [
    '#chatframe',
    'iframe#chatframe'
];

const CHAT_INPUT_SELECTORS = [
    '#input[contenteditable="true"]',
    'div#input.yt-live-chat-text-input-field-renderer',
    'yt-live-chat-text-input-field-renderer #input'
];

const SEND_BUTTON_SELECTORS = [
    '#send-button button',
    'yt-button-renderer#send-button button',
    '#send-button yt-button-renderer button'
];

/**
 * MessageSender handles sending messages through YouTube's native chat
 */
export class MessageSender {
    constructor() {
        this.chatFrame = null;
        this.chatDocument = null;
        this.isReady = false;
    }

    /**
     * Initialize the sender by finding YouTube's chat elements
     * @returns {boolean} True if initialization successful
     */
    init() {
        try {
            // Find the chat iframe
            this.chatFrame = this._findElement(document, CHAT_FRAME_SELECTORS);

            if (!this.chatFrame) {
                console.log('ChatOver: Chat frame not found');
                return false;
            }

            // Get the iframe's document
            try {
                this.chatDocument = this.chatFrame.contentDocument || this.chatFrame.contentWindow?.document;
            } catch (e) {
                console.log('ChatOver: Cannot access chat frame (cross-origin)');
                return false;
            }

            if (!this.chatDocument) {
                console.log('ChatOver: Chat document not accessible');
                return false;
            }

            this.isReady = true;
            console.log('ChatOver: Message sender initialized');
            return true;

        } catch (error) {
            console.error('ChatOver: Failed to initialize message sender:', error);
            return false;
        }
    }

    /**
     * Send a message to the live chat
     * @param {string} text - Message text to send
     * @returns {Promise<boolean>} True if message was sent
     */
    async send(text) {
        if (!text || !text.trim()) {
            return false;
        }

        // Try to reinitialize if not ready
        if (!this.isReady || !this.chatDocument) {
            this.init();
        }

        if (!this.isReady) {
            console.log('ChatOver: Sender not ready, cannot send message');
            return false;
        }

        try {
            // Find the chat input
            const input = this._findElement(this.chatDocument, CHAT_INPUT_SELECTORS);
            if (!input) {
                console.log('ChatOver: Chat input not found');
                return false;
            }

            // Focus the input
            input.focus();

            // Set the text content
            input.textContent = text.trim();

            // Dispatch input event to trigger YouTube's handlers
            input.dispatchEvent(new Event('input', { bubbles: true }));

            // Small delay for YouTube to process
            await this._delay(100);

            // Find and click the send button
            const sendButton = this._findElement(this.chatDocument, SEND_BUTTON_SELECTORS);
            if (!sendButton) {
                console.log('ChatOver: Send button not found');
                return false;
            }

            // Click the send button
            sendButton.click();

            console.log('ChatOver: Message sent');
            return true;

        } catch (error) {
            console.error('ChatOver: Failed to send message:', error);
            return false;
        }
    }

    /**
     * Check if the sender is ready to send messages
     * @returns {boolean}
     */
    ready() {
        return this.isReady;
    }

    /**
     * Find an element using multiple selectors
     * @private
     */
    _findElement(doc, selectors) {
        for (const selector of selectors) {
            try {
                const element = doc.querySelector(selector);
                if (element) return element;
            } catch (e) {
                // Selector might be invalid, try next
            }
        }
        return null;
    }

    /**
     * Simple delay helper
     * @private
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
let senderInstance = null;

/**
 * Get the singleton MessageSender instance
 */
export function getMessageSender() {
    if (!senderInstance) {
        senderInstance = new MessageSender();
    }
    return senderInstance;
}
