"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteAllNotifications,
  subscribeToNotifications,
} from "@/lib/firestore";
import { Notification } from "@/types";

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    let unsubscribe: (() => void) | null = null;

    try {
      // Subscribe to real-time notifications
      unsubscribe = subscribeToNotifications(user.uid, (notifs) => {
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n) => !n.read).length);
        setLoading(false);
      });
    } catch (error: any) {
      console.error("Error subscribing to notifications:", error);
      // Fallback: try to load notifications without real-time listener
      if (error?.code === "failed-precondition") {
        console.warn("Index not found, using fallback");
        getNotifications(user.uid)
          .then((notifs) => {
            setNotifications(notifs);
            setUnreadCount(notifs.filter((n) => !n.read).length);
            setLoading(false);
          })
          .catch((err) => {
            console.error("Error loading notifications:", err);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, router, authLoading]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      setMarkingAsRead(notificationId);
      await markNotificationAsRead(notificationId);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      alert("Failed to mark notification as read");
    } finally {
      setMarkingAsRead(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    try {
      setMarkingAll(true);
      await markAllNotificationsAsRead(user.uid);
    } catch (error) {
      console.error("Error marking all as read:", error);
      alert("Failed to mark all notifications as read");
    } finally {
      setMarkingAll(false);
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
      setClearingAll(true);
      await deleteAllNotifications(user.uid);
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      alert("Failed to delete notifications");
    } finally {
      setClearingAll(false);
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
    <ProtectedRoute>
      {loading || authLoading ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-lg">Loading notifications...</div>
        </div>
      ) : (
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
                Notifications
              </h1>
            </div>
            {notifications.length > 0 && (
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    disabled={markingAll}
                    className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {markingAll ? "Marking..." : "Mark all as read"}
                  </button>
                )}
                <button
                  onClick={handleClearAll}
                  disabled={clearingAll}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {clearingAll ? "Clearing..." : "Clear all"}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-400 mb-4"
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
            <p className="text-gray-500 text-lg">No notifications</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg shadow-sm border p-6 ${
                  !notification.read ? "border-indigo-200 bg-indigo-50" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-3 h-3 rounded-full mt-2 ${
                          !notification.read
                            ? "bg-indigo-600"
                            : "bg-gray-300"
                        }`}
                      ></div>
                      <div className="flex-1">
                        <p className="text-base font-medium text-gray-900">
                          {notification.message}
                        </p>
                        {notification.remark && (
                          <p className="text-sm text-gray-600 mt-2 italic bg-gray-100 p-2 rounded">
                            "{notification.remark}"
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                          <span>
                            From:{" "}
                            {notification.senderUsername ||
                              notification.senderEmail ||
                              "Unknown"}
                          </span>
                          <span>•</span>
                          <span>{formatDate(notification.createdAt)}</span>
                          {notification.read && notification.readAt && (
                            <>
                              <span>•</span>
                              <span>
                                Read: {formatDate(notification.readAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {!notification.read && (
                    <button
                      onClick={() => handleMarkAsRead(notification.id)}
                      disabled={markingAsRead === notification.id}
                      className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {markingAsRead === notification.id
                        ? "Marking..."
                        : "Mark as read"}
                    </button>
                  )}
                  {notification.read && (
                    <div className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                      Read
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
      )}
    </ProtectedRoute>
  );
}

