import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;
let adminAuth: any;
let adminDb: any;

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    // Option 1: Use service account key file (if available)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    }
    // Option 2: Use project ID from environment (for local development with Application Default Credentials)
    else if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
    // Option 3: Use default credentials (if running on Firebase/Google Cloud)
    else {
      adminApp = initializeApp();
    }

    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    console.error('Note: Firebase Admin SDK requires service account credentials for user creation.');
  }
} else {
  adminApp = getApps()[0];
  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp);
}

export { adminAuth, adminDb };
export default adminApp;

