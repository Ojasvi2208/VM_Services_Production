import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// Uses FIREBASE_SERVICE_ACCOUNT env var (JSON string) or GOOGLE_APPLICATION_CREDENTIALS file path

let firebaseApp: admin.app.App | null = null;

function initializeFirebase(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Check if already initialized
    if (admin.apps.length > 0) {
      firebaseApp = admin.apps[0]!;
      return firebaseApp;
    }

    // Option 1: Service account JSON as environment variable
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin initialized with service account JSON');
      return firebaseApp;
    }

    // Option 2: Default credentials (for Google Cloud environments)
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('Firebase Admin initialized with default credentials');
    return firebaseApp;

  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    throw error;
  }
}

// Get Firebase Messaging instance
export function getMessaging(): admin.messaging.Messaging {
  const app = initializeFirebase();
  return admin.messaging(app);
}

// Send notification to a single device
export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const messaging = getMessaging();
    
    await messaging.send({
      token,
      notification: {
        title,
        body,
      },
      data: data || {},
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
        },
      },
    });

    return true;
  } catch (error: any) {
    console.error('Push notification error:', error.message);
    
    // Return false for invalid tokens (they should be removed)
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      return false;
    }
    
    throw error;
  }
}

// Send notification to multiple devices
export async function sendPushNotificationBatch(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
  if (tokens.length === 0) {
    return { success: 0, failure: 0, invalidTokens: [] };
  }

  try {
    const messaging = getMessaging();
    
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    
    // Collect invalid tokens for cleanup
    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const errorCode = resp.error.code;
        if (errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered') {
          invalidTokens.push(tokens[idx]);
        }
      }
    });

    return {
      success: response.successCount,
      failure: response.failureCount,
      invalidTokens,
    };

  } catch (error) {
    console.error('Batch push notification error:', error);
    return { success: 0, failure: tokens.length, invalidTokens: [] };
  }
}

// Check if Firebase is configured
export function isFirebaseConfigured(): boolean {
  return !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
