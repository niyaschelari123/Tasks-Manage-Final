"use client";

import { useState, useEffect } from "react";
import { getAllUsers, createNotification, addTaskHistory } from "@/lib/firestore";
import { UserProfile } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  taskTitle: string;
  onSuccess: () => void;
}

export default function NotificationModal({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  onSuccess,
}: NotificationModalProps) {
  const { user, userProfile } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [remark, setRemark] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    } else {
      // Reset when modal closes
      setSelectedUsers(new Set());
      setRemark("");
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const users = await getAllUsers();
      // Filter out admin and current user
      const filteredUsers = users.filter(
        (u) =>
          u.email?.toLowerCase() !== "admin@gmail.com" &&
          u.uid !== user?.uid
      );
      setAllUsers(filteredUsers);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleUser = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const handleSubmit = async () => {
    if (selectedUsers.size === 0) {
      alert("Please select at least one user to notify");
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const notificationPromises = Array.from(selectedUsers).map((recipientId) =>
        createNotification({
          taskId,
          taskTitle,
          recipientId,
          senderId: user.uid,
          senderEmail: user.email || undefined,
          senderUsername: userProfile?.username || undefined,
          type: "task_completed",
          message: `Task "${taskTitle}" has been marked as completed`,
          remark: remark.trim() || undefined,
        })
      );

      await Promise.all(notificationPromises);
      
      // Add notification to task history
      try {
        const recipientNames = Array.from(selectedUsers)
          .map((uid) => {
            const recipient = allUsers.find((u) => u.uid === uid);
            return recipient?.username || recipient?.email || uid;
          })
          .join(", ");
        
        await addTaskHistory(
          taskId,
          "notification_sent",
          user.uid,
          user.email || undefined,
          userProfile?.username || undefined,
          undefined,
          undefined,
          undefined,
          `Notification sent to ${selectedUsers.size} user(s): ${recipientNames}${remark.trim() ? ` - ${remark.trim()}` : ""}`
        );
      } catch (historyError) {
        console.error("Failed to log notification to task history:", historyError);
        // Don't block the notification sending if history logging fails
      }
      
      onSuccess();
      onClose();
      alert(`Notifications sent to ${selectedUsers.size} user(s)`);
    } catch (error: any) {
      console.error("Error sending notifications:", error);
      alert(`Failed to send notifications: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Notify Users</h2>
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
        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Task: <span className="font-semibold">{taskTitle}</span>
            </p>
            <p className="text-sm text-gray-500">
              Select users to notify about this task completion
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Users *
            </label>
            {loadingUsers ? (
              <div className="text-sm text-gray-500">Loading users...</div>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-2">
                {allUsers.length === 0 ? (
                  <div className="text-sm text-gray-500 p-2">
                    No users available to notify
                  </div>
                ) : (
                  allUsers.map((u) => (
                    <label
                      key={u.uid}
                      className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.has(u.uid)}
                        onChange={() => toggleUser(u.uid)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">
                        {u.username || u.email}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Remark (Optional)
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Add a remark or comment..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || selectedUsers.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Sending..." : "Send Notifications"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

