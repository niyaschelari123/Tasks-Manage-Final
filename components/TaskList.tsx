"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getAllTasks,
  updateTask,
  deleteTask,
  getAllUsers,
  getTaskStatuses,
  getUserTypes,
} from "@/lib/firestore";
import { Task, Project, TaskStatus, UserProfile } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import * as XLSX from "xlsx";
import TaskForm from "./TaskForm";
import TaskFormModal from "./TaskFormModal";
import TaskHistoryModal from "./TaskHistoryModal";
import SortableTaskItem from "./SortableTaskItem";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface TaskListProps {
  projects: Project[];
  onProjectCreated: () => void;
}

export default function TaskList({
  projects,
  onProjectCreated,
}: TaskListProps) {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [filterByMe, setFilterByMe] = useState(true); // Default filter by current user for non-admin
  const [showAllTasks, setShowAllTasks] = useState(false); // Show all tasks checkbox
  const [isInitialized, setIsInitialized] = useState(false); // Track if URL params have been read
  const [updatingAssignedUser, setUpdatingAssignedUser] = useState<
    string | null
  >(null); // Track which task is being updated
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null); // Track which task status is being updated
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedTaskForHistory, setSelectedTaskForHistory] =
    useState<Task | null>(null);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([
    "Pending",
    "Completed",
    "Deleted",
  ]);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [rearrangeMode, setRearrangeMode] = useState(false);
  const [filters, setFilters] = useState({
    status: "" as TaskStatus | "",
    projectId: "",
    fromDate: "",
    toDate: "",
    search: "",
    userId: "", // Filter by user when showAllTasks is enabled
    panel: "", // Filter by panel when project is selected
  });
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [showBulkVersion, setShowBulkVersion] = useState(false);
  const [bulkVersion, setBulkVersion] = useState("");
  const [updatingVersions, setUpdatingVersions] = useState(false);
  // Version modal for completing tasks
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [taskForVersion, setTaskForVersion] = useState<Task | null>(null);
  const [versionInput, setVersionInput] = useState("");
  // Excel export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportProjectId, setExportProjectId] = useState("");
  const [exportTaskLimit, setExportTaskLimit] = useState(10);
  const [exporting, setExporting] = useState(false);
  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [pageSize, setPageSize] = useState(50); // Tasks per page
  const [currentPage, setCurrentPage] = useState(1);
  const [pageHistory, setPageHistory] = useState<
    QueryDocumentSnapshot<DocumentData>[]
  >([]);
  // Store all page cursors for backward navigation
  // Index 0 = page 1 cursor (null = start), index 1 = page 2 cursor, etc.
  const [pageCursors, setPageCursors] = useState<
    (QueryDocumentSnapshot<DocumentData> | null)[]
  >([null]);

  // Update URL with current filter state
  const updateURL = useCallback(
    (
      newFilters: typeof filters,
      newFilterByMe: boolean,
      newShowAllTasks: boolean
    ) => {
      const params = new URLSearchParams();

      if (newFilters.status) params.set("status", newFilters.status);
      if (newFilters.projectId) params.set("projectId", newFilters.projectId);
      if (newFilters.fromDate) params.set("fromDate", newFilters.fromDate);
      if (newFilters.toDate) params.set("toDate", newFilters.toDate);
      if (newFilters.search) params.set("search", newFilters.search);
      if (newFilters.userId) params.set("userId", newFilters.userId);
      if (newFilters.panel) params.set("panel", newFilters.panel);
      if (newFilterByMe) params.set("filterByMe", "true");
      if (newShowAllTasks) params.set("showAllTasks", "true");

      const newURL = `${pathname}?${params.toString()}`;
      router.replace(newURL, { scroll: false });
    },
    [pathname, router]
  );

  // Read filters from URL on mount
  useEffect(() => {
    if (isInitialized) return; // Only read from URL once on mount

    const status = searchParams.get("status") || "";
    const projectId = searchParams.get("projectId") || "";
    const fromDate = searchParams.get("fromDate") || "";
    const toDate = searchParams.get("toDate") || "";
    const search = searchParams.get("search") || "";
    const userId = searchParams.get("userId") || "";
    const panel = searchParams.get("panel") || "";
    const filterByMeParam = searchParams.get("filterByMe") === "true";
    const showAllTasksParam = searchParams.get("showAllTasks") === "true";

    // Only set from URL if params exist
    if (
      status ||
      projectId ||
      fromDate ||
      toDate ||
      search ||
      userId ||
      panel ||
      searchParams.has("filterByMe") ||
      searchParams.has("showAllTasks")
    ) {
      setFilters({
        status: status as TaskStatus | "",
        projectId,
        fromDate,
        toDate,
        search,
        userId,
        panel,
      });
      // Handle showAllTasks first, as it takes precedence
      if (searchParams.has("showAllTasks")) {
        setShowAllTasks(showAllTasksParam);
        // If showAllTasks is true, ensure filterByMe is false
        if (showAllTasksParam) {
          setFilterByMe(false);
        } else if (searchParams.has("filterByMe")) {
          // Only set filterByMe if showAllTasks is false
          setFilterByMe(filterByMeParam);
        }
      } else if (searchParams.has("filterByMe")) {
        // If showAllTasks is not in URL, set filterByMe from URL
        setFilterByMe(filterByMeParam);
      }
    }
    setIsInitialized(true);
  }, [searchParams, isInitialized]);

  // Update URL when filters change (after initialization)
  useEffect(() => {
    if (!isInitialized) return; // Don't update URL until we've read from it
    updateURL(filters, filterByMe, showAllTasks);
  }, [filters, filterByMe, showAllTasks, isInitialized, updateURL]);

  useEffect(() => {
    if (user && isInitialized) {
      // Only set defaults if URL params weren't loaded (first visit)
      // If URL params exist, they've already been set in the URL reading useEffect
      const hasURLParams = searchParams.toString().length > 0;

      if (!hasURLParams) {
        // Set default filter by user for non-admin users
        const isAdminUser = user.email?.toLowerCase() === "admin@gmail.com";
        if (!isAdminUser) {
          // Non-admin users see their tasks by default
          setFilterByMe(true);
        } else {
          // Admin sees all tasks by default
          setFilterByMe(false);
        }
      }

      loadTasks(false); // Reset to first page when filters change
      // Load all users for assigned user dropdown
      loadAllUsers();
      // Load available task statuses
      loadTaskStatuses();
    }
  }, [
    user,
    userProfile,
    filters,
    filterByMe,
    showAllTasks,
    isInitialized,
    searchParams,
  ]);

  const loadTaskStatuses = async () => {
    try {
      const statuses = await getTaskStatuses();
      setAvailableStatuses(statuses);
    } catch (error) {
      console.error("Error loading task statuses:", error);
    }
  };

  // Retry loading user profile if user exists but profile is null
  useEffect(() => {
    if (user && !userProfile) {
      console.log("User exists but profile is null, attempting to refresh...", {
        uid: user.uid,
        email: user.email,
      });
      // Wait a bit then retry
      const timer = setTimeout(() => {
        refreshUserProfile();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, userProfile, refreshUserProfile]);

  const loadAllUsers = async () => {
    try {
      console.log("Loading all users...");
      const users = await getAllUsers();
      console.log("Loaded users:", users.length, users);
      setAllUsers(users);
    } catch (error) {
      console.error("Error loading all users:", error);
    }
  };

  const loadTasks = async (loadMore = false, customPageSize?: number) => {
    if (!user) return;
    setLoading(true);
    try {
      const isAdmin = user.email?.toLowerCase() === "admin@gmail.com";
      const currentPageSize = customPageSize ?? pageSize;

      const taskFilters: any = {
        status: filters.status || undefined,
        projectId: filters.projectId || undefined,
        fromDate: filters.fromDate ? new Date(filters.fromDate) : undefined,
        toDate: filters.toDate ? new Date(filters.toDate) : undefined,
        search: filters.search || undefined,
        panel: filters.panel || undefined,
      };

      // Filter by user logic
      if (showAllTasks && filters.userId) {
        // If "Show all tasks" is enabled and a user is selected, filter by that user (owner)
        taskFilters.userId = filters.userId;
      } else if (!isAdmin && filterByMe) {
        // If "Filter by my tasks" is enabled (and not admin), we'll filter by assignedUserId in the frontend
        // Don't set userId filter here - we'll filter after fetching
      }

      // Remove undefined values from filters
      Object.keys(taskFilters).forEach((key) => {
        if (taskFilters[key] === undefined) {
          delete taskFilters[key];
        }
      });

      // Reset pagination if not loading more
      if (!loadMore) {
        setLastDoc(null);
        setPageHistory([]);
        setCurrentPage(1);
        setPageCursors([null]); // Reset page cursors
      }

      console.log(
        "Loading tasks with filters:",
        taskFilters,
        "pageSize:",
        currentPageSize
      );
      // Get tasks with pagination
      const result = await getAllTasks(taskFilters, {
        pageSize: currentPageSize,
        lastDoc: loadMore && lastDoc ? lastDoc : undefined,
      });

      let fetchedTasks = result.tasks;
      console.log("Fetched tasks:", fetchedTasks.length, fetchedTasks);

      // Apply user-based filtering
      if (!isAdmin) {
        if (filterByMe && user) {
          // If "Filter by my tasks" is enabled, filter by assignedUserId
          fetchedTasks = fetchedTasks.filter(
            (task) => task.assignedUserId === user.uid
          );
          console.log(
            "Filtered by assigned user:",
            fetchedTasks.length,
            fetchedTasks
          );
        } else if (!filterByMe && !showAllTasks && userProfile?.userType) {
          // If both checkboxes are disabled, show only tasks from users with the same type
          fetchedTasks = fetchedTasks.filter(
            (task) => task.userIdType === userProfile.userType
          );
          console.log(
            "Filtered by user type:",
            userProfile.userType,
            fetchedTasks.length,
            fetchedTasks
          );
        }
      }

      // Filter by panel if project is selected and a specific panel is chosen (not "All Panels")
      // Note: This filter is applied after projectId filter from getAllTasks, so we only need to check panel
      if (filters.projectId && filters.panel && filters.panel.trim() !== "") {
        const beforePanelFilter = fetchedTasks.length;
        fetchedTasks = fetchedTasks.filter((t) => {
          // Match tasks that have the same panel
          // Tasks without a panel field (undefined) won't match a specific panel
          return t.panel === filters.panel;
        });
        console.log("Panel filter applied:", {
          panel: filters.panel,
          projectId: filters.projectId,
          before: beforePanelFilter,
          after: fetchedTasks.length,
        });
      }

      // Sort tasks by createdAt (latest created first)
      fetchedTasks.sort((a, b) => {
        const aTime =
          a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime();
        const bTime =
          b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime();
        return bTime - aTime; // Descending - newest first
      });

      // Always replace tasks for true pagination (each page shows only its own tasks)
      setTasks(fetchedTasks);

      const newLastDoc = result.lastDoc
        ? (result.lastDoc as QueryDocumentSnapshot<DocumentData>)
        : null;
      setLastDoc(newLastDoc);
      setHasMore(result.hasMore);

      // Update page cursors for backward navigation
      // pageCursors structure:
      // pageCursors[0] = null (always, for page 1)
      // pageCursors[1] = lastDoc from page 1 (cursor to load page 2)
      // pageCursors[2] = lastDoc from page 2 (cursor to load page 3)
      // So pageCursors[N] = cursor to load page (N+1)
      setPageCursors((prev) => {
        const updated = [...prev];
        // Ensure array starts with null for page 1
        if (updated.length === 0) {
          updated[0] = null;
        }
        // Store the cursor for the next page
        // After loading page N, store lastDoc in pageCursors[N] (to load page N+1)
        if (newLastDoc) {
          updated[currentPage] = newLastDoc;
        }
        return updated;
      });
    } catch (error: any) {
      console.error("Error loading tasks:", error);
      console.error(
        "Error details:",
        error?.message,
        error?.code,
        error?.stack
      );
      alert(`Error loading tasks: ${error?.message || "Unknown error"}`);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Add function to load next page
  const loadNextPage = () => {
    if (hasMore && !loading && lastDoc) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      setPageHistory((prev) => [...prev, lastDoc!]);
      // Note: Cursor for next page will be stored in loadTasks after loading
      loadTasks(true);
    }
  };

  // Add function to load previous page
  const loadPreviousPage = () => {
    if (currentPage > 1) {
      const targetPage = currentPage - 1;

      if (targetPage === 1) {
        // Going back to page 1 - reset and load from beginning
        // loadTasks(false) will reset all pagination state, so we just need to call it
        loadTasks(false);
      } else {
        // Going back to a page other than 1
        // To load page N, we use pageCursors[N-1]
        // pageCursors[0] = null (for page 1)
        // pageCursors[1] = cursor to load page 2
        // pageCursors[2] = cursor to load page 3
        // So to load targetPage, use pageCursors[targetPage - 1]
        const cursorToUse = targetPage > 1 ? pageCursors[targetPage - 1] : null;

        if (cursorToUse !== undefined) {
          // Update state for the target page
          setCurrentPage(targetPage);
          setLastDoc(cursorToUse);
          // Update pageHistory to reflect pages up to target
          setPageHistory((prev) => prev.slice(0, targetPage - 1));

          // Load tasks using the cursor
          loadTasks(true);
        } else {
          // Fallback: reload from beginning
          setLastDoc(null);
          setPageHistory([]);
          setCurrentPage(1);
          setPageCursors([null]);
          loadTasks(false);
        }
      }
    }
  };

  // Handle page size change
  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setLastDoc(null);
    setPageHistory([]);
    setCurrentPage(1);
    // Reload tasks with new page size immediately
    loadTasks(false, newPageSize);
  };

  const handleStatusChange = async (
    taskId: string,
    newStatus: TaskStatus,
    task: Task
  ) => {
    // Only allow status change for own tasks or tasks assigned to you
    if (!canEditTask(task)) {
      alert(
        "You can only change the status of your own tasks or tasks assigned to you"
      );
      return;
    }

    // If status is being changed to "Completed", show version modal
    if (newStatus === "Completed") {
      setTaskForVersion(task);
      setVersionInput(task.version || ""); // Pre-fill with existing version if any
      setShowVersionModal(true);
      return;
    }

    // For other status changes, update directly
    try {
      setUpdatingStatus(taskId);
      await updateTask(
        taskId,
        { status: newStatus },
        user
          ? {
              uid: user.uid,
              email: user.email || undefined,
              username: userProfile?.username || undefined,
            }
          : undefined
      );

      // Update local state instead of reloading all tasks
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, status: newStatus } : t
        )
      );
    } catch (error) {
      console.error("Error updating task status:", error);
      alert("Failed to update task status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Generate Excel report
  const generateExcelReport = async () => {
    if (!user) return;

    setExporting(true);
    try {
      // Fetch dropdown options
      const [userTypes, statuses, users] = await Promise.all([
        getUserTypes(),
        getTaskStatuses(),
        getAllUsers(),
      ]);

      // Fetch tasks for export
      const taskFilters: any = {
        projectId: exportProjectId || undefined,
      };

      // Remove undefined values
      Object.keys(taskFilters).forEach((key) => {
        if (taskFilters[key] === undefined) {
          delete taskFilters[key];
        }
      });

      // Fetch tasks with a higher limit to get the last N tasks
      const fetchLimit = Math.max(exportTaskLimit, 100); // Fetch more to ensure we get enough
      const result = await getAllTasks(taskFilters, {
        pageSize: fetchLimit,
      });

      let exportTasks = result.tasks;

      // Sort by createdAt descending (newest first) and take last N
      exportTasks.sort((a, b) => {
        const aTime =
          a.createdAt instanceof Date
            ? a.createdAt.getTime()
            : new Date(a.createdAt).getTime();
        const bTime =
          b.createdAt instanceof Date
            ? b.createdAt.getTime()
            : new Date(b.createdAt).getTime();
        return bTime - aTime; // Descending
      });

      // Take the last N tasks (most recent)
      exportTasks = exportTasks.slice(0, exportTaskLimit);

      // Prepare data for Excel
      const excelData = exportTasks.map((task) => {
        const date =
          task.createdAt instanceof Date
            ? task.createdAt.toLocaleDateString()
            : new Date(task.createdAt).toLocaleDateString();

        return {
          Date: date,
          Task: task.title,
          Type: task.userIdType || "N/A",
          Version: task.version || "N/A",
          "No of Hours": task.estimatedTime || "N/A",
          "Assigned To":
            task.assignedUserUsername ||
            task.assignedUserEmail ||
            task.assignedUserId ||
            "Unassigned",
          Status: task.status,
        };
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 30 }, // Task
        { wch: 15 }, // Type
        { wch: 12 }, // Version
        { wch: 15 }, // No of Hours
        { wch: 20 }, // Assigned To
        { wch: 12 }, // Status
      ];
      ws["!cols"] = colWidths;

      // Prepare dropdown options
      // Type column (column C, index 2)
      const typeOptions =
        userTypes.length > 0
          ? userTypes.join(",")
          : "frontend,backend,designer";
      // Status column (column G, index 6)
      const statusOptions =
        statuses.length > 0 ? statuses.join(",") : "Pending,Completed,Deleted";
      // Assigned To column (column F, index 5)
      const assignedToOptions = users
        .filter((u) => u.email?.toLowerCase() !== "admin@gmail.com")
        .map((u) => u.username || u.email || u.uid)
        .concat("Unassigned")
        .join(",");

      // Add data validation (dropdowns) to data rows
      // Column mapping: A=Date(0), B=Task(1), C=Type(2), D=Version(3), E=No of Hours(4), F=Assigned To(5), G=Status(6)
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

      // Apply validation to all data rows (skip header row 0)
      for (let row = 1; row <= range.e.r; row++) {
        // Type column (C) - column index 2
        const typeCell = XLSX.utils.encode_cell({ r: row, c: 2 });
        if (!ws[typeCell]) ws[typeCell] = { t: "s", v: "" };
        ws[typeCell].dv = {
          type: "list",
          formula1: `"${typeOptions}"`,
          showDropDown: true,
        };

        // Status column (G) - column index 6
        const statusCell = XLSX.utils.encode_cell({ r: row, c: 6 });
        if (!ws[statusCell]) ws[statusCell] = { t: "s", v: "" };
        ws[statusCell].dv = {
          type: "list",
          formula1: `"${statusOptions}"`,
          showDropDown: true,
        };

        // Assigned To column (F) - column index 5
        const assignedToCell = XLSX.utils.encode_cell({ r: row, c: 5 });
        if (!ws[assignedToCell]) ws[assignedToCell] = { t: "s", v: "" };
        ws[assignedToCell].dv = {
          type: "list",
          formula1: `"${assignedToOptions}"`,
          showDropDown: true,
        };
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Tasks");

      // Generate filename
      const projectName = exportProjectId
        ? projects.find((p) => p.id === exportProjectId)?.name || "AllProjects"
        : "AllProjects";
      const filename = `Tasks_${projectName}_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);

      // Close modal
      setShowExportModal(false);
      setExportProjectId("");
      setExportTaskLimit(10);
      alert(
        `Excel report generated successfully! ${exportTasks.length} task(s) exported with dropdown validation.`
      );
    } catch (error: any) {
      console.error("Error generating Excel report:", error);
      alert(
        `Failed to generate Excel report: ${error.message || "Unknown error"}`
      );
    } finally {
      setExporting(false);
    }
  };

  // Handle version submission when completing a task
  const handleVersionSubmit = async (skipVersion = false) => {
    if (!taskForVersion) return;

    if (!skipVersion && !versionInput.trim()) {
      alert(
        "Please enter a version number or click 'Complete without version'"
      );
      return;
    }

    try {
      setUpdatingStatus(taskForVersion.id);
      const updateData: { status: "Completed"; version?: string } = {
        status: "Completed",
      };

      // Only add version if provided
      if (!skipVersion && versionInput.trim()) {
        updateData.version = versionInput.trim();
      }

      await updateTask(
        taskForVersion.id,
        updateData,
        user
          ? {
              uid: user.uid,
              email: user.email || undefined,
              username: userProfile?.username || undefined,
            }
          : undefined
      );

      // Update local state
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskForVersion.id
            ? {
                ...t,
                status: "Completed",
                version: skipVersion
                  ? t.version
                  : versionInput.trim() || t.version,
              }
            : t
        )
      );

      // Close modal and reset
      setShowVersionModal(false);
      setTaskForVersion(null);
      setVersionInput("");
    } catch (error) {
      console.error("Error updating task with version:", error);
      alert("Failed to update task");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDelete = async (task: Task) => {
    if (!canEditTask(task)) {
      alert("You can only delete your own tasks or tasks assigned to you");
      return;
    }

    if (confirm("Are you sure you want to delete this task?")) {
      try {
        await deleteTask(task.id);
        loadTasks();
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    }
  };

  const handleChangeAssignedUser = async (task: Task, newUserId: string) => {
    if (!newUserId) return;

    try {
      setUpdatingAssignedUser(task.id);
      const assignedUser = allUsers.find((u) => u.uid === newUserId);
      if (!assignedUser) {
        console.error("Selected user not found");
        setUpdatingAssignedUser(null);
        return;
      }

      await updateTask(
        task.id,
        {
          assignedUserId: assignedUser.uid,
          assignedUserEmail: assignedUser.email,
          assignedUserUsername: assignedUser.username,
        },
        user
          ? {
              uid: user.uid,
              email: user.email || undefined,
              username: userProfile?.username || undefined,
            }
          : undefined
      );

      // Update local state instead of reloading all tasks
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                assignedUserId: assignedUser.uid,
                assignedUserEmail: assignedUser.email,
                assignedUserUsername: assignedUser.username,
              }
            : t
        )
      );
    } catch (error) {
      console.error("Error changing assigned user:", error);
      alert("Failed to change assigned user");
    } finally {
      setUpdatingAssignedUser(null);
    }
  };

  const canEditTask = (task: Task) => {
    if (!user) return false;

    // If task is assigned to someone else (and not to the owner), only the assigned user can edit
    if (task.assignedUserId && task.assignedUserId !== task.userId) {
      // Task is assigned to someone else - only the assigned user can edit
      return task.assignedUserId === user.uid;
    }

    // If task is not assigned or assigned to owner, owner can edit
    // Or if user is the assigned user, they can edit
    return task.userId === user.uid || task.assignedUserId === user.uid;
  };

  const resetFilters = () => {
    const newFilters = {
      status: "" as TaskStatus | "",
      projectId: "",
      fromDate: "",
      toDate: "",
      search: "",
      userId: "",
      panel: "",
    };
    setFilters(newFilters);
    // Reset to default filter (by user for non-admin)
    const isAdmin = user?.email?.toLowerCase() === "admin@gmail.com";
    const newFilterByMe = !isAdmin;
    const newShowAllTasks = false;
    setFilterByMe(newFilterByMe);
    setShowAllTasks(newShowAllTasks);
    setSelectedTasks(new Set());
    // Clear URL params
    router.replace(pathname, { scroll: false });
  };

  // Handle task selection
  const toggleTaskSelection = (taskId: string) => {
    const newSelection = new Set(selectedTasks);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTasks(newSelection);
  };

  // Select all visible tasks
  const selectAllTasks = () => {
    setSelectedTasks(new Set(tasks.map((t) => t.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTasks(new Set());
  };

  // Handle bulk version update
  const handleBulkVersionUpdate = async () => {
    if (selectedTasks.size === 0 || !bulkVersion.trim()) {
      alert("Please select tasks and enter a version");
      return;
    }

    const selectedTaskObjects = tasks.filter((t) => selectedTasks.has(t.id));

    // Validate: all tasks must be from same project
    const projectIds = new Set(selectedTaskObjects.map((t) => t.projectId));
    if (projectIds.size > 1) {
      alert("All selected tasks must be from the same project");
      return;
    }

    // Validate: all tasks must be from same panel (if panels exist)
    const panels = new Set(
      selectedTaskObjects.map((t) => t.panel || "").filter((p) => p)
    );
    if (panels.size > 1) {
      alert("All selected tasks must be from the same panel");
      return;
    }

    setUpdatingVersions(true);
    try {
      const updatePromises = Array.from(selectedTasks).map((taskId) => {
        return updateTask(
          taskId,
          { version: bulkVersion.trim() },
          user
            ? {
                uid: user.uid,
                email: user.email || undefined,
                username: userProfile?.username || undefined,
              }
            : undefined
        );
      });

      await Promise.all(updatePromises);

      // Update local state
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          selectedTasks.has(task.id)
            ? { ...task, version: bulkVersion.trim() }
            : task
        )
      );

      const selectedCount = selectedTasks.size;
      setSelectedTasks(new Set());
      setShowBulkVersion(false);
      setBulkVersion("");
      alert(`Version updated for ${selectedCount} task(s)`);
    } catch (error: any) {
      console.error("Error updating versions:", error);
      alert(`Error updating versions: ${error.message || "Unknown error"}`);
    } finally {
      setUpdatingVersions(false);
    }
  };

  // Check if rearrange mode should be available
  // Only show when: showAllTasks is enabled, no user filter, and a specific project is selected
  const canRearrange =
    showAllTasks && !filters.userId && filters.projectId !== "";

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTasks((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newTasks = arrayMove(items, oldIndex, newIndex);

        // Update order for all tasks
        const updatePromises = newTasks.map((task, index) => {
          if (task.order !== index) {
            return updateTask(
              task.id,
              { order: index },
              user
                ? {
                    uid: user.uid,
                    email: user.email || undefined,
                    username: userProfile?.username || undefined,
                  }
                : undefined
            ).catch((error) => {
              console.error(`Error updating task ${task.id} order:`, error);
              return null;
            });
          }
          return Promise.resolve(null);
        });

        // Update orders in background (non-blocking)
        Promise.all(updatePromises).catch((error) => {
          console.error("Error updating task orders:", error);
        });

        return newTasks;
      });
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-800";
      case "Deleted":
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-2xl font-bold text-gray-800">All Tasks</h2>
          {canRearrange && (
            <button
              onClick={() => setRearrangeMode(!rearrangeMode)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                rearrangeMode
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {rearrangeMode ? "Done Rearranging" : "Rearrange Tasks"}
            </button>
          )}
          {selectedTasks.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {selectedTasks.size} task(s) selected
              </span>
              <button
                onClick={() => setShowBulkVersion(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                Add Version
              </button>
              <button
                onClick={clearSelection}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Clear
              </button>
            </div>
          )}
          {user && user.email?.toLowerCase() !== "admin@gmail.com" && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterByMe}
                  onChange={(e) => {
                    setFilterByMe(e.target.checked);
                    if (e.target.checked) {
                      setShowAllTasks(false);
                      setFilters({ ...filters, userId: "" });
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">
                  Filter by my tasks
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllTasks}
                  onChange={(e) => {
                    setShowAllTasks(e.target.checked);
                    if (e.target.checked) {
                      setFilterByMe(false);
                    } else {
                      setFilters({ ...filters, userId: "", panel: "" });
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Show all tasks</span>
              </label>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setEditingTask(null);
              setShowForm(true);
            }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            + New Task
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            📊 Export to Excel
          </button>
        </div>
      </div>

      <TaskFormModal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingTask(null);
        }}
        title={editingTask ? "Edit Task" : "Add Task"}
      >
        <TaskForm
          task={editingTask || undefined}
          projects={projects}
          onSuccess={() => {
            setShowForm(false);
            setEditingTask(null);
            loadTasks();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
          onProjectCreated={() => {
            onProjectCreated();
            loadTasks();
          }}
        />
      </TaskFormModal>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div
          className={`grid grid-cols-1 ${
            showAllTasks ? "md:grid-cols-6" : "md:grid-cols-5"
          } gap-4`}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
              placeholder="Search tasks..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value as TaskStatus | "",
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All</option>
              {availableStatuses.map((statusOption: string) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={filters.projectId}
              onChange={(e) => {
                setFilters({
                  ...filters,
                  projectId: e.target.value,
                  panel: "",
                });
                setSelectedTasks(new Set()); // Clear selection when project changes
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Projects</option>
              {projects
                .filter((project) => project.status === "active")
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>
          {filters.projectId &&
            (() => {
              const selectedProject = projects.find(
                (p) => p.id === filters.projectId
              );
              const projectPanels = selectedProject?.panels || [];
              if (projectPanels.length > 0) {
                return (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Panel
                    </label>
                    <select
                      value={filters.panel}
                      onChange={(e) => {
                        setFilters({ ...filters, panel: e.target.value });
                        setSelectedTasks(new Set()); // Clear selection when panel changes
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">All Panels</option>
                      {projectPanels.map((panelName) => (
                        <option key={panelName} value={panelName}>
                          {panelName}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })()}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) =>
                setFilters({ ...filters, fromDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) =>
                setFilters({ ...filters, toDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {showAllTasks && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User
              </label>
              <select
                value={filters.userId}
                onChange={(e) =>
                  setFilters({ ...filters, userId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Users</option>
                {allUsers
                  .filter((u) => u.email?.toLowerCase() !== "admin@gmail.com")
                  .map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.username || u.email}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
        <div className="mt-4">
          <button
            onClick={resetFilters}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Bulk Version Update Modal */}
      {showBulkVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              Add Version to {selectedTasks.size} Task(s)
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Version *
                </label>
                <input
                  type="text"
                  value={bulkVersion}
                  onChange={(e) => setBulkVersion(e.target.value)}
                  placeholder="e.g., v1.1.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkVersionUpdate}
                  disabled={updatingVersions || !bulkVersion.trim()}
                  className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingVersions ? "Updating..." : "Update Version"}
                </button>
                <button
                  onClick={() => {
                    setShowBulkVersion(false);
                    setBulkVersion("");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      {loading ? (
        <div className="text-center py-8">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No tasks found</div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={selectAllTasks}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Select All
              </button>
              {selectedTasks.size > 0 && (
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
          <DndContext
            sensors={rearrangeMode ? sensors : []}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {tasks.map((task) => {
                  const isExpanded = expandedTasks.has(task.id);
                  return (
                    <SortableTaskItem
                      key={task.id}
                      task={task}
                      isExpanded={isExpanded}
                      rearrangeMode={rearrangeMode}
                      user={user}
                      userProfile={userProfile}
                      allUsers={allUsers}
                      availableStatuses={availableStatuses}
                      canEditTask={canEditTask}
                      getStatusColor={getStatusColor}
                      updatingAssignedUser={updatingAssignedUser}
                      updatingStatus={updatingStatus}
                      onExpandToggle={(taskId) => {
                        const newExpanded = new Set(expandedTasks);
                        if (newExpanded.has(taskId)) {
                          newExpanded.delete(taskId);
                        } else {
                          newExpanded.add(taskId);
                        }
                        setExpandedTasks(newExpanded);
                      }}
                      isSelected={selectedTasks.has(task.id)}
                      onSelect={toggleTaskSelection}
                      onStatusChange={handleStatusChange}
                      onAssignedUserChange={handleChangeAssignedUser}
                      onEdit={(task) => {
                        setEditingTask(task);
                        setShowForm(true);
                      }}
                      onDelete={handleDelete}
                      onViewHistory={(task) => {
                        setSelectedTaskForHistory(task);
                        setHistoryModalOpen(true);
                      }}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </>
      )}

      {historyModalOpen && selectedTaskForHistory && (
        <TaskHistoryModal
          taskId={selectedTaskForHistory.id}
          taskTitle={selectedTaskForHistory.title}
          isOpen={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setSelectedTaskForHistory(null);
          }}
        />
      )}

      {/* Version Modal for Completing Tasks */}
      <TaskFormModal
        isOpen={showVersionModal}
        onClose={() => {
          setShowVersionModal(false);
          setTaskForVersion(null);
          setVersionInput("");
        }}
        title="Complete Task - Add Version"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Task:{" "}
              <span className="font-semibold">{taskForVersion?.title}</span>
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Please enter a version number for this completed task (e.g.,
              v1.0.0, v1.1.1)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Version <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={versionInput}
              onChange={(e) => setVersionInput(e.target.value)}
              placeholder="e.g., v1.0.0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleVersionSubmit();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setShowVersionModal(false);
                setTaskForVersion(null);
                setVersionInput("");
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleVersionSubmit(true)}
              disabled={updatingStatus === taskForVersion?.id}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updatingStatus === taskForVersion?.id
                ? "Updating..."
                : "Complete without version"}
            </button>
            <button
              onClick={() => handleVersionSubmit(false)}
              disabled={
                !versionInput.trim() || updatingStatus === taskForVersion?.id
              }
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updatingStatus === taskForVersion?.id
                ? "Updating..."
                : "Complete Task"}
            </button>
          </div>
        </div>
      </TaskFormModal>

      {/* Excel Export Modal */}
      <TaskFormModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setExportProjectId("");
          setExportTaskLimit(10);
        }}
        title="Export Tasks to Excel"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project Filter
            </label>
            <select
              value={exportProjectId}
              onChange={(e) => setExportProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Projects</option>
              {projects
                .filter((project) => project.status === "active")
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Number of Tasks (Last N tasks)
            </label>
            <input
              type="number"
              value={exportTaskLimit}
              onChange={(e) => setExportTaskLimit(Number(e.target.value) || 10)}
              min={1}
              max={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., 10"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the number of most recent tasks to export (e.g., 10 = last
              10 tasks)
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Columns included:</strong> Date, Task, Type, Version, No
              of Hours, Assigned To, Status
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setShowExportModal(false);
                setExportProjectId("");
                setExportTaskLimit(10);
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={generateExcelReport}
              disabled={exporting || exportTaskLimit < 1}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? "Generating..." : "Generate & Download"}
            </button>
          </div>
        </div>
      </TaskFormModal>

      {/* Pagination Controls */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Showing {tasks.length} task{tasks.length !== 1 ? "s" : ""} on page{" "}
              {currentPage}
              {hasMore && " (more available)"}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Items per page:</label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={loading}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadPreviousPage}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-600 font-medium">
              Page {currentPage}
            </span>
            <button
              onClick={loadNextPage}
              disabled={!hasMore || loading}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
