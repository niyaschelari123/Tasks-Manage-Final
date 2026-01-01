import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Dynamically import to handle initialization errors gracefully
    let adminAuth, adminDb, Timestamp;
    try {
      const adminModule = await import('@/lib/firebase-admin');
      adminAuth = adminModule.adminAuth;
      adminDb = adminModule.adminDb;
      const firestoreAdmin = await import('firebase-admin/firestore');
      Timestamp = firestoreAdmin.Timestamp;
    } catch (importError: any) {
      console.error('Error importing Firebase Admin:', importError);
      return NextResponse.json(
        { 
          error: 'Firebase Admin SDK is not properly configured. Please set up service account credentials or use the signup page instead.',
          details: importError.message
        },
        { status: 500 }
      );
    }

    if (!adminAuth) {
      return NextResponse.json(
        { 
          error: 'Firebase Admin SDK is not initialized. Please check your configuration. You can also create the admin user by signing up through the login page.',
          suggestion: 'Go to /login and sign up with admin@gmail.com'
        },
        { status: 500 }
      );
    }

    // Check if user already exists
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
      return NextResponse.json(
        { 
          message: 'User already exists',
          uid: userRecord.uid,
          email: userRecord.email
        },
        { status: 200 }
      );
    } catch (error: any) {
      // User doesn't exist, create it
      if (error.code === 'auth/user-not-found') {
        // Create the user
        userRecord = await adminAuth.createUser({
          email: email,
          password: password,
          emailVerified: true,
        });

        // Create user profile in Firestore
        const isAdmin = email.toLowerCase() === 'admin@gmail.com';
        const userProfile = {
          uid: userRecord.uid,
          email: email,
          displayName: undefined,
          userType: isAdmin ? 'admin' : 'user',
          isAdmin: isAdmin,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        await adminDb.collection('users').doc(userRecord.uid).set(userProfile);

        return NextResponse.json({
          success: true,
          message: 'Admin user created successfully',
          user: {
            uid: userRecord.uid,
            email: userRecord.email,
            isAdmin: isAdmin,
          },
        });
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    console.error('Error creating admin user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create admin user' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Admin setup endpoint. Use POST with { email: "admin@gmail.com", password: "your-password" }',
  });
}

