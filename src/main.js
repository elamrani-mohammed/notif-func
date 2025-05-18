import { Client, Databases, Query } from 'node-appwrite';
import { Expo } from 'expo-server-sdk';

export default async function main({ req, res, log, error }) {
  log(req.variables);
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const expo = new Expo();

  const notification =
    typeof req.body === 'string' ? JSON.parse(req.body) : req.body; // contains document info
  const { user_id, title, message } = notification;

  log(`${user_id},${title}${message}`);
  log(notification);
  try {
    const tokenDocs = await databases.listDocuments(
      process.env.DATABASE_ID,
      process.env.DEVICE_TOKENS_COLLECTION_ID,
      [Query.equal('user_id', user_id)]
    );

    if (tokenDocs.documents.length === 0) {
      await databases.updateDocument(
        process.env.DATABASE_ID,
        process.env.NOTIFICATIONS_COLLECTION_ID,
        notification['$id'],
        { status: 'failed', error: 'No push token found' }
      );
      return;
    }

    const pushToken = tokenDocs.documents[0].token;

    if (Expo.isExpoPushToken(pushToken)) {
      await databases.updateDocument(
        process.env.DATABASE_ID,
        process.env.NOTIFICATIONS_COLLECTION_ID,
        notification['$id'],
        { status: 'failed', error: 'Invalid Expo push token' }
      );
      return;
    }

    await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: 'default',
        title,
        body: message,
        data: { userId: user_id },
      },
    ]);

    await databases.updateDocument(
      process.env.DATABASE_ID,
      process.env.NOTIFICATIONS_COLLECTION_ID,

      notification['$id'],
      { status: 'sent' }
    );
  } catch (err) {
    await databases.updateDocument(
      process.env.DATABASE_ID,
      process.env.NOTIFICATIONS_COLLECTION_ID,
      notification['$id'],
      { status: 'failed', error: err.message }
    );
    error(err.message);
  }
}
