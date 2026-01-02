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
    GIFT_PURCHASE: 'gift_purchase',
    GIFT_REDEMPTION: 'gift_redemption',
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

            case 'LiveChatSponsorshipsGiftPurchaseAnnouncement':
                return this._parseGiftPurchaseMessage(item);

            case 'LiveChatSponsorshipsGiftRedemptionAnnouncement':
                return this._parseGiftRedemptionMessage(item);

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
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
            replyTo: this._parseReplyTarget(item)
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
        // youtubei.js LiveChatPaidSticker has sticker as Thumbnail[] directly, not { thumbnails: [] }
        // Also try the nested structure as fallback for compatibility
        const stickerUrl = item.sticker?.[0]?.url ||
            item.sticker?.thumbnails?.[0]?.url ||
            '';

        // Get sticker accessibility label for alt text (e.g., "YOU ARE AMAZING")
        const stickerAlt = item.sticker_accessibility_label || 'Super Sticker';

        // Get background color - convert to hex if it's a number
        let bgColor = '#1565C0'; // Default blue
        if (typeof item.background_color === 'number') {
            bgColor = '#' + (item.background_color >>> 0).toString(16).padStart(6, '0');
        }

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
                    alt: stickerAlt
                }]
            },
            timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
            paidInfo: {
                amount: item.purchase_amount?.toString() || '',
                color: bgColor
            }
        };
    }

    /**
     * Parse a membership message
     * @private
     * 
     * YouTube LiveChatMembershipItem structure:
     * - header_primary_text: Duration like "Member for 3 months" or "New member"
     * - header_subtext: Membership tier/level like "Bronze Member"
     * - message: Optional user message
     */
    _parseMembershipMessage(item) {
        // Get duration text (e.g., "Member for 3 months" or "New member")
        const durationText = item.header_primary_text?.toString() || 'New member';

        // Get membership tier/level (e.g., "Bronze Member")
        const membershipLevel = item.header_subtext?.toString() || '';

        // Get optional user message
        const userMessage = this._parseMessageContent(item.message);

        return {
            id: item.id || this._generateId(),
            type: MessageType.MEMBERSHIP,
            author: this._parseAuthor(item.author),
            badges: this._parseBadges(item.author),
            message: userMessage,
            timestamp: new Date(),
            membershipInfo: {
                duration: durationText,
                level: membershipLevel
            }
        };
    }

    /**
     * Parse a membership gift purchase announcement (someone gifted memberships)
     * @private
     */
    _parseGiftPurchaseMessage(item) {
        // Extract header info - contains info about who gifted and how many
        const headerText = item.header?.primary_text?.toString() ||
            item.primary_text?.toString() ||
            'Gifted memberships!';

        // LiveChatSponsorshipsGiftPurchaseAnnouncement has a different structure:
        // - header.author_name (Text object)
        // - header.author_photo (array of Thumbnails)
        // - header.author_badges (array of badges)
        // We need to construct an author-like object from these
        const header = item.header;
        let authorData = null;

        if (header) {
            // Construct author-like object from header properties
            authorData = {
                name: header.author_name,
                thumbnails: header.author_photo || [],
                badges: header.author_badges || [],
                id: item.author_external_channel_id || '',
                is_owner: false,
                is_moderator: false,
                is_member: true, // Gift purchasers are typically members
                is_verified: false
            };
        }

        return {
            id: item.id || this._generateId(),
            type: MessageType.GIFT_PURCHASE,
            author: this._parseAuthor(authorData || item.author),
            badges: this._parseBadges(authorData || item.author),
            message: {
                text: headerText,
                runs: []
            },
            timestamp: new Date(),
            giftInfo: {
                isGift: true,
                type: 'purchase'
            }
        };
    }

    /**
     * Parse a membership gift redemption announcement (someone received a gifted membership)
     * @private
     */
    _parseGiftRedemptionMessage(item) {
        const messageText = item.message?.toString() ||
            item.primary_text?.toString() ||
            'Received a gifted membership!';

        return {
            id: item.id || this._generateId(),
            type: MessageType.GIFT_REDEMPTION,
            author: this._parseAuthor(item.author),
            badges: this._parseBadges(item.author),
            message: {
                text: messageText,
                runs: []
            },
            timestamp: new Date(),
            giftInfo: {
                isGift: true,
                type: 'redemption'
            }
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

        // Get avatar URL - check multiple possible formats
        // Regular messages: author.thumbnails[0].url
        // Gift purchase messages: author.thumbnails (which is author_photo) could be Thumbnail[] with .url
        let avatarUrl = '';
        if (author.thumbnails && author.thumbnails.length > 0) {
            const thumb = author.thumbnails[0];
            avatarUrl = thumb?.url || thumb || '';
        }

        return {
            name: author.name?.toString() || 'Unknown',
            channelId: author.id || '',
            avatarUrl: avatarUrl,
            isModerator: author.is_moderator || false,
            isMember: this._isMember(author),
            isOwner: author.is_owner || false,
            isVerified: this._isVerified(author)
        };
    }

    /**
     * Check if author is a member (checking both flag and badges)
     * @private
     */
    _isMember(author) {
        if (author.is_member) return true;

        // Fallback: Check badges for "Member" tooltip
        if (author.badges) {
            for (const badge of author.badges) {
                const tooltip = badge.tooltip || '';
                if (tooltip.includes('Member') || tooltip.includes('member')) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check if author is verified (checking both flag and badges)
     * @private
     */
    _isVerified(author) {
        if (author.is_verified) return true;

        // Fallback: Check badges for "Verified" tooltip or checkmark
        if (author.badges) {
            for (const badge of author.badges) {
                const tooltip = badge.tooltip || '';
                if (tooltip.includes('Verified') || tooltip.includes('verified') || tooltip === '✓') {
                    return true;
                }
            }
        }
        return false;
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
                // youtubei.js structure can vary for badges
                // Check multiple possible paths for the image URL
                const badgeUrl = badge.thumbnails?.[0]?.url ||
                    badge.custom_thumbnail?.thumbnails?.[0]?.url ||
                    badge.custom_thumbnail?.[0]?.url ||
                    badge.image?.thumbnails?.[0]?.url ||
                    badge.icon?.thumbnails?.[0]?.url ||
                    badge.thumbnail?.url ||
                    badge.url;

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

        // youtubei.js returns 'N/A' for empty messages, treat it as empty
        const rawText = message.toString();
        const text = rawText === 'N/A' ? '' : rawText;
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

    /**
     * Parse reply target from before_content_buttons
     * YouTube puts reply chips (with @username) in before_content_buttons
     * @private
     */
    _parseReplyTarget(item) {
        // Check if before_content_buttons exists and has items
        if (!item.before_content_buttons || item.before_content_buttons.length === 0) {
            return null;
        }

        // Look for a button with a title that looks like a reply target (@username)
        for (const button of item.before_content_buttons) {
            const title = button.title || button.accessibility_text || '';

            // Check if this looks like a reply target (starts with @ or contains user info)
            if (title && (title.startsWith('@') || title.includes('@'))) {
                return {
                    username: title,
                    // If there's channel info in the button's on_tap endpoint, extract it
                    channelId: button.on_tap?.browse_endpoint?.browse_id || null
                };
            }

            // Also check tooltip for reply info
            const tooltip = button.tooltip || '';
            if (tooltip && (tooltip.startsWith('@') || tooltip.includes('@'))) {
                return {
                    username: tooltip,
                    channelId: button.on_tap?.browse_endpoint?.browse_id || null
                };
            }
        }

        return null;
    }
}
