/**
 * MessageRenderer - Renders chat messages to the DOM
 */

import { MessageType } from './MessageParser.js';

/**
 * Default maximum number of messages to display
 */
const DEFAULT_MAX_MESSAGES = 50;

/**
 * MessageRenderer handles rendering parsed messages to the overlay
 */
export class MessageRenderer {
    /**
     * @param {HTMLElement} container - The messages container element
     * @param {object} options - Rendering options
     */
    constructor(container, options = {}) {
        this.container = container;
        this.maxMessages = options.maxMessages || DEFAULT_MAX_MESSAGES;
        this.messages = [];
        this.autoScroll = true;
        this._scrollHandler = null;

        // Track scroll position for auto-scroll behavior
        this._setupScrollTracking();
    }

    /**
     * Destroy the renderer and clean up event listeners
     */
    destroy() {
        if (this._scrollHandler && this.container) {
            this.container.removeEventListener('scroll', this._scrollHandler);
            this._scrollHandler = null;
        }
        this.clear();
        this.container = null;
    }

    /**
     * Add a message to the display
     * @param {object} message - Normalized message object from MessageParser
     */
    addMessage(message) {
        // Create message element
        const messageEl = this._createMessageElement(message);

        // Add to DOM
        this.container.appendChild(messageEl);
        this.messages.push({ id: message.id, element: messageEl });

        // Remove old messages if exceeding max
        this._enforceMaxMessages();

        // Auto-scroll if enabled
        if (this.autoScroll) {
            this._scrollToBottom();
        }
    }

    /**
     * Clear all messages
     */
    clear() {
        this.container.innerHTML = '';
        this.messages = [];
    }

    /**
     * Update max messages setting
     * @param {number} max - New maximum message count
     */
    setMaxMessages(max) {
        this.maxMessages = max;
        this._enforceMaxMessages();
    }

    /**
     * Show a status message (e.g., connecting, error)
     * @param {string} text - Status message text
     * @param {string} type - Status type (info, error, success)
     */
    showStatus(text, type = 'info') {
        // Remove existing status message
        const existing = this.container.querySelector('.chatover-status');
        if (existing) existing.remove();

        const statusEl = document.createElement('div');
        statusEl.className = `chatover-status chatover-status-${type}`;
        statusEl.textContent = text;

        this.container.appendChild(statusEl);
    }

    /**
     * Remove status message
     */
    clearStatus() {
        const existing = this.container.querySelector('.chatover-status');
        if (existing) existing.remove();
    }

    /**
     * Create a message element
     * @private
     */
    _createMessageElement(message) {
        const el = document.createElement('div');
        el.className = 'chatover-message';
        el.dataset.messageId = message.id;

        // Add type-specific class
        if (message.type === MessageType.PAID) {
            el.classList.add('chatover-message-paid');
            if (message.paidInfo?.color) {
                el.style.borderLeftColor = message.paidInfo.color;
            }
        } else if (message.type === MessageType.MEMBERSHIP) {
            el.classList.add('chatover-message-membership');
        } else if (message.type === MessageType.GIFT_PURCHASE) {
            el.classList.add('chatover-message-gift');
            el.classList.add('chatover-message-gift-purchase');
        } else if (message.type === MessageType.GIFT_REDEMPTION) {
            el.classList.add('chatover-message-gift');
            el.classList.add('chatover-message-gift-redemption');
        }

        // Build membership info HTML if present
        let membershipInfoHtml = '';
        if (message.type === MessageType.MEMBERSHIP && message.membershipInfo) {
            const duration = this._escapeHtml(message.membershipInfo.duration);
            const level = message.membershipInfo.level ? this._escapeHtml(message.membershipInfo.level) : '';
            membershipInfoHtml = `
                <div class="chatover-membership-info">
                    <span class="chatover-membership-duration">${duration}</span>
                    ${level ? `<span class="chatover-membership-level">${level}</span>` : ''}
                </div>
            `;
        }

        // Render user message if available (for membership, check if there's actual content)
        const hasMessageContent = message.message &&
            (message.message.text || (message.message.runs && message.message.runs.length > 0));
        const messageTextHtml = hasMessageContent
            ? `<div class="chatover-message-text">${this._renderMessageContent(message.message)}</div>`
            : '';

        // Build reply target HTML if present
        const replyToHtml = message.replyTo
            ? `<span class="chatover-reply-target" title="Replying to ${this._escapeHtml(message.replyTo.username)}">
                <span class="chatover-reply-icon">↩</span>
                <span class="chatover-reply-username">${this._escapeHtml(message.replyTo.username)}</span>
               </span>`
            : '';

        // Build message HTML
        el.innerHTML = `
            <img class="chatover-message-avatar" 
                 src="${this._escapeHtml(message.author.avatarUrl)}" 
                 alt="${this._escapeHtml(message.author.name)}"
                 onerror="this.style.display='none'" />
            <div class="chatover-message-content">
                <div class="chatover-message-header">
                    <span class="chatover-message-author ${this._getAuthorClass(message.author)}">
                        ${this._escapeHtml(message.author.name)}
                    </span>
                    ${this._renderBadges(message.badges)}
                    ${replyToHtml}
                    ${message.paidInfo ? `<span class="chatover-message-amount">${this._escapeHtml(message.paidInfo.amount)}</span>` : ''}
                </div>
                ${membershipInfoHtml}
                ${messageTextHtml}
            </div>
        `;


        return el;
    }

    /**
     * Render badges HTML
     * @private
     */
    _renderBadges(badges) {
        if (!badges || badges.length === 0) return '';

        return `<div class="chatover-message-badges">
            ${badges.map(badge => {
            if (badge.url) {
                // Custom badge with image
                return `<img class="chatover-message-badge" 
                                 src="${this._escapeHtml(badge.url)}" 
                                 alt="${this._escapeHtml(badge.label)}" 
                                 title="${this._escapeHtml(badge.label)}" />`;
            } else {
                // Icon badge
                return `<span class="chatover-message-badge chatover-badge-${badge.type}" 
                                  title="${this._escapeHtml(badge.label)}">${badge.icon}</span>`;
            }
        }).join('')}
        </div>`;
    }

    /**
     * Render message content with emotes
     * @private
     */
    _renderMessageContent(message) {
        if (!message.runs || message.runs.length === 0) {
            return this._escapeHtml(message.text);
        }

        return message.runs.map(run => {
            if (run.type === 'emote') {
                // If URL exists, show image; otherwise show text
                if (run.url) {
                    return `<img class="chatover-emote" 
                                 src="${this._escapeHtml(run.url)}" 
                                 alt="${this._escapeHtml(run.alt)}" 
                                 title="${this._escapeHtml(run.alt)}"
                                 onerror="this.outerHTML='${this._escapeHtml(run.text)}'" />`;
                } else {
                    // No URL, show text representation
                    return this._escapeHtml(run.text);
                }
            } else if (run.type === 'sticker' && run.url) {
                return `<img class="chatover-sticker" 
                             src="${this._escapeHtml(run.url)}" 
                             alt="${this._escapeHtml(run.alt)}" />`;
            } else {
                return this._escapeHtml(run.text);
            }
        }).join('');
    }

    /**
     * Get author class for styling
     * Priority: Owner > Moderator > Member > Verified
     * Only the highest priority role is applied to avoid color conflicts
     * @private
     */
    _getAuthorClass(author) {
        // Apply only the highest priority role
        if (author.isOwner) return 'chatover-author-owner';
        if (author.isModerator) return 'chatover-author-mod';
        if (author.isMember) return 'chatover-author-member';
        if (author.isVerified) return 'chatover-author-verified';
        return '';
    }

    /**
     * Enforce max message limit
     * @private
     */
    _enforceMaxMessages() {
        while (this.messages.length > this.maxMessages) {
            const oldest = this.messages.shift();
            if (oldest && oldest.element.parentNode) {
                oldest.element.remove();
            }
        }
    }

    /**
     * Set up scroll tracking for auto-scroll
     * @private
     */
    _setupScrollTracking() {
        this._scrollHandler = () => {
            // Check if user scrolled up (disable auto-scroll)
            const isNearBottom = this.container.scrollHeight - this.container.scrollTop - this.container.clientHeight < 50;
            this.autoScroll = isNearBottom;
        };
        this.container.addEventListener('scroll', this._scrollHandler);
    }

    /**
     * Scroll to bottom of messages
     * @private
     */
    _scrollToBottom() {
        this.container.scrollTop = this.container.scrollHeight;
    }

    /**
     * Escape HTML to prevent XSS
     * @private
     */
    _escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
