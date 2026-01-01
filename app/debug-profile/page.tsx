'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, createUserProfile } from '@/lib/firestore';

export default function DebugProfilePage() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const checkProfile = async () => {
    if (!user?.uid) {
      setDebugInfo({ error: 'No user logged in' });
      return;
    }

    setLoading(true);
    try {
      // Try to get profile directly
      const profile = await getUserProfile(user.uid);
      
      setDebugInfo({
        user: {
          uid: user.uid,
          email: user.email,
        },
        profileFromContext: userProfile,
        profileFromFirestore: profile,
        profileExists: !!profile,
        isAdmin: profile?.isAdmin,
      });

      // If profile doesn't exist and it's admin, try to create it
      if (!profile && user.email?.toLowerCase() === 'admin@gmail.com') {
        console.log('Attempting to create admin profile...');
        await createUserProfile({
          uid: user.uid,
          email: user.email,
          displayName: undefined,
          username: 'admin',
          userType: 'admin',
          isAdmin: true,
        });
        
        // Fetch again
        const newProfile = await getUserProfile(user.uid);
        setDebugInfo((prev: any) => ({
          ...prev,
          profileAfterCreation: newProfile,
          created: true,
        }));
        
        // Refresh the context
        await refreshUserProfile();
      }
    } catch (error: any) {
      setDebugInfo({
        error: error.message,
        stack: error.stack,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Profile Debug Page</h1>
        
        <div className="bg-white p-6 rounded-lg shadow-md mb-4">
          <h2 className="text-lg font-semibold mb-4">Current State</h2>
          <div className="space-y-2">
            <p><strong>User:</strong> {user?.email || 'Not logged in'}</p>
            <p><strong>User UID:</strong> {user?.uid || 'N/A'}</p>
            <p><strong>Profile from Context:</strong> {userProfile ? 'Exists' : 'Null'}</p>
            {userProfile && (
              <div className="mt-2 p-2 bg-gray-100 rounded">
                <pre className="text-xs">{JSON.stringify(userProfile, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mb-4">
          <button
            onClick={checkProfile}
            disabled={loading}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Check & Fix Profile'}
          </button>
          
          <button
            onClick={refreshUserProfile}
            className="ml-4 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Refresh Profile
          </button>
        </div>

        {debugInfo && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-lg font-semibold mb-4">Debug Information</h2>
            <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        <div className="mt-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Instructions:</strong>
            <br />
            1. Click "Check & Fix Profile" to verify and create the profile if needed
            <br />
            2. Check the debug information below
            <br />
            3. If profile was created, click "Refresh Profile" to update the context
            <br />
            4. Go back to dashboard and check if profile loads
          </p>
        </div>
      </div>
    </div>
  );
}

