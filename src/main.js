import { Client, Databases, Query } from 'node-appwrite';
import { Expo } from 'expo-server-sdk';

export default async function main({ req, res, log, error }) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const databases = new Databases(client);
  const expo = new Expo();

  const notification =
    typeof req.body === 'string' ? JSON.parse(req.body) : req.body; // contains document info
  const { user_id, title, message, $id, device_token_id } = notification;

  log(`${user_id},${title}${message}`);
  log(notification);
  try {
    // const tokenDocs = await databases.listDocuments(
    //   process.env.DATABASE_ID,
    //   process.env.DEVICE_TOKENS_COLLECTION_ID,
    //   [Query.equal('user_id', user_id)]

    // );

    if (!device_token_id) {
      error('Missing device_token_id in notification');
      return res.json({
        success: false,
        message: 'device_token_id is required',
      });
    }

    const tokenDoc = await databases.listDocuments(
      process.env.DATABASE_ID,
      process.env.DEVICE_TOKENS_COLLECTION_ID,
      [Query.equal('$id', device_token_id)]
    );

    if (tokenDoc.documents.length === 0) {
      await databases.updateDocument(
        process.env.DATABASE_ID,
        process.env.NOTIFICATIONS_COLLECTION_ID,
        $id,
        { status: 'failed', error: 'No push token found' }
      );
      return res.json({
        success: false,
        status: 'failed',
        error: 'no Token found',
      });
    }

    const pushToken = tokenDoc.documents[0].push_token;

    if (!pushToken) {
      log('Push token is missing in device token doc.');
    }
    if (pushToken) log(pushToken);

    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      const errMsg = `Invalid Expo push token: ${pushToken}`;
      log(errMsg);

      await databases.updateDocument(
        process.env.DATABASE_ID,
        process.env.NOTIFICATIONS_COLLECTION_ID,
        notification.$id,
        {
          status: 'failed',
          error: errMsg,
        }
      );

      return res.json({ success: false, message: errMsg });
    }

    await expo.sendPushNotificationsAsync([
      {
        to: pushToken,
        sound: 'default',
        title: 'Smart Home',
        body: message,
        data: { userId: user_id },
      },
    ]);

    await databases.updateDocument(
      process.env.DATABASE_ID,
      process.env.NOTIFICATIONS_COLLECTION_ID,

      $id,
      { status: 'sent' }
    );
    return res.json({ success: true, message: 'Notifications sent' });
  } catch (err) {
    await databases.updateDocument(
      process.env.DATABASE_ID,
      process.env.NOTIFICATIONS_COLLECTION_ID,
      $id,
      { status: 'failed', error: err.message }
    );
    error('Error in function:', err);
    error(err.message);
    return res.json({
      success: false,
      message: 'Internal error',
      details: err.message,
    });
  }
}
