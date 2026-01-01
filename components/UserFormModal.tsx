"use client";

import { useState, useEffect } from "react";
import { createUser, updateUserProfile, getUserTypes } from "@/lib/firestore";
import { UserProfile, UserType } from "@/types";

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

export default function UserFormModal({
  isOpen,
  onClose,
  user,
}: UserFormModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [userType, setUserType] = useState<UserType>("");
  const [loading, setLoading] = useState(false);
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [error, setError] = useState("");

  const isEditing = !!user;

  useEffect(() => {
    if (isOpen) {
      loadUserTypes();
      if (user) {
        setEmail(user.email);
        setUsername(user.username);
        setUserType(user.userType);
        setPassword(""); // Don't pre-fill password
      } else {
        // Reset form for new user
        setEmail("");
        setPassword("");
        setUsername("");
        setUserType("");
      }
      setError("");
    }
  }, [isOpen, user]);

  const loadUserTypes = async () => {
    try {
      setLoadingTypes(true);
      const types = await getUserTypes();
      setUserTypes(types);
    } catch (error) {
      console.error("Error loading user types:", error);
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    if (!userType) {
      setError("Please select a user type");
      return;
    }

    if (isEditing) {
      // Update existing user
      if (!user) return;

      if (!email.trim()) {
        setError("Please enter an email");
        return;
      }

      setLoading(true);
      try {
        await updateUserProfile(user.uid, {
          email: email.trim(),
          username: username.trim(),
          userType: userType,
        });
        onClose();
      } catch (error: any) {
        console.error("Error updating user:", error);
        setError(error.message || "Failed to update user");
      } finally {
        setLoading(false);
      }
    } else {
      // Create new user
      if (!email.trim()) {
        setError("Please enter an email");
        return;
      }

      if (!password || password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }

      setLoading(true);
      try {
        await createUser(
          email.trim(),
          password,
          username.trim(),
          userType
        );
        onClose();
        alert("User created successfully");
      } catch (error: any) {
        console.error("Error creating user:", error);
        setError(error.message || "Failed to create user");
      } finally {
        setLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">
            {isEditing ? "Edit User" : "Add New User"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              required
              disabled={isEditing}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {isEditing && (
              <p className="mt-1 text-xs text-gray-500">
                Email cannot be changed
              </p>
            )}
          </div>

          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password (min 6 characters)"
                required
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User Type <span className="text-red-500">*</span>
            </label>
            {loadingTypes ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                Loading user types...
              </div>
            ) : (
              <select
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select a type</option>
                {userTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? isEditing
                  ? "Updating..."
                  : "Creating..."
                : isEditing
                ? "Update User"
                : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

