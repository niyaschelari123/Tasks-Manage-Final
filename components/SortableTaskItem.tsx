"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, TaskStatus, UserProfile, User } from "@/types";

interface SortableTaskItemProps {
  task: Task;
  isExpanded: boolean;
  rearrangeMode: boolean;
  user: User | null;
  userProfile: UserProfile | null;
  allUsers: UserProfile[];
  availableStatuses: string[];
  canEditTask: (task: Task) => boolean;
  getStatusColor: (status: TaskStatus) => string;
  updatingAssignedUser: string | null;
  updatingStatus: string | null;
  isSelected: boolean;
  onSelect: (taskId: string) => void;
  onExpandToggle: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus, task: Task) => void;
  onAssignedUserChange: (task: Task, newUserId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onViewHistory: (task: Task) => void;
}

export default function SortableTaskItem({
  task,
  isExpanded,
  rearrangeMode,
  user,
  userProfile,
  allUsers,
  availableStatuses,
  canEditTask,
  getStatusColor,
  updatingAssignedUser,
  updatingStatus,
  isSelected,
  onSelect,
  onExpandToggle,
  onStatusChange,
  onAssignedUserChange,
  onEdit,
  onDelete,
  onViewHistory,
}: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !rearrangeMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white p-4 rounded-lg shadow-md ${
        rearrangeMode ? "cursor-move" : ""
      } ${isDragging ? "z-50" : ""} ${
        isSelected ? "ring-2 ring-indigo-500" : ""
      }`}
    >
      {/* Drag handle - only visible in rearrange mode */}
      {rearrangeMode && (
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-6 h-6 mb-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>
      )}

      {/* Collapsed View - Always Visible */}
      <div className="flex justify-between items-start">
        {!rearrangeMode && (
          <div className="mr-3 flex items-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onSelect(task.id)}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-gray-800 truncate">
            {task.title}
          </h3>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
            <div>
              <span className="font-medium">Project:</span>{" "}
              <span>{task.projectName}</span>
            </div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div>
              <span className="font-medium">Owner:</span>{" "}
              <span>
                {task.userId === user?.uid
                  ? userProfile?.username || user?.email || "You"
                  : task.userIdUsername || task.userId}
              </span>
            </div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div>
              <span className="font-medium">Assigned To:</span>{" "}
              <span>
                {task.assignedUserUsername ||
                  task.assignedUserEmail ||
                  task.assignedUserId ||
                  "Unassigned"}
              </span>
            </div>
            {task.panel && (
              <>
                <div className="h-4 w-px bg-gray-300"></div>
                <div>
                  <span className="font-medium">Panel:</span>{" "}
                  <span>{task.panel}</span>
                </div>
              </>
            )}
            {task.version && (
              <>
                <div className="h-4 w-px bg-gray-300"></div>
                <div>
                  <span className="font-medium">Version:</span>{" "}
                  <span>{task.version}</span>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4">
          {canEditTask(task) ? (
            <div className="inline-flex items-center">
              <select
                value={task.status}
                onChange={(e) =>
                  onStatusChange(
                    task.id,
                    e.target.value as TaskStatus,
                    task
                  )
                }
                disabled={!canEditTask(task) || updatingStatus === task.id}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={(e) => e.stopPropagation()}
              >
                {availableStatuses.map((statusOption: string) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption}
                  </option>
                ))}
              </select>
              {updatingStatus === task.id && (
                <svg
                  className="animate-spin h-4 w-4 ml-2 text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              )}
            </div>
          ) : (
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                task.status
              )}`}
            >
              {task.status}
            </span>
          )}
          <button
            onClick={() => onExpandToggle(task.id)}
            className="p-1 hover:bg-gray-100 rounded transition-transform"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <svg
              className={`w-5 h-5 text-gray-600 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          {task.description && (
            <p className="text-gray-600 mb-4">{task.description}</p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-4">
            {task.version && (
              <div>
                <span className="font-medium">Version:</span> {task.version}
              </div>
            )}
            {task.estimatedTime && (
              <div>
                <span className="font-medium">Estimated Time:</span> {task.estimatedTime}
              </div>
            )}
            {task.doneBy && (
              <div>
                <span className="font-medium">Done By:</span> {task.doneBy}
              </div>
            )}
            <div>
              <span className="font-medium">Created:</span>{" "}
              {new Date(task.createdAt).toLocaleDateString()}
            </div>
            <div>
              <span className="font-medium">Owner:</span>{" "}
              {task.userId === user?.uid
                ? userProfile?.username || user?.email || "You"
                : task.userIdUsername || task.userId}
              {task.userIdType && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                  {task.userIdType}
                </span>
              )}
            </div>
            <div>
              <span className="font-medium">Assigned To:</span>
              {allUsers.length > 0 ? (
                <div className="inline-flex items-center ml-2">
                  <select
                    value={task.assignedUserId || task.userId || ""}
                    onChange={(e) => onAssignedUserChange(task, e.target.value)}
                    disabled={updatingAssignedUser === task.id}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {allUsers
                      .filter(
                        (u) => u.email?.toLowerCase() !== "admin@gmail.com"
                      )
                      .map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.username || u.email}
                        </option>
                      ))}
                  </select>
                  {updatingAssignedUser === task.id && (
                    <svg
                      className="animate-spin h-4 w-4 ml-2 text-indigo-600"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  )}
                </div>
              ) : (
                <span className="ml-2">
                  {task.assignedUserUsername ||
                    task.assignedUserEmail ||
                    task.assignedUserId ||
                    "Loading..."}
                </span>
              )}
            </div>
            {task.panel && (
              <div>
                <span className="font-medium">Panel:</span>{" "}
                <span>{task.panel}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => onViewHistory(task)}
              className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm"
            >
              View Status History
            </button>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                task.status
              )}`}
            >
              {task.status}
            </span>
            {canEditTask(task) ? (
              <>
                <button
                  onClick={() => onEdit(task)}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(task)}
                  className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                >
                  Delete
                </button>
              </>
            ) : (
              <div className="text-sm text-gray-500 italic">
                View only - Cannot edit
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

