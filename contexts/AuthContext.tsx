"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { User, UserProfile } from "@/types";
import { getUserProfile } from "@/lib/firestore";

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signOut: async () => {},
  refreshUserProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user profile from Firestore 'users' collection
  // This is the single source of truth for user profile data
  const loadUserProfile = async (
    uid: string,
    email: string | null,
    retryCount = 0
  ) => {
    try {
      console.log("Loading user profile for:", { uid, email, retryCount });
      let profile = await getUserProfile(uid);
      console.log("Profile from Firestore:", profile);

      // If profile doesn't exist, this is unexpected for normal signup flow
      // Only auto-create for admin@gmail.com as a fallback
      if (!profile) {
        console.warn(
          "Profile not found in Firestore users collection for UID:",
          uid
        );

        // Only auto-create admin profile as a fallback
        // Regular users should have their profile created during signup
        if (email?.toLowerCase() === "admin@gmail.com") {
          console.log(
            "Auto-creating admin profile (fallback for existing admin user)"
          );
          const { createUserProfile } = await import("@/lib/firestore");
          try {
            await createUserProfile({
              uid: uid,
              email: email,
              displayName: undefined,
              username: "admin",
              userType: "admin",
              isAdmin: true,
              status: 'active',
            });
            console.log("Admin profile created, fetching again...");
            await new Promise((resolve) => setTimeout(resolve, 1000));
            profile = await getUserProfile(uid);
          } catch (createError) {
            console.error("Error creating admin profile:", createError);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            profile = await getUserProfile(uid);
          }
        } else {
          console.error(
            "User profile missing in Firestore! This should not happen for properly signed up users."
          );
          console.error(
            "User should sign up again or profile needs to be created manually in Firestore."
          );
        }
      }

      setUserProfile(profile);

      if (!profile) {
        console.error(
          "User profile is still null for user:",
          email,
          "UID:",
          uid
        );
        console.error(
          'Please check Firestore - collection "users", document ID:',
          uid
        );
        console.error(
          "The user profile may need to be created manually or the user needs to sign up again."
        );
      } else {
        console.log("User profile loaded successfully:", profile);
        
        // Check if user is inactive and sign them out
        if (profile.status === 'inactive') {
          console.log("User is inactive, signing out...");
          await firebaseSignOut(auth);
          setUser(null);
          setUserProfile(null);
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      console.error("Error details:", error);

      // Retry on error if we haven't retried too many times
      if (retryCount < 2) {
        console.log(
          `Retrying profile load after error (attempt ${retryCount + 1})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return loadUserProfile(uid, email, retryCount + 1);
      }

      setUserProfile(null);
    }
  };

  useEffect(() => {
    if (!auth) {
      console.error("Firebase Auth is not initialized");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
          });
          await loadUserProfile(firebaseUser.uid, firebaseUser.email);
        } else {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    if (user?.uid && user?.email) {
      await loadUserProfile(user.uid, user.email);
    }
  };

  const signOut = async () => {
    if (!auth) {
      console.error("Firebase Auth is not initialized");
      return;
    }
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, signOut, refreshUserProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
