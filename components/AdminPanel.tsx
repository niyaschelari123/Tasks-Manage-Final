"use client";

import { useState, useEffect } from "react";
import {
  getAllProjects,
  updateProject,
  getUserTypes,
  addUserType,
  updateUserType,
  deleteUserType,
  getUsersByType,
  getTaskStatuses,
  addTaskStatus,
  updateTaskStatus,
  deleteTaskStatus,
  deleteAllTasks,
  deleteAllProjects,
} from "@/lib/firestore";
import { Project, ProjectStatus, UserProfile } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminPanel() {
  const { userProfile, user, refreshUserProfile } = useAuth();
  console.log("user profile", userProfile);
  console.log("user", user);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userTypes, setUserTypes] = useState<string[]>([]);
  const [newUserType, setNewUserType] = useState("");
  const [taskStatuses, setTaskStatuses] = useState<string[]>([]);
  const [newTaskStatus, setNewTaskStatus] = useState("");
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [editingStatusValue, setEditingStatusValue] = useState("");
  const [editingUserType, setEditingUserType] = useState<string | null>(null);
  const [editingUserTypeValue, setEditingUserTypeValue] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingPanelIndex, setEditingPanelIndex] = useState<number | null>(null);
  const [editingPanelValue, setEditingPanelValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingTasks, setDeletingTasks] = useState(false);
  const [deletingProjects, setDeletingProjects] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    userTypes: false,
    taskStatuses: false,
    projects: false,
  });

  // Debug: Try to refresh profile if admin email but profile is null
  useEffect(() => {
    if (user?.email?.toLowerCase() === "admin@gmail.com" && !userProfile) {
      console.log(
        "Admin user detected but profile is null - attempting to refresh"
      );
      console.log("User UID:", user.uid);
      console.log("User Email:", user.email);

      // Try to refresh after a short delay to ensure auth is ready
      const timer = setTimeout(() => {
        refreshUserProfile();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [user, userProfile, refreshUserProfile]);

  useEffect(() => {
    if (user?.email?.toLowerCase() === "admin@gmail.com") {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsData, types, statuses] = await Promise.all([
        getAllProjects(),
        getUserTypes(),
        getTaskStatuses(),
      ]);
      setProjects(projectsData);
      setUserTypes(types);
      setTaskStatuses(statuses);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectStatusChange = async (
    projectId: string,
    newStatus: ProjectStatus
  ) => {
    try {
      await updateProject(projectId, { status: newStatus });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update project status");
    }
  };

  const handleAddUserType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserType.trim()) {
      setError("User type cannot be empty");
      return;
    }

    try {
      await addUserType(newUserType.trim());
      setNewUserType("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add user type");
    }
  };

  const handleAddTaskStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskStatus.trim()) {
      setError("Task status cannot be empty");
      return;
    }

    try {
      await addTaskStatus(newTaskStatus.trim());
      setNewTaskStatus("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add task status");
    }
  };

  const handleStartEditStatus = (status: string) => {
    setEditingStatus(status);
    setEditingStatusValue(status);
  };

  const handleSaveEditStatus = async () => {
    if (!editingStatus || !editingStatusValue.trim()) {
      setError("Status cannot be empty");
      return;
    }

    try {
      await updateTaskStatus(editingStatus, editingStatusValue.trim());
      setEditingStatus(null);
      setEditingStatusValue("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update task status");
    }
  };

  const handleCancelEditStatus = () => {
    setEditingStatus(null);
    setEditingStatusValue("");
  };

  const handleDeleteTaskStatus = async (status: string) => {
    if (!confirm(`Are you sure you want to delete the status "${status}"?`)) {
      return;
    }

    try {
      await deleteTaskStatus(status);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete task status");
    }
  };

  const handleStartEditUserType = (userType: string) => {
    setEditingUserType(userType);
    setEditingUserTypeValue(userType);
  };

  const handleSaveEditUserType = async () => {
    if (!editingUserType || !editingUserTypeValue.trim()) {
      setError("User type cannot be empty");
      return;
    }

    try {
      await updateUserType(editingUserType, editingUserTypeValue.trim());
      setEditingUserType(null);
      setEditingUserTypeValue("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update user type");
    }
  };

  const handleCancelEditUserType = () => {
    setEditingUserType(null);
    setEditingUserTypeValue("");
  };

  const handleDeleteUserType = async (userType: string) => {
    if (!confirm(`Are you sure you want to delete the user type "${userType}"?`)) {
      return;
    }

    try {
      await deleteUserType(userType);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete user type");
    }
  };

  const handleStartEditPanel = (projectId: string, panelIndex: number, currentValue: string) => {
    setEditingProjectId(projectId);
    setEditingPanelIndex(panelIndex);
    setEditingPanelValue(currentValue);
  };

  const handleSaveEditPanel = async () => {
    if (!editingProjectId || editingPanelIndex === null || !editingPanelValue.trim()) {
      setError("Panel name cannot be empty");
      return;
    }

    try {
      const project = projects.find((p) => p.id === editingProjectId);
      if (!project || !project.panels) {
        setError("Project or panels not found");
        return;
      }

      const updatedPanels = [...project.panels];
      updatedPanels[editingPanelIndex] = editingPanelValue.trim();

      await updateProject(editingProjectId, { panels: updatedPanels });
      setEditingProjectId(null);
      setEditingPanelIndex(null);
      setEditingPanelValue("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update panel");
    }
  };

  const handleCancelEditPanel = () => {
    setEditingProjectId(null);
    setEditingPanelIndex(null);
    setEditingPanelValue("");
  };

  const handleDeletePanel = async (projectId: string, panelIndex: number) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project || !project.panels) {
      return;
    }

    if (!confirm(`Are you sure you want to delete the panel "${project.panels[panelIndex]}"?`)) {
      return;
    }

    try {
      const updatedPanels = project.panels.filter((_, index) => index !== panelIndex);
      await updateProject(projectId, { panels: updatedPanels.length > 0 ? updatedPanels : undefined });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete panel");
    }
  };

  const handleAddPanel = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      return;
    }

    const panelName = prompt("Enter panel name:");
    if (!panelName || !panelName.trim()) {
      return;
    }

    try {
      const currentPanels = project.panels || [];
      if (currentPanels.includes(panelName.trim())) {
        setError("Panel with this name already exists");
        return;
      }

      const updatedPanels = [...currentPanels, panelName.trim()];
      await updateProject(projectId, { panels: updatedPanels });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add panel");
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleClearAllTasks = async () => {
    const confirmed = confirm(
      "⚠️ WARNING: This will delete ALL tasks and their history from Firebase. This action cannot be undone!\n\nAre you absolutely sure you want to proceed?"
    );
    if (!confirmed) {
      return;
    }

    const doubleConfirm = confirm(
      "This is your last chance! Click OK to permanently delete ALL tasks and history."
    );
    if (!doubleConfirm) {
      return;
    }

    setDeletingTasks(true);
    setError("");
    try {
      const result = await deleteAllTasks();
      alert(
        `Successfully deleted ${result.tasksDeleted} tasks and ${result.historyDeleted} history entries.`
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete all tasks");
      alert(`Error: ${err.message || "Failed to delete all tasks"}`);
    } finally {
      setDeletingTasks(false);
    }
  };

  const handleClearAllProjects = async () => {
    const confirmed = confirm(
      "⚠️ WARNING: This will delete ALL projects from Firebase. This action cannot be undone!\n\nAre you absolutely sure you want to proceed?"
    );
    if (!confirmed) {
      return;
    }

    const doubleConfirm = confirm(
      "This is your last chance! Click OK to permanently delete ALL projects."
    );
    if (!doubleConfirm) {
      return;
    }

    setDeletingProjects(true);
    setError("");
    try {
      const result = await deleteAllProjects();
      alert(`Successfully deleted ${result.projectsDeleted} projects.`);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete all projects");
      alert(`Error: ${err.message || "Failed to delete all projects"}`);
    } finally {
      setDeletingProjects(false);
    }
  };

  if (user?.email?.toLowerCase() !== "admin@gmail.com") {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Admin Panel</h2>
          <button
            onClick={() => window.location.href = "/admin/users"}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Manage Users
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleClearAllTasks}
              disabled={deletingTasks}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {deletingTasks ? "Deleting..." : "Clear All Tasks"}
            </button>
            <button
              onClick={handleClearAllProjects}
              disabled={deletingProjects}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {deletingProjects ? "Deleting..." : "Clear All Projects"}
            </button>
          </div>
        </div>

        {/* User Types Management */}
        <div className="mb-6">
          <div
            className="flex items-center justify-between cursor-pointer mb-3"
            onClick={() => toggleSection("userTypes")}
          >
            <h3 className="text-lg font-semibold text-gray-700">User Types</h3>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${
                expandedSections.userTypes ? "rotate-180" : ""
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
          </div>
          {expandedSections.userTypes && (
            <>
              <div className="flex gap-2 mb-4">
            <form onSubmit={handleAddUserType} className="flex gap-2 flex-1">
              <input
                type="text"
                value={newUserType}
                onChange={(e) => setNewUserType(e.target.value)}
                placeholder="Add new user type"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add Type
              </button>
            </form>
          </div>
          <div className="space-y-2">
            {userTypes.map((type) => (
              <div
                key={type}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                {editingUserType === type ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingUserTypeValue}
                      onChange={(e) => setEditingUserTypeValue(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEditUserType}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEditUserType}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartEditUserType(type)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteUserType(type)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                        disabled={userTypes.length <= 1}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
            </>
          )}
        </div>

        {/* Task Statuses Management */}
        <div className="mb-6">
          <div
            className="flex items-center justify-between cursor-pointer mb-3"
            onClick={() => toggleSection("taskStatuses")}
          >
            <h3 className="text-lg font-semibold text-gray-700">Task Statuses</h3>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${
                expandedSections.taskStatuses ? "rotate-180" : ""
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
          </div>
          {expandedSections.taskStatuses && (
            <>
              <div className="flex gap-2 mb-4">
            <form onSubmit={handleAddTaskStatus} className="flex gap-2 flex-1">
              <input
                type="text"
                value={newTaskStatus}
                onChange={(e) => setNewTaskStatus(e.target.value)}
                placeholder="Add new task status"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add Status
              </button>
            </form>
          </div>
          <div className="space-y-2">
            {taskStatuses.map((status) => (
              <div
                key={status}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                {editingStatus === status ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingStatusValue}
                      onChange={(e) => setEditingStatusValue(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEditStatus}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEditStatus}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium">
                      {status}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStartEditStatus(status)}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTaskStatus(status)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
                        disabled={taskStatuses.length <= 1}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
            </>
          )}
        </div>

        {/* Projects Management */}
        <div>
          <div
            className="flex items-center justify-between cursor-pointer mb-3"
            onClick={() => toggleSection("projects")}
          >
            <h3 className="text-lg font-semibold text-gray-700">Projects</h3>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${
                expandedSections.projects ? "rotate-180" : ""
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
          </div>
          {expandedSections.projects && (
            <>
              {loading ? (
            <div className="text-center py-4">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No projects found
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">
                      {project.name}
                    </h4>
                    {project.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {project.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Created:{" "}
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                    {project.panels && project.panels.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-700 mb-2">Panels:</p>
                        <div className="space-y-2">
                          {project.panels.map((panel, panelIndex) => (
                            <div
                              key={panelIndex}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                            >
                              {editingProjectId === project.id && editingPanelIndex === panelIndex ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <input
                                    type="text"
                                    value={editingPanelValue}
                                    onChange={(e) => setEditingPanelValue(e.target.value)}
                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                  />
                                  <button
                                    onClick={handleSaveEditPanel}
                                    className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelEditPanel}
                                    className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded">
                                    {panel}
                                  </span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleStartEditPanel(project.id, panelIndex, panel)}
                                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeletePanel(project.id, panelIndex)}
                                      className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleAddPanel(project.id)}
                          className="mt-2 px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                        >
                          + Add Panel
                        </button>
                      </div>
                    )}
                    {(!project.panels || project.panels.length === 0) && (
                      <div className="mt-3">
                        <button
                          onClick={() => handleAddPanel(project.id)}
                          className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200"
                        >
                          + Add Panel
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        project.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {project.status}
                    </span>
                    <select
                      value={project.status}
                      onChange={(e) =>
                        handleProjectStatusChange(
                          project.id,
                          e.target.value as ProjectStatus
                        )
                      }
                      className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
