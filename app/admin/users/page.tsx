"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  getAllUsers,
  softDeleteUser,
  restoreUser,
  updateUserProfile,
} from "@/lib/firestore";
import { UserStatus } from "@/types";
import { UserProfile } from "@/types";
import UserFormModal from "@/components/UserFormModal";

export default function UsersManagementPage() {
  const { user, userProfile, signOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  useEffect(() => {
    // Wait for auth to load before checking
    if (authLoading) return;
    
    if (!user) {
      router.push("/login");
      return;
    }
    
    if (user.email?.toLowerCase() === "admin@gmail.com") {
      loadUsers();
    } else {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // Reload users when showDeleted changes
    if (user?.email?.toLowerCase() === "admin@gmail.com" && !authLoading) {
      loadUsers();
    }
  }, [showDeleted]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const fetchedUsers = await getAllUsers(showDeleted);
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error loading users:", error);
      alert("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const handleDeleteUser = async (uid: string) => {
    if (!confirm("Are you sure you want to delete this user? This is a soft delete and can be restored.")) {
      return;
    }

    try {
      await softDeleteUser(uid);
      await loadUsers();
      alert("User deleted successfully");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const handleRestoreUser = async (uid: string) => {
    try {
      await restoreUser(uid);
      await loadUsers();
      alert("User restored successfully");
    } catch (error) {
      console.error("Error restoring user:", error);
      alert("Failed to restore user");
    }
  };

  const handleStatusChange = async (uid: string, newStatus: UserStatus) => {
    try {
      await updateUserProfile(uid, { status: newStatus });
      await loadUsers();
    } catch (error) {
      console.error("Error updating user status:", error);
      alert("Failed to update user status");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingUser(null);
    loadUsers();
  };

  // Show loading while auth is loading
  if (authLoading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  // Redirect if not admin (handled by useEffect, but show nothing while redirecting)
  if (user?.email?.toLowerCase() !== "admin@gmail.com") {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg">Redirecting...</div>
        </div>
      </ProtectedRoute>
    );
  }

  const activeUsers = users.filter((u) => !u.deleted);
  const deletedUsers = users.filter((u) => u.deleted);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="text-gray-600 hover:text-gray-800"
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
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                </button>
                <h1 className="text-xl font-bold text-gray-800">
                  Users Management
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">{user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Users</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleted(!showDeleted)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  showDeleted
                    ? "bg-gray-600 text-white hover:bg-gray-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {showDeleted ? "Show Active" : "Show Deleted"}
              </button>
              <button
                onClick={handleAddUser}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Add New User
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-500">Loading users...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-500 mb-4">
                {showDeleted ? "No deleted users" : "No users yet"}
              </div>
              {!showDeleted && (
                <button
                  onClick={handleAddUser}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Add Your First User
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deleted Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((userItem) => (
                    <tr
                      key={userItem.uid}
                      className={userItem.deleted ? "bg-gray-50 opacity-60" : ""}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {userItem.username}
                        </div>
                        {userItem.isAdmin && (
                          <div className="text-xs text-indigo-600">Admin</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {userItem.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                          {userItem.userType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {userItem.deleted ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Deleted
                          </span>
                        ) : (
                          <select
                            value={userItem.status || 'active'}
                            onChange={(e) => handleStatusChange(userItem.uid, e.target.value as UserStatus)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {userItem.deleted ? (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                            Deleted
                          </span>
                        ) : (
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Not Deleted
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(userItem.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {!userItem.deleted ? (
                            <>
                              <button
                                onClick={() => handleEditUser(userItem)}
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUser(userItem.uid)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleRestoreUser(userItem.uid)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>

        {showModal && (
          <UserFormModal
            isOpen={showModal}
            onClose={handleModalClose}
            user={editingUser}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

