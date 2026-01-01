"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  subscribeToNotifications,
  deleteAllNotifications,
} from "@/lib/firestore";
import { Notification } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export default function NotificationDropdown() {
  const { user } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Subscribe to real-time notifications
    const unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });

    return () => unsubscribe();
  }, [user]);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id);
      } catch (error) {
        console.error("Error marking notification as read:", error);
      }
    }
    setIsOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    try {
      setLoading(true);
      await markAllNotificationsAsRead(user.uid);
      // The real-time listener will automatically update the state
    } catch (error) {
      console.error("Error marking all as read:", error);
      alert("Failed to mark all notifications as read");
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    if (
      !confirm(
        "Are you sure you want to delete all notifications? This action cannot be undone."
      )
    ) {
      return;
    }
    try {
      setLoading(true);
      await deleteAllNotifications(user.uid);
      // The real-time listener will automatically update the state
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      alert("Failed to delete notifications");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-800 transition-colors"
        aria-label="Notifications"
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
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-gray-800">
                  Notifications
                </h3>
              </div>
              {unreadCount > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleMarkAllAsRead}
                      disabled={loading}
                      className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50 px-2 py-1 rounded hover:bg-indigo-50"
                    >
                      {loading ? "Marking..." : "Mark all as read"}
                    </button>
                    <button
                      onClick={handleClearAll}
                      disabled={loading}
                      className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 px-2 py-1 rounded hover:bg-red-50"
                    >
                      {loading ? "Clearing..." : "Clear all"}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      router.push("/notifications");
                    }}
                    className="w-full text-xs text-center text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 border border-indigo-200"
                  >
                    View all notifications
                  </button>
                </div>
              )}
              {unreadCount === 0 && notifications.length > 0 && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    router.push("/notifications");
                  }}
                  className="w-full text-xs text-center text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 border border-indigo-200"
                >
                  View all notifications
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {(() => {
                const unreadNotifications = notifications.filter(
                  (n) => !n.read
                );
                return unreadNotifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No unread notifications
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {unreadNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors bg-blue-50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-2 h-2 rounded-full mt-2 bg-indigo-600"></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {notification.message}
                            </p>
                            {notification.remark && (
                              <p className="text-xs text-gray-600 mt-1 italic">
                                "{notification.remark}"
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {notification.senderUsername ||
                                notification.senderEmail ||
                                "Unknown"}{" "}
                              • {formatDate(notification.createdAt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
