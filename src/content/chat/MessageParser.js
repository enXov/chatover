/**
 * MessageParser - Parse youtubei.js message objects into normalized format
 */

import { YTNodes } from 'youtubei.js/web';

/**
 * Message types that we handle
 */
export const MessageType = {
    TEXT: 'text',
    PAID: 'paid',
    STICKER: 'sticker',
    MEMBERSHIP: 'membership',
    SYSTEM: 'system'
};

/**
 * MessageParser transforms youtubei.js chat actions into our normalized message format
 */
export class MessageParser {
    /**
     * Parse a chat action from youtubei.js
     * @param {object} action - The action object from 'chat-update' event
     * @returns {object|null} Normalized message object or null if not a displayable message
     */
    parseAction(action) {
        // Only handle AddChatItemAction (new messages)
        if (!action.is(YTNodes.AddChatItemAction)) {
            return null;
        }

        const item = action.as(YTNodes.AddChatItemAction).item;
        if (!item) {
            return null;
        }

        // Parse based on message type
        switch (item.type) {
            case 'LiveChatTextMessage':
                return this._parseTextMessage(item.as(YTNodes.LiveChatTextMessage));

            case 'LiveChatPaidMessage':
                return this._parsePaidMessage(item.as(YTNodes.LiveChatPaidMessage));

            case 'LiveChatPaidSticker':
                return this._parseStickerMessage(item.as(YTNodes.LiveChatPaidSticker));

            case 'LiveChatMembershipItem':
                return this._parseMembershipMessage(item.as(YTNodes.LiveChatMembershipItem));

            default:
                // Unsupported message type
                return null;
        }
    }

    /**
     * Parse a regular text message
     * @private
     */
    _parseTextMessage(item) {
        return {
            id: item.id || this._generateId(),
            type: MessageType.TEXT,
            author: this._parseAuthor(item.author),
            badges: this._parseBadges(item.author),
            message: this._parseMessageContent(item.message),
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
        };
    }

    /**
     * Parse a Super Chat (paid message)
     * @private
     */
    _parsePaidMessage(item) {
        return {
            id: item.id || this._generateId(),
            type: MessageType.PAID,
            author: this._parseAuthor(item.author),
            badges: this._parseBadges(item.author),
            message: this._parseMessageContent(item.message),
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
            paidInfo: {
                amount: item.purchase_amount?.toString() || '',
                color: this._getSuperChatColor(item.header_background_color)
            }
        };
    }

    /**
     * Parse a Super Sticker message
     * @private
     */
    _parseStickerMessage(item) {
        const stickerUrl = item.sticker?.thumbnails?.[0]?.url || '';

        return {
            id: item.id || this._generateId(),
            type: MessageType.STICKER,
            author: this._parseAuthor(item.author),
            badges: this._parseBadges(item.author),
            message: {
                text: '',
                runs: [{
                    type: 'sticker',
                    url: stickerUrl,
                    alt: 'Super Sticker'
                }]
            },
            timestamp: new Date(),
            paidInfo: {
                amount: item.purchase_amount?.toString() || '',
                color: '#1565C0'
            }
        };
    }

    /**
     * Parse a membership message
     * @private
     */
    _parseMembershipMessage(item) {
        return {
            id: item.id || this._generateId(),
            type: MessageType.MEMBERSHIP,
            author: this._parseAuthor(item.author),
            badges: this._parseBadges(item.author),
            message: {
                text: item.header_primary_text?.toString() || 'New member!',
                runs: []
            },
            timestamp: new Date()
        };
    }

    /**
     * Parse author information
     * @private
     */
    _parseAuthor(author) {
        if (!author) {
            return {
                name: 'Unknown',
                channelId: '',
                avatarUrl: '',
                isModerator: false,
                isMember: false,
                isOwner: false
            };
        }

        // Get avatar URL (prefer larger size)
        const avatarUrl = author.thumbnails?.[0]?.url || '';

        return {
            name: author.name?.toString() || 'Unknown',
            channelId: author.id || '',
            avatarUrl: avatarUrl,
            isModerator: author.is_moderator || false,
            isMember: author.is_member || false,
            isOwner: author.is_owner || false,
            isVerified: author.is_verified || false
        };
    }

    /**
     * Parse author badges
     * @private
     */
    _parseBadges(author) {
        const badges = [];

        if (!author) return badges;

        // Check for built-in status badges
        if (author.is_owner) {
            badges.push({
                type: 'owner',
                label: 'Owner',
                icon: '👑'
            });
        }

        if (author.is_moderator) {
            badges.push({
                type: 'moderator',
                label: 'Moderator',
                icon: '🔧'
            });
        }

        if (author.is_verified) {
            badges.push({
                type: 'verified',
                label: 'Verified',
                icon: '✓'
            });
        }

        // Parse custom badges (member badges, etc.)
        if (author.badges) {
            for (const badge of author.badges) {
                const badgeUrl = badge.thumbnails?.[0]?.url;
                if (badgeUrl) {
                    badges.push({
                        type: 'custom',
                        label: badge.tooltip || 'Badge',
                        url: badgeUrl
                    });
                }
            }
        }

        return badges;
    }

    /**
     * Parse message content with emotes
     * @private
     */
    _parseMessageContent(message) {
        if (!message) {
            return { text: '', runs: [] };
        }

        const text = message.toString();
        const runs = [];

        // Try to get the runs (text/emote segments)
        if (message.runs) {
            for (const run of message.runs) {
                if (run.emoji) {
                    // This is an emote/emoji
                    // youtubei.js structure: emoji.image.thumbnails[0].url
                    let emojiUrl = '';

                    // Try different paths to get the emoji URL
                    if (run.emoji.image?.thumbnails?.[0]?.url) {
                        emojiUrl = run.emoji.image.thumbnails[0].url;
                    } else if (run.emoji.image?.[0]?.url) {
                        emojiUrl = run.emoji.image[0].url;
                    } else if (Array.isArray(run.emoji.image)) {
                        emojiUrl = run.emoji.image[0]?.url || '';
                    } else if (typeof run.emoji.image === 'object' && run.emoji.image?.url) {
                        emojiUrl = run.emoji.image.url;
                    }

                    // Get emoji shortcut/name
                    const emojiAlt = run.emoji.shortcuts?.[0] ||
                        run.emoji.emoji_id ||
                        run.text ||
                        ':emote:';

                    runs.push({
                        type: 'emote',
                        url: emojiUrl,
                        alt: emojiAlt,
                        text: run.text || emojiAlt
                    });
                } else {
                    // This is regular text
                    runs.push({
                        type: 'text',
                        text: run.text || ''
                    });
                }
            }
        } else {
            // No runs, just plain text
            runs.push({
                type: 'text',
                text: text
            });
        }

        return { text, runs };
    }

    /**
     * Get Super Chat color based on YouTube's color code
     * @private
     */
    _getSuperChatColor(colorCode) {
        // YouTube uses integer color codes, convert to hex
        if (typeof colorCode === 'number') {
            return '#' + (colorCode >>> 0).toString(16).padStart(6, '0');
        }
        return '#1565C0'; // Default blue
    }

    /**
     * Generate a unique ID for messages without one
     * @private
     */
    _generateId() {
        return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}
