const cron = require('node-cron');
const User = require('../models/User');
const Item = require('../models/Item');
const { sendExpiryAlert } = require('../services/notification.service');

let isJobRunning = false;

const runExpiryCheck = async () => {
  if (isJobRunning) {
    console.warn('⚠️ [Cron Job] Skipping overlapping expiry check run');
    return { success: false, skipped: true };
  }

  isJobRunning = true;
  console.log('⏰ [Cron Job] Running daily food expiry check...');

  try {
    const usersWithTokens = await User.find({
      expoPushToken: { $exists: true, $ne: null },
      'notificationPreferences.dailyDigestEnabled': true,
    }).select('_id expoPushToken notificationPreferences');

    console.log(`[Cron Job] Checking expiring items for ${usersWithTokens.length} subscribed user(s)`);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let notificationsSent = 0;

    for (const user of usersWithTokens) {
      const reminderDays = user.notificationPreferences?.reminderDaysBefore || [1, 3];
      const maxDays = Math.max(...reminderDays, 3);

      const targetDate = new Date(startOfToday);
      targetDate.setDate(targetDate.getDate() + maxDays);
      targetDate.setHours(23, 59, 59, 999);

      const expiringItems = await Item.find({
        userId: user._id,
        status: 'active',
        expiryDate: {
          $gte: startOfToday,
          $lte: targetDate,
        },
      })
        .sort({ expiryDate: 1 })
        .select('_id name');

      if (expiringItems.length > 0) {
        await sendExpiryAlert(user, expiringItems);
        notificationsSent++;
      }
    }

    console.log(`✅ [Cron Job] Completed: ${notificationsSent} notifications sent`);
    return { success: true, notificationsSent };
  } catch (error) {
    console.error('❌ [Cron Job] Error checking expiring items:', error);
    return { success: false, error: error.message };
  } finally {
    isJobRunning = false;
  }
};

const initExpiryJob = () => {
  // Run every day at 08:00 AM
  cron.schedule('0 8 * * *', () => {
    runExpiryCheck();
  });

  console.log('📅 [Cron Job] Daily 8:00 AM expiry check schedule initialized');
};

module.exports = {
  initExpiryJob,
  runExpiryCheck,
};
