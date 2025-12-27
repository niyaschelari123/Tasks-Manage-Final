'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function AdminSetupPage() {
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'create' | 'profile'>('create');
  const router = useRouter();

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      // First, try to create the user in Firebase Auth
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth!, email, password);
      } catch (authError: any) {
        // If user already exists, try to sign in
        if (authError.code === 'auth/email-already-in-use') {
          setMessage('User already exists. Creating profile...');
          userCredential = await signInWithEmailAndPassword(auth!, email, password);
        } else {
          throw authError;
        }
      }

      const user = userCredential.user;

      // Create the profile in Firestore
      const profileResponse = await fetch('/api/admin/create-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email || email,
          userType: 'admin',
        }),
      });

      const profileData = await profileResponse.json();

      if (profileResponse.ok) {
        setMessage('Admin user and profile created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setError(profileData.error || 'User created but failed to create profile');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfileOnly = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      // Sign in first to get the user
      const userCredential = await signInWithEmailAndPassword(auth!, email, password);
      const user = userCredential.user;

      // Create the profile
      const profileResponse = await fetch('/api/admin/create-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email || email,
          userType: 'admin',
        }),
      });

      const profileData = await profileResponse.json();

      if (profileResponse.ok) {
        setMessage('Admin profile created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setError(profileData.error || 'Failed to create profile');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Make sure the user exists in Firebase Auth.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          Admin Setup
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Create admin user account
        </p>

        <div className="mb-4">
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                mode === 'create'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Create New User
            </button>
            <button
              type="button"
              onClick={() => setMode('profile')}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium ${
                mode === 'profile'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Create Profile Only
            </button>
          </div>
          <p className="text-xs text-gray-600">
            {mode === 'create'
              ? 'Create a new admin user (if user does not exist)'
              : 'Create profile for existing user (user must already exist in Firebase Auth)'}
          </p>
        </div>

        <form onSubmit={mode === 'create' ? handleCreateUser : handleCreateProfileOnly} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="admin@gmail.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter password (min 6 characters)"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Processing...' : mode === 'create' ? 'Create Admin User' : 'Create Profile'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            Back to Login
          </button>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Tip:</strong> If you already have the user in Firebase Auth, use "Create Profile Only" mode.
            This will create the Firestore profile without requiring Firebase Admin SDK.
          </p>
        </div>
      </div>
    </div>
  );
}

