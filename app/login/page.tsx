"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { createUserProfile, getUserTypes } from "@/lib/firestore";
import Link from "next/link";
import { UserType } from "@/types";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [userType, setUserType] = useState<UserType>("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadUserTypes();
  }, []);

  // Reload user types when switching to signup mode
  useEffect(() => {
    if (isSignUp && userTypes.length === 0) {
      loadUserTypes();
    }
  }, [isSignUp]);

  const loadUserTypes = async () => {
    setLoadingTypes(true);
    try {
      const types = await getUserTypes();
      console.log("Loaded user types:", types);
      setUserTypes(types);
      // If types array is empty, show warning
      if (types.length === 0) {
        console.warn(
          "No user types found. Check Firestore config/userTypes document."
        );
      }
    } catch (error: any) {
      console.error("Error loading user types:", error);
      // Don't set error here as it might interfere with login errors
      // Just log it and use defaults
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!auth) {
      const missingVars = [];
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) missingVars.push("NEXT_PUBLIC_FIREBASE_API_KEY");
      if (!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) missingVars.push("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
      if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) missingVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
      if (!process.env.NEXT_PUBLIC_FIREBASE_APP_ID) missingVars.push("NEXT_PUBLIC_FIREBASE_APP_ID");
      
      setError(
        missingVars.length > 0
          ? `Firebase is not initialized. Missing environment variables: ${missingVars.join(", ")}. Please add them in Vercel project settings under Settings > Environment Variables.`
          : "Firebase is not initialized. Please check your Vercel environment variables."
      );
      setLoading(false);
      return;
    }

    try {
      // Sign up is disabled - only admin can create accounts
      if (isSignUp) {
        setError("Sign up is disabled. Please contact an administrator to create an account.");
        setLoading(false);
        return;
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if user is active
      const { getUserProfile } = await import("@/lib/firestore");
      const profile = await getUserProfile(userCredential.user.uid);
      
      if (profile && profile.status === 'inactive') {
        // Sign out the user if they're inactive
        await auth.signOut();
        setError("Your account is inactive. Please contact an administrator.");
        setLoading(false);
        return;
      }
      
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">
          Task Management System
        </h1>
        <p className="text-center text-gray-600 mb-8">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter your password"
            />
          </div>

          {isSignUp && (
            <>
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Username *
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your username"
                />
              </div>
              <div>
                <label
                  htmlFor="userType"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  User Type *
                </label>
                {loadingTypes ? (
                  <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    Loading user types...
                  </div>
                ) : (
                  <>
                    <select
                      id="userType"
                      value={userType}
                      onChange={(e) => setUserType(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select a type</option>
                      {userTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                    {userTypes.length === 0 && (
                      <p className="mt-1 text-xs text-red-600">
                        No user types available. Please check Firestore
                        configuration.
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        {/* Sign up option commented out - only admin can create accounts */}
        {/* <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Sign up"}
          </button>
        </div> */}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600 mb-4">
            Or use backend authentication
          </p>
          <Link
            href="/api/auth/login"
            className="block w-full text-center bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Backend Login
          </Link>
        </div>
      </div>
    </div>
  );
}
