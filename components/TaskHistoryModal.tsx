"use client";

import { useState, useEffect } from "react";
import { getTaskHistory } from "@/lib/firestore";
import { TaskHistory } from "@/types";

interface TaskHistoryModalProps {
  taskId: string;
  taskTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskHistoryModal({
  taskId,
  taskTitle,
  isOpen,
  onClose,
}: TaskHistoryModalProps) {
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && taskId) {
      loadHistory();
    }
  }, [isOpen, taskId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const historyData = await getTaskHistory(taskId);
      setHistory(historyData);
    } catch (error: any) {
      console.error("Error loading task history:", error);
      if (error?.code === "permission-denied" || error?.message?.includes("permission")) {
        setHistory([]);
        // Don't show alert for permission errors - just show empty state
      } else {
        alert("Failed to load task history. Please check your Firestore security rules.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "created":
        return "Created";
      case "status_changed":
        return "Status Changed";
      case "assigned_user_changed":
        return "Assigned User Changed";
      case "title_changed":
        return "Title Changed";
      case "description_changed":
        return "Description Changed";
      case "project_changed":
        return "Project Changed";
      case "version_changed":
        return "Version Changed";
      case "updated":
        return "Updated";
      case "notification_sent":
        return "Notification sent";
      default:
        return action;
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">
            Status History - {taskTitle}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No history available for this task
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performed By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Old Value
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Value
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {history.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(entry.timestamp)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {getActionLabel(entry.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {entry.performedByUsername ||
                          entry.performedByEmail ||
                          entry.performedBy}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {entry.oldValue || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {entry.newValue || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.description || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

