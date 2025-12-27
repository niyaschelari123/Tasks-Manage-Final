import { NextRequest, NextResponse } from 'next/server';
import { createUserProfile } from '@/lib/firestore';

export async function POST(request: NextRequest) {
  try {
    const { uid, email, userType } = await request.json();

    if (!uid || !email) {
      return NextResponse.json(
        { error: 'UID and email are required' },
        { status: 400 }
      );
    }

    const isAdmin = email.toLowerCase() === 'admin@gmail.com';
    
    await createUserProfile({
      uid: uid,
      email: email,
      displayName: null,
      username: email.split('@')[0] || 'user', // Default username from email
      userType: userType || (isAdmin ? 'admin' : 'user'),
      isAdmin: isAdmin,
    });

    return NextResponse.json({
      success: true,
      message: 'User profile created successfully',
      user: {
        uid: uid,
        email: email,
        isAdmin: isAdmin,
      },
    });
  } catch (error: any) {
    console.error('Error creating user profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create user profile' },
      { status: 500 }
    );
  }
}

