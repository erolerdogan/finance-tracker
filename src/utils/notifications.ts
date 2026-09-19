import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestAndScheduleImportReminders() {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted by user.');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('import-reminders', {
        name: 'Import Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    // Clear previous scheduled notifications
    await Notifications.cancelAllScheduledNotificationsAsync();

    const title = 'Time to Import Transactions 📊';
    const body = 'Keep your expense tracker up to date! Tap to upload your latest bank statement.';

    // Middle of the month: 15th at 09:00 AM
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: 15,
        hour: 9,
        minute: 0,
        ...(Platform.OS === 'android' ? { channelId: 'import-reminders' } : {}),
      },
    });

    // End of the month: 28th at 09:00 AM
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: 28,
        hour: 9,
        minute: 0,
        ...(Platform.OS === 'android' ? { channelId: 'import-reminders' } : {}),
      },
    });

    console.log('Successfully scheduled bi-monthly import reminders (15th & 28th).');
    return true;
  } catch (error) {
    console.error('Failed to setup import notifications:', error);
    return false;
  }
}

/**
 * Smart Suppressor: Cancels all scheduled import reminders for the current month.
 */
export async function cancelCurrentMonthReminders() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Smart Suppressor: Canceled remaining import reminders for this month.');
  } catch (error) {
    console.error('Failed to cancel notifications:', error);
  }
}