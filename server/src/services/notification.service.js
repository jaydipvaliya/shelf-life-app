const { Expo } = require('expo-server-sdk');
const User = require('../models/User');

const expo = new Expo();

/**
 * Send push notifications to one or multiple Expo push tokens
 * Automatically purges DeviceNotRegistered tokens from User records.
 * @param {Array<{ to: string, title: string, body: string, data?: object }>} messages
 */
const sendPushNotifications = async (messages) => {
  const validMessages = [];

  for (const message of messages) {
    if (!Expo.isExpoPushToken(message.to)) {
      console.warn(`[NotificationService] Invalid Expo push token: ${message.to}`);
      continue;
    }

    validMessages.push({
      to: message.to,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data || {},
      badge: message.badge || 1,
      priority: 'high',
      channelId: 'expiry-alerts',
    });
  }

  if (validMessages.length === 0) {
    return { sent: 0, tickets: [] };
  }

  const chunks = expo.chunkPushNotifications(validMessages);
  const tickets = [];
  const deadTokens = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      ticketChunk.forEach((ticket, idx) => {
        tickets.push(ticket);
        if (
          ticket?.status === 'error' &&
          ticket?.details?.error === 'DeviceNotRegistered' &&
          chunk[idx]?.to
        ) {
          deadTokens.push(chunk[idx].to);
        }
      });
    } catch (error) {
      console.error('[NotificationService] Error sending push notification chunk:', error);
    }
  }

  if (deadTokens.length > 0) {
    try {
      await User.updateMany(
        { expoPushToken: { $in: deadTokens } },
        { $set: { expoPushToken: null } }
      );
      console.log(`[NotificationService] Cleared ${deadTokens.length} unregistered push token(s)`);
    } catch (err) {
      console.warn('[NotificationService] Failed to clear unregistered push tokens:', err.message);
    }
  }

  console.log(`[NotificationService] Sent ${validMessages.length} push notification(s)`);
  return { sent: validMessages.length, tickets };
};

/**
 * Send an individual expiry reminder to a user
 */
const sendExpiryAlert = async (user, expiringItems) => {
  if (!user.expoPushToken) {
    return null;
  }

  const count = expiringItems.length;
  const itemNames = expiringItems.slice(0, 2).map((i) => i.name).join(', ');
  const more = count > 2 ? ` and ${count - 2} more` : '';

  const title = '⚠️ Shelf Life Expiry Alert';
  const body =
    count === 1
      ? `"${expiringItems[0].name}" is expiring soon! Use it before it goes to waste.`
      : `${count} items (${itemNames}${more}) are expiring soon! Check your kitchen.`;

  return sendPushNotifications([
    {
      to: user.expoPushToken,
      title,
      body,
      data: {
        type: 'EXPIRY_ALERT',
        itemIds: expiringItems.map((i) => i._id),
      },
    },
  ]);
};

module.exports = {
  sendPushNotifications,
  sendExpiryAlert,
};
