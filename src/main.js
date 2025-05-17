import { Client, Databases, Query } from 'node-appwrite';
import { Expo } from 'expo-server-sdk';
//
// type Context = {
//   req: any;
//   res: any;st
//   log: (msg: any) => void;
//   error: (msg: any) => void;
// };
//
// type Payload = {
//   userId: string;
//   title: string;
//   message: string;
// };

export default async function sendNotification(context) {
  const { req, res, log, error } = context;

  try {
    // Initialize Appwrite client
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(process.env.APPWRITE_API_KEY);

    const databases = new Databases(client);

    // Parse the payload
    const payload = JSON.parse(req.body);
    const { userId, title, message } = payload;

    // Get user's push token from the database
    const tokens = await databases.listDocuments(
      process.env.DATABASE_ID,
      process.env.DEVICE_TOKENS_COLLECTION_ID,
      [Query.equal('user_id', userId)]
    );

    if (tokens.documents.length === 0) {
      return res.json({
        success: false,
        message: 'No push token found for user',
      });
    }

    // Initialize Expo SDK client
    const expo = new Expo();
    const pushToken = tokens.documents[0].token;

    // Validate the push token
    if (Expo.isExpoPushToken(pushToken)) {
      error(`Push token ${pushToken} is not a valid Expo push token`);
      return res.json({
        success: false,
        message: 'Invalid push token',
      });
    }

    // Create the notification message
    const notification = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: message,
      data: { userId },
    };

    try {
      const ticket = await expo.sendPushNotificationsAsync([notification]);
      log('Push notification sent:', ticket);

      return res.json({
        success: true,
        message: 'Notification sent successfully',
        ticket,
      });
    } catch (err) {
      error('Error sending push notification:', err);
      return res.json({
        success: false,
        message: 'Failed to send notification',
      });
    }
  } catch (err) {
    error('Function error:', err);
    return res.json({
      success: false,
      message: 'Internal server error',
    });
  }
}
