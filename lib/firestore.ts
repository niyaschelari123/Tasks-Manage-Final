import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  Timestamp,
  orderBy,
  setDoc,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  writeBatch,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "./firebase";
import {
  Task,
  Project,
  TaskStatus,
  UserProfile,
  UserType,
  UserStatus,
  ProjectStatus,
  TaskHistory,
  HistoryAction,
  Notification,
  ImportantItem,
} from "@/types";

// Helper function to remove undefined values from object (recursive for nested objects)
function removeUndefinedFields(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Don't process Date, Timestamp, or other non-object types
  if (obj instanceof Date || obj?.toDate || typeof obj !== "object") {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj
      .map((item) => removeUndefinedFields(item))
      .filter((item) => item !== undefined);
  }

  // Handle objects recursively
  const cleaned: any = {};
  for (const key in obj) {
    const value = obj[key];
    if (value !== undefined) {
      // Recursively clean nested objects
      cleaned[key] = removeUndefinedFields(value);
    }
  }
  return cleaned;
}

// Helper function to convert Date objects to Timestamps recursively
function convertDatesToTimestamps(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return Timestamp.fromDate(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertDatesToTimestamps(item));
  }

  if (typeof obj === "object") {
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertDatesToTimestamps(obj[key]);
    }
    return converted;
  }

  return obj;
}

// Tasks
export async function createTask(
  task: Omit<Task, "id" | "createdAt" | "updatedAt">,
  userInfo?: { uid: string; email?: string; username?: string }
) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const taskData = removeUndefinedFields({
    ...task,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  const docRef = await addDoc(collection(db, "tasks"), taskData);

  // Log creation history (non-blocking)
  if (userInfo) {
    try {
      await addTaskHistory(
        docRef.id,
        "created",
        userInfo.uid,
        userInfo.email,
        userInfo.username,
        undefined,
        undefined,
        undefined,
        `Task "${task.title}" was created`
      );
    } catch (error) {
      console.error("Failed to log task creation history:", error);
      // Don't throw - history logging should not block task creation
    }
  }

  return docRef.id;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Task>,
  userInfo?: { uid: string; email?: string; username?: string }
) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const taskRef = doc(db, "tasks", taskId);

  try {
    // Get current task data to compare changes
    const currentTaskDoc = await getDoc(taskRef);
    const currentTask = currentTaskDoc.data() as Task | undefined;

    // Convert Date objects to Timestamps and remove undefined fields
    const cleanedUpdates = removeUndefinedFields(
      convertDatesToTimestamps({
        ...updates,
        updatedAt: Timestamp.now(),
      })
    );

    console.log("updateTask - cleaned updates:", cleanedUpdates);
    await updateDoc(taskRef, cleanedUpdates);

    // Log history for changes (non-blocking)
    if (userInfo && currentTask) {
      try {
        // Track status changes
        if (updates.status && updates.status !== currentTask.status) {
          await addTaskHistory(
            taskId,
            "status_changed",
            userInfo.uid,
            userInfo.email,
            userInfo.username,
            currentTask.status,
            updates.status,
            "status",
            `Status changed from "${currentTask.status}" to "${updates.status}"`
          );
        }

        // Track assigned user changes
        if (
          updates.assignedUserId &&
          updates.assignedUserId !== currentTask.assignedUserId
        ) {
          const oldUser =
            currentTask.assignedUserUsername ||
            currentTask.assignedUserEmail ||
            currentTask.assignedUserId ||
            "Unassigned";
          const newUser =
            updates.assignedUserUsername ||
            updates.assignedUserEmail ||
            updates.assignedUserId ||
            "Unassigned";
          await addTaskHistory(
            taskId,
            "assigned_user_changed",
            userInfo.uid,
            userInfo.email,
            userInfo.username,
            oldUser,
            newUser,
            "assignedUserId",
            `Assigned user changed from "${oldUser}" to "${newUser}"`
          );
        }

        // Track title changes
        if (updates.title && updates.title !== currentTask.title) {
          await addTaskHistory(
            taskId,
            "title_changed",
            userInfo.uid,
            userInfo.email,
            userInfo.username,
            currentTask.title,
            updates.title,
            "title",
            `Title changed from "${currentTask.title}" to "${updates.title}"`
          );
        }

        // Track description changes
        if (
          updates.description !== undefined &&
          updates.description !== currentTask.description
        ) {
          await addTaskHistory(
            taskId,
            "description_changed",
            userInfo.uid,
            userInfo.email,
            userInfo.username,
            currentTask.description || "",
            updates.description || "",
            "description",
            "Description was updated"
          );
        }

        // Track project changes
        if (updates.projectId && updates.projectId !== currentTask.projectId) {
          await addTaskHistory(
            taskId,
            "project_changed",
            userInfo.uid,
            userInfo.email,
            userInfo.username,
            currentTask.projectName,
            updates.projectName || "",
            "projectId",
            `Project changed from "${currentTask.projectName}" to "${
              updates.projectName || ""
            }"`
          );
        }

        // Track version changes
        if (
          updates.version !== undefined &&
          updates.version !== currentTask.version
        ) {
          const oldVersion = currentTask.version || "None";
          const newVersion = updates.version || "None";
          await addTaskHistory(
            taskId,
            "version_changed",
            userInfo.uid,
            userInfo.email,
            userInfo.username,
            oldVersion,
            newVersion,
            "version",
            `Version changed from "${oldVersion}" to "${newVersion}"`
          );
        }

        // Log general update if no specific field was tracked
        if (
          !updates.status &&
          !updates.assignedUserId &&
          !updates.title &&
          updates.description === undefined &&
          !updates.projectId &&
          updates.version === undefined
        ) {
          await addTaskHistory(
            taskId,
            "updated",
            userInfo.uid,
            userInfo.email,
            userInfo.username,
            undefined,
            undefined,
            undefined,
            "Task was updated"
          );
        }
      } catch (error) {
        console.error("Failed to log task update history:", error);
        // Don't throw - history logging should not block task updates
      }
    }
  } catch (error: any) {
    console.error("Error in updateTask:", error);
    console.error("Error message:", error?.message);
    console.error("Error code:", error?.code);
    throw error;
  }
}

export async function deleteTask(taskId: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  const taskRef = doc(db, "tasks", taskId);
  await deleteDoc(taskRef);
}

export async function deleteAllTasks() {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const tasksRef = collection(db, "tasks");
    const snapshot = await getDocs(tasksRef);

    const deletePromises = snapshot.docs.map((docSnapshot) => {
      if (!db) throw new Error("Firestore is not initialized");
      return deleteDoc(doc(db, "tasks", docSnapshot.id));
    });

    await Promise.all(deletePromises);

    // Also delete all task history
    const historyRef = collection(db, "taskHistory");
    const historySnapshot = await getDocs(historyRef);

    const deleteHistoryPromises = historySnapshot.docs.map((docSnapshot) => {
      if (!db) throw new Error("Firestore is not initialized");
      return deleteDoc(doc(db, "taskHistory", docSnapshot.id));
    });

    await Promise.all(deleteHistoryPromises);

    return {
      tasksDeleted: snapshot.docs.length,
      historyDeleted: historySnapshot.docs.length,
    };
  } catch (error: any) {
    console.error("Error deleting all tasks:", error);
    throw error;
  }
}

export async function getTasks(
  userId: string,
  filters?: {
    status?: TaskStatus;
    projectId?: string;
    fromDate?: Date;
    toDate?: Date;
    search?: string;
  }
) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  let tasks: Task[] = [];

  try {
    // Try query with orderBy first (requires index)
    let q = query(
      collection(db, "tasks"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    tasks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Task[];
  } catch (error: any) {
    // If index is missing, fall back to query without orderBy
    if (
      error.code === "failed-precondition" ||
      error.message?.includes("index")
    ) {
      console.warn("Index not found, using fallback query without orderBy");
      const fallbackQuery = query(
        collection(db, "tasks"),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(fallbackQuery);
      tasks = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Task[];
      // Sort manually in memory
      tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      console.error("Error fetching tasks:", error);
      throw error;
    }
  }

  // Apply filters
  if (filters) {
    if (filters.status) {
      tasks = tasks.filter((t) => t.status === filters.status);
    }
    if (filters.projectId) {
      tasks = tasks.filter((t) => t.projectId === filters.projectId);
    }
    if (filters.fromDate) {
      tasks = tasks.filter((t) => t.createdAt >= filters.fromDate!);
    }
    if (filters.toDate) {
      tasks = tasks.filter((t) => t.createdAt <= filters.toDate!);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower)
      );
    }
  }

  return tasks;
}

// Get all tasks (for viewing all tasks) with pagination support
export async function getAllTasks(
  filters?: {
  status?: TaskStatus;
  projectId?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  userId?: string; // Optional filter by user
    panel?: string; // Optional filter by panel
    version?: string; // Optional filter by version
  },
  pagination?: {
    pageSize?: number;
    lastDoc?: QueryDocumentSnapshot<DocumentData>;
  }
) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  let tasks: Task[] = [];
  const pageSize = pagination?.pageSize || 50; // Default 50 tasks per page

  try {
    // Build query with filters
    let q: any = query(collection(db, "tasks"));

    // Add Firestore where clauses for filters that can be queried
    if (filters?.projectId) {
      q = query(q, where("projectId", "==", filters.projectId));
    }
    if (filters?.status) {
      q = query(q, where("status", "==", filters.status));
    }
    if (filters?.userId) {
      q = query(q, where("userId", "==", filters.userId));
    }

    // Add orderBy and limit
    try {
      q = query(q, orderBy("createdAt", "desc"), limit(pageSize));

      // Add pagination cursor
      if (pagination?.lastDoc) {
        q = query(q, startAfter(pagination.lastDoc));
      }

    const snapshot = await getDocs(q);
      const lastVisible = snapshot.docs[snapshot.docs.length - 1];

    tasks = snapshot.docs.map((doc) => {
        const data = doc.data() as any;
      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate()
        : data.createdAt instanceof Date
        ? data.createdAt
        : data.createdAt
        ? new Date(data.createdAt)
        : new Date();
      const updatedAt = data.updatedAt?.toDate
        ? data.updatedAt.toDate()
        : data.updatedAt instanceof Date
        ? data.updatedAt
        : data.updatedAt
        ? new Date(data.updatedAt)
        : new Date();
      return {
        id: doc.id,
        ...data,
        createdAt,
        updatedAt,
        } as Task;
      });

      // Apply client-side filters that can't be done in Firestore
      if (filters) {
        if (filters.fromDate) {
          tasks = tasks.filter((t) => t.createdAt >= filters.fromDate!);
        }
        if (filters.toDate) {
          tasks = tasks.filter((t) => t.createdAt <= filters.toDate!);
        }
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          tasks = tasks.filter(
            (t) =>
              t.title.toLowerCase().includes(searchLower) ||
              t.description?.toLowerCase().includes(searchLower)
          );
        }
        if (filters.panel) {
          tasks = tasks.filter((t) => t.panel === filters.panel);
        }
        if (filters.version) {
          tasks = tasks.filter((t) => t.version === filters.version);
        }
      }

      return {
        tasks,
        lastDoc: lastVisible,
        hasMore: snapshot.docs.length === pageSize,
      };
    } catch (indexError: any) {
      // Fallback if index doesn't exist - fetch all and filter in memory
      if (
        indexError?.code === "failed-precondition" ||
        indexError?.message?.includes("index")
      ) {
        console.warn("Index not found, using fallback query without orderBy");
        let fallbackQuery: any = query(
          collection(db, "tasks"),
          limit(pageSize * 2)
        ); // Fetch more to account for filtering

        const snapshot = await getDocs(fallbackQuery);
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];

        tasks = snapshot.docs.map((doc) => {
          const data = doc.data() as any;
          const createdAt = data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.createdAt instanceof Date
            ? data.createdAt
            : data.createdAt
            ? new Date(data.createdAt)
            : new Date();
          const updatedAt = data.updatedAt?.toDate
            ? data.updatedAt.toDate()
            : data.updatedAt instanceof Date
            ? data.updatedAt
            : data.updatedAt
            ? new Date(data.updatedAt)
            : new Date();
          return {
            id: doc.id,
            ...data,
            createdAt,
            updatedAt,
          } as Task;
        });

    // Sort manually in memory by createdAt descending
    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        // Apply all filters in memory
  if (filters) {
    if (filters.userId) {
      tasks = tasks.filter((t) => t.userId === filters.userId);
    }
    if (filters.status) {
      tasks = tasks.filter((t) => t.status === filters.status);
    }
    if (filters.projectId) {
      tasks = tasks.filter((t) => t.projectId === filters.projectId);
    }
    if (filters.fromDate) {
      tasks = tasks.filter((t) => t.createdAt >= filters.fromDate!);
    }
    if (filters.toDate) {
      tasks = tasks.filter((t) => t.createdAt <= filters.toDate!);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower)
      );
    }
          if (filters.panel) {
            tasks = tasks.filter((t) => t.panel === filters.panel);
          }
          if (filters.version) {
            tasks = tasks.filter((t) => t.version === filters.version);
          }
        }

        // For fallback without proper pagination support, return all filtered tasks
        // This is a limitation when indexes don't exist
        const paginatedTasks = tasks.slice(0, pageSize);

        return {
          tasks: paginatedTasks,
          lastDoc: lastVisible,
          hasMore: tasks.length > pageSize,
        };
      }
      throw indexError;
    }
  } catch (error: any) {
    console.error("Error fetching all tasks:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    throw error;
  }
}

// Projects
export async function createProject(
  project: Omit<Project, "id" | "createdAt">
) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const projectData = removeUndefinedFields({
    ...project,
    createdAt: Timestamp.now(),
  });
  const docRef = await addDoc(collection(db, "projects"), projectData);
  return docRef.id;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Project>
) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const projectRef = doc(db, "projects", projectId);
  const cleanedUpdates = removeUndefinedFields(updates);
  await updateDoc(projectRef, cleanedUpdates);
}

export async function deleteAllProjects() {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const projectsRef = collection(db, "projects");
    const snapshot = await getDocs(projectsRef);

    const deletePromises = snapshot.docs.map((docSnapshot) => {
      if (!db) throw new Error("Firestore is not initialized");
      return deleteDoc(doc(db, "projects", docSnapshot.id));
    });

    await Promise.all(deletePromises);

    return { projectsDeleted: snapshot.docs.length };
  } catch (error: any) {
    console.error("Error deleting all projects:", error);
    throw error;
  }
}

export async function getProjects(userId?: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    // Get all projects (everyone can view all projects)
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Project[];
  } catch (error: any) {
    // If index is missing, fall back to query without orderBy
    if (
      error.code === "failed-precondition" ||
      error.message?.includes("index")
    ) {
      console.warn("Index not found, using fallback query without orderBy");
      const fallbackQuery = query(collection(db, "projects"));
      const snapshot = await getDocs(fallbackQuery);
      const projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Project[];
      // Sort manually in memory
      return projects.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    }
    // Re-throw other errors
    console.error("Error fetching projects:", error);
    throw error;
  }
}

export async function getProject(projectId: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }
  const projectRef = doc(db, "projects", projectId);
  const snapshot = await getDoc(projectRef);
  if (snapshot.exists()) {
    return {
      id: snapshot.id,
      ...snapshot.data(),
      createdAt: snapshot.data().createdAt?.toDate() || new Date(),
    } as Project;
  }
  return null;
}

export async function getAllProjects() {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    })) as Project[];
  } catch (error: any) {
    if (
      error.code === "failed-precondition" ||
      error.message?.includes("index")
    ) {
      console.warn("Index not found, using fallback query without orderBy");
      const snapshot = await getDocs(collection(db, "projects"));
      const projects = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Project[];
      return projects.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    }
    console.error("Error fetching all projects:", error);
    throw error;
  }
}

// User Profiles
/**
 * Create user profile in Firestore 'users' collection
 * This should be called after creating Firebase Auth user during signup
 * Firebase Auth = Authentication, Firestore users collection = Profile data
 */
export async function createUserProfile(
  userProfile: Omit<UserProfile, "createdAt" | "updatedAt">
) {
  console.log(
    "Creating user profile in Firestore users collection:",
    userProfile
  );

  if (!db) {
    console.error("Firestore db is not initialized!");
    throw new Error("Firestore is not initialized");
  }

  // Remove undefined fields - Firestore doesn't accept undefined values
  const cleanedProfile = removeUndefinedFields(userProfile);

  const profileData = {
    ...cleanedProfile,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  console.log("Profile data to save (cleaned):", profileData);

  try {
    const userRef = doc(db, "users", userProfile.uid);
    console.log("User document reference:", userRef.path);
    console.log("About to call setDoc...");
    await setDoc(userRef, profileData);
    console.log("setDoc completed successfully");
    console.log("User profile created successfully in Firestore");
  } catch (error: any) {
    console.error("Error in createUserProfile setDoc:", error);
    console.error("Error message:", error?.message);
    console.error("Error code:", error?.code);
    console.error("Error stack:", error?.stack);
    throw error;
  }
}

/**
 * Get user profile from Firestore 'users' collection
 * This is the single source of truth for user profile data
 * Firebase Auth handles authentication, Firestore users collection handles profile data
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  console.log(
    "Getting user profile from Firestore users collection for UID:",
    uid
  );
  const userRef = doc(db, "users", uid);
  console.log("User document path:", userRef.path);
  const snapshot = await getDoc(userRef);
  console.log("Document exists:", snapshot.exists());
  if (snapshot.exists()) {
    const data = snapshot.data();
    console.log("Document data:", data);
    return {
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      deleted: data.deleted || false,
      deletedAt: data.deletedAt?.toDate
        ? data.deletedAt.toDate()
        : data.deletedAt instanceof Date
        ? data.deletedAt
        : data.deletedAt
        ? new Date(data.deletedAt)
        : undefined,
      status: data.status || 'active', // Default to active if not set
    } as UserProfile;
  }
  console.log("User profile not found in Firestore");
  return null;
}

export async function getUsersByType(
  userType: UserType
): Promise<UserProfile[]> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const q = query(collection(db, "users"), where("userType", "==", userType));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as UserProfile[];
}

export async function getAllUsers(includeDeleted = false): Promise<UserProfile[]> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    console.log("getAllUsers: Starting to fetch users from Firestore");
    const usersCollection = collection(db, "users");
    console.log("getAllUsers: Collection reference created");
    const snapshot = await getDocs(usersCollection);
    console.log(
      "getAllUsers: Fetched",
      snapshot.docs.length,
      "users from Firestore"
    );

    const users = snapshot.docs.map((doc) => {
      const data = doc.data();
      console.log("getAllUsers: Processing user doc:", doc.id, data);
      return {
        uid: doc.id, // Ensure uid is set to doc.id
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : data.createdAt instanceof Date
          ? data.createdAt
          : new Date(),
        updatedAt: data.updatedAt?.toDate
          ? data.updatedAt.toDate()
          : data.updatedAt instanceof Date
          ? data.updatedAt
          : new Date(),
        deleted: data.deleted || false,
        deletedAt: data.deletedAt?.toDate
          ? data.deletedAt.toDate()
          : data.deletedAt instanceof Date
          ? data.deletedAt
          : data.deletedAt
          ? new Date(data.deletedAt)
          : undefined,
        status: data.status || 'active', // Default to active if not set
      };
    }) as UserProfile[];

    // Filter out deleted users unless includeDeleted is true
    const filteredUsers = includeDeleted
      ? users
      : users.filter((user) => !user.deleted);

    console.log("getAllUsers: Returning", filteredUsers.length, "users:", filteredUsers);
    return filteredUsers;
  } catch (error: any) {
    console.error("Error getting all users:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    throw error;
  }
}

// User Types Management
export async function getUserTypes(): Promise<string[]> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const typesRef = doc(db, "config", "userTypes");
    const snapshot = await getDoc(typesRef);
    console.log("UserTypes document exists:", snapshot.exists());

    if (snapshot.exists()) {
      const data = snapshot.data();
      console.log("UserTypes document data:", data);
      console.log("UserTypes data keys:", Object.keys(data || {}));

      // Check for 'types' field
      const types = data?.types;
      console.log("UserTypes field value:", types);
      console.log("Is array?", Array.isArray(types));
      console.log("Array length:", Array.isArray(types) ? types.length : "N/A");

      if (Array.isArray(types)) {
        console.log("UserTypes array found with length:", types.length);
        console.log(
          "UserTypes array contents:",
          JSON.stringify(types, null, 2)
        );

        if (types.length > 0) {
          // Filter out any null/undefined/empty values and return
          const validTypes = types
            .filter((t) => t != null && t !== undefined)
            .map((t) => (typeof t === "string" ? t.trim() : String(t).trim()))
            .filter((t) => t.length > 0);

          console.log("Valid types after filtering:", validTypes);
          console.log(
            "Original array had",
            types.length,
            "items, valid types:",
            validTypes.length
          );

          if (validTypes.length > 0) {
            console.log(
              "Returning",
              validTypes.length,
              "types from Firestore:",
              validTypes
            );
            return validTypes;
          } else {
            console.warn("No valid types found after filtering");
            return ["frontend", "backend", "designer"];
          }
        } else {
          console.warn("UserTypes array exists but is empty");
          // Don't overwrite - return defaults
          return ["frontend", "backend", "designer"];
        }
      } else {
        console.warn("UserTypes field is not an array:", typeof types, types);
        // Field exists but is not an array - don't overwrite, return defaults
        return ["frontend", "backend", "designer"];
      }
    }

    // Document doesn't exist, initialize with default types
    console.log("UserTypes document does not exist, creating with defaults");
    await setDoc(typesRef, { types: ["frontend", "backend", "designer"] });
    return ["frontend", "backend", "designer"];
  } catch (error) {
    console.error("Error in getUserTypes:", error);
    console.error("Error details:", error);
    // Return default types on error
    return ["frontend", "backend", "designer"];
  }
}

export async function addUserType(newType: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const typesRef = doc(db, "config", "userTypes");
  const snapshot = await getDoc(typesRef);
  const currentTypes = snapshot.exists()
    ? snapshot.data().types || []
    : ["frontend", "backend", "designer"];

  if (!currentTypes.includes(newType.toLowerCase())) {
    await setDoc(typesRef, { types: [...currentTypes, newType.toLowerCase()] });
  }
}

export async function updateUserType(oldType: string, newType: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const typesRef = doc(db, "config", "userTypes");
  const snapshot = await getDoc(typesRef);
  const currentTypes = snapshot.exists()
    ? snapshot.data().types || []
    : ["frontend", "backend", "designer"];

  const updatedTypes = currentTypes.map((type: string) =>
    type === oldType ? newType.toLowerCase() : type
  );

  await setDoc(typesRef, { types: updatedTypes });
}

export async function deleteUserType(typeToDelete: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const typesRef = doc(db, "config", "userTypes");
  const snapshot = await getDoc(typesRef);
  const currentTypes = snapshot.exists()
    ? snapshot.data().types || []
    : ["frontend", "backend", "designer"];

  // Prevent deleting if it's the only type
  if (currentTypes.length <= 1) {
    throw new Error(
      "Cannot delete the last user type. At least one user type must exist."
    );
  }

  const filteredTypes = currentTypes.filter(
    (type: string) => type !== typeToDelete
  );

  if (filteredTypes.length < currentTypes.length) {
    await setDoc(typesRef, { types: filteredTypes });
  }
}

// Tasks - Enhanced to support viewing tasks from users with same type
export async function getTasksByUserType(
  userType: UserType,
  currentUserId: string,
  filters?: {
    status?: TaskStatus;
    projectId?: string;
    fromDate?: Date;
    toDate?: Date;
    search?: string;
  }
) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  // Get all users with the same type
  const usersWithSameType = await getUsersByType(userType);
  const userIds = usersWithSameType.map((u) => u.uid);

  if (userIds.length === 0) {
    return [];
  }

  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  let tasks: Task[] = [];

  try {
    // Fetch tasks for all users with the same type
    const tasksPromises = userIds.map(async (userId) => {
      try {
        let q = query(
          collection(db!, "tasks"),
          where("userId", "==", userId),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Task[];
      } catch (error: any) {
        if (
          error.code === "failed-precondition" ||
          error.message?.includes("index")
        ) {
          const fallbackQuery = query(
            collection(db!, "tasks"),
            where("userId", "==", userId)
          );
          const snapshot = await getDocs(fallbackQuery);
          return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          })) as Task[];
        }
        return [];
      }
    });

    const tasksArrays = await Promise.all(tasksPromises);
    tasks = tasksArrays.flat();
    tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error("Error fetching tasks by user type:", error);
    throw error;
  }

  // Apply filters
  if (filters) {
    if (filters.status) {
      tasks = tasks.filter((t) => t.status === filters.status);
    }
    if (filters.projectId) {
      tasks = tasks.filter((t) => t.projectId === filters.projectId);
    }
    if (filters.fromDate) {
      tasks = tasks.filter((t) => t.createdAt >= filters.fromDate!);
    }
    if (filters.toDate) {
      tasks = tasks.filter((t) => t.createdAt <= filters.toDate!);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower)
      );
    }
  }

  return tasks;
}

// Add a history entry for a task
export async function addTaskHistory(
  taskId: string,
  action: HistoryAction,
  performedBy: string,
  performedByEmail?: string,
  performedByUsername?: string,
  oldValue?: string,
  newValue?: string,
  field?: string,
  description?: string
) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const historyData = {
    taskId,
    action,
    performedBy,
    performedByEmail: performedByEmail || null,
    performedByUsername: performedByUsername || null,
    timestamp: Timestamp.now(),
    oldValue: oldValue || null,
    newValue: newValue || null,
    field: field || null,
    description: description || null,
  };

  await addDoc(collection(db, "taskHistory"), historyData);
}

// Get all history entries for a task
export async function getTaskHistory(taskId: string): Promise<TaskHistory[]> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const historyQuery = query(
      collection(db, "taskHistory"),
      where("taskId", "==", taskId),
      orderBy("timestamp", "desc")
    );

    const querySnapshot = await getDocs(historyQuery);
    const history: TaskHistory[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      history.push({
        id: doc.id,
        taskId: data.taskId,
        action: data.action,
        performedBy: data.performedBy,
        performedByEmail: data.performedByEmail,
        performedByUsername: data.performedByUsername,
        timestamp: data.timestamp.toDate(),
        oldValue: data.oldValue,
        newValue: data.newValue,
        field: data.field,
        description: data.description,
      });
    });

    return history;
  } catch (error: any) {
    // If it's a permission error or index error, try without orderBy
    if (
      error?.code === "permission-denied" ||
      error?.code === "failed-precondition"
    ) {
      try {
        const fallbackQuery = query(
          collection(db, "taskHistory"),
          where("taskId", "==", taskId)
        );
        const querySnapshot = await getDocs(fallbackQuery);
        const history: TaskHistory[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          history.push({
            id: doc.id,
            taskId: data.taskId,
            action: data.action,
            performedBy: data.performedBy,
            performedByEmail: data.performedByEmail,
            performedByUsername: data.performedByUsername,
            timestamp: data.timestamp.toDate(),
            oldValue: data.oldValue,
            newValue: data.newValue,
            field: data.field,
            description: data.description,
          });
        });

        // Sort manually by timestamp descending
        history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        return history;
      } catch (fallbackError) {
        console.error("Error loading task history (fallback):", fallbackError);
        throw fallbackError;
      }
    }
    throw error;
  }
}

// Task Status Management
export async function getTaskStatuses(): Promise<string[]> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const statusRef = doc(db, "config", "taskStatuses");
    const snapshot = await getDoc(statusRef);

    if (snapshot.exists()) {
      const data = snapshot.data();
      const statuses = data.statuses;
      if (Array.isArray(statuses) && statuses.length > 0) {
        return statuses;
      }
    }

    // Default statuses if none exist
    const defaultStatuses = ["Pending", "Completed", "Deleted"];
    await setDoc(statusRef, { statuses: defaultStatuses });
    return defaultStatuses;
  } catch (error) {
    console.error("Error in getTaskStatuses:", error);
    // Return default statuses on error
    return ["Pending", "Completed", "Deleted"];
  }
}

export async function addTaskStatus(newStatus: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const statusRef = doc(db, "config", "taskStatuses");
  const snapshot = await getDoc(statusRef);
  const currentStatuses = snapshot.exists()
    ? snapshot.data().statuses || []
    : ["Pending", "Completed", "Deleted"];

  const statusLower = newStatus.trim();
  if (!currentStatuses.includes(statusLower)) {
    await setDoc(statusRef, { statuses: [...currentStatuses, statusLower] });
  }
}

export async function updateTaskStatus(oldStatus: string, newStatus: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const statusRef = doc(db, "config", "taskStatuses");
  const snapshot = await getDoc(statusRef);
  const currentStatuses = snapshot.exists()
    ? snapshot.data().statuses || []
    : ["Pending", "Completed", "Deleted"];

  const newStatusLower = newStatus.trim();
  const oldStatusIndex = currentStatuses.indexOf(oldStatus);

  if (oldStatusIndex !== -1 && !currentStatuses.includes(newStatusLower)) {
    const updatedStatuses = [...currentStatuses];
    updatedStatuses[oldStatusIndex] = newStatusLower;
    await setDoc(statusRef, { statuses: updatedStatuses });
  }
}

export async function deleteTaskStatus(statusToDelete: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  const statusRef = doc(db, "config", "taskStatuses");
  const snapshot = await getDoc(statusRef);
  const currentStatuses = snapshot.exists()
    ? snapshot.data().statuses || []
    : ["Pending", "Completed", "Deleted"];

  // Prevent deleting if it's the only status
  if (currentStatuses.length <= 1) {
    throw new Error(
      "Cannot delete the last status. At least one status must exist."
    );
  }

  const filteredStatuses = currentStatuses.filter(
    (status: string) => status !== statusToDelete
  );

  if (filteredStatuses.length < currentStatuses.length) {
    await setDoc(statusRef, { statuses: filteredStatuses });
  }
}

// Notification functions
export async function createNotification(notification: {
  taskId: string;
  taskTitle: string;
  recipientId: string;
  senderId: string;
  senderEmail?: string;
  senderUsername?: string;
  type: "task_completed" | "task_assigned" | "task_updated" | "other";
  message: string;
  remark?: string;
}) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const notificationRef = doc(collection(db, "notifications"));
    await setDoc(notificationRef, {
      ...notification,
      read: false,
      createdAt: serverTimestamp(),
    });
    return notificationRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

export async function getNotifications(
  userId: string
): Promise<Notification[]> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate
          ? data.createdAt.toDate()
          : data.createdAt instanceof Date
          ? data.createdAt
          : new Date(),
        readAt: data.readAt?.toDate
          ? data.readAt.toDate()
          : data.readAt instanceof Date
          ? data.readAt
          : undefined,
      } as Notification;
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
}

export async function getUnreadNotificationCount(
  userId: string
): Promise<number> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId),
      where("read", "==", false)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error("Error fetching unread notification count:", error);
    return 0;
  }
}

export async function markNotificationAsRead(notificationId: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const notificationRef = doc(db, "notifications", notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId),
      where("read", "==", false)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      const notificationRef = doc.ref;
      batch.update(notificationRef, {
        read: true,
        readAt: serverTimestamp(),
      });
    });
    await batch.commit();
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
}

export async function deleteAllNotifications(userId: string) {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  } catch (error) {
    console.error("Error deleting all notifications:", error);
    throw error;
  }
}

// Real-time listener for notifications
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
): () => void {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  let unsubscribe: (() => void) | null = null;

  const setupSubscription = (useOrderBy: boolean) => {
    if (!db) {
      callback([]);
      return;
    }

    try {
      let q;
      if (useOrderBy) {
        q = query(
          collection(db, "notifications"),
          where("recipientId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(50)
        );
      } else {
        q = query(
          collection(db, "notifications"),
          where("recipientId", "==", userId),
          limit(50)
        );
      }

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const notifications = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate
                ? data.createdAt.toDate()
                : data.createdAt instanceof Date
                ? data.createdAt
                : new Date(),
              readAt: data.readAt?.toDate
                ? data.readAt.toDate()
                : data.readAt instanceof Date
                ? data.readAt
                : undefined,
            } as Notification;
          });

          // If not using orderBy, sort in memory
          if (!useOrderBy) {
            notifications.sort(
              (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
            );
          }

          callback(notifications);
        },
        (error) => {
          console.error("Error in notification subscription:", error);
          // If index error and we were using orderBy, try without it
          if (error?.code === "failed-precondition" && useOrderBy) {
            console.warn("Index not found, using fallback query");
            setupSubscription(false);
          } else {
            // Return empty array on error
            callback([]);
          }
        }
      );
    } catch (error) {
      console.error("Error setting up notification subscription:", error);
      callback([]);
    }
  };

  // Start with orderBy, fallback to without if index missing
  setupSubscription(true);

  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

// ==================== Important Items Functions ====================

/**
 * Create a URL-friendly slug from a title
 */
function createSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Create a new important item
 */
export async function createImportantItem(
  title: string,
  description: string,
  user: { uid: string; email?: string; username?: string }
): Promise<string> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const slug = createSlug(title);
    
    // Check if slug already exists for this user
    const existingQuery = query(
      collection(db, "importantItems"),
      where("slug", "==", slug),
      where("userId", "==", user.uid)
    );
    const existingDocs = await getDocs(existingQuery);
    
    let finalSlug = slug;
    if (!existingDocs.empty) {
      // If slug exists for this user, append a number
      let counter = 1;
      do {
        finalSlug = `${slug}-${counter}`;
        const checkQuery = query(
          collection(db, "importantItems"),
          where("slug", "==", finalSlug),
          where("userId", "==", user.uid)
        );
        const checkDocs = await getDocs(checkQuery);
        if (checkDocs.empty) break;
        counter++;
      } while (true);
    }

    const now = Timestamp.now();
    const docRef = await addDoc(collection(db, "importantItems"), {
      title: title.trim(),
      description,
      slug: finalSlug,
      createdAt: now,
      updatedAt: now,
      userId: user.uid,
      userEmail: user.email || null,
      username: user.username || null,
    });

    return docRef.id;
  } catch (error: any) {
    console.error("Error creating important item:", error);
    throw new Error(`Failed to create important item: ${error.message}`);
  }
}

/**
 * Get all important items for a specific user
 */
export async function getAllImportantItems(userId: string): Promise<ImportantItem[]> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const q = query(
      collection(db, "importantItems"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description || "",
        slug: data.slug,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        userId: data.userId,
        userEmail: data.userEmail,
        username: data.username,
      };
    });
  } catch (error: any) {
    // If index is missing, fall back to query without orderBy
    if (
      error.code === "failed-precondition" ||
      error.message?.includes("index")
    ) {
      console.warn("Index not found, using fallback query without orderBy");
      const fallbackQuery = query(
        collection(db, "importantItems"),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(fallbackQuery);
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          description: data.description || "",
          slug: data.slug,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          userId: data.userId,
          userEmail: data.userEmail,
          username: data.username,
        };
      });
      // Sort manually in memory
      return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else {
      console.error("Error fetching important items:", error);
      throw new Error(`Failed to fetch important items: ${error.message}`);
    }
  }
}

/**
 * Get an important item by slug for a specific user
 */
export async function getImportantItemBySlug(slug: string, userId: string): Promise<ImportantItem | null> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const q = query(
      collection(db, "importantItems"),
      where("slug", "==", slug),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      description: data.description || "",
      slug: data.slug,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      userId: data.userId,
      userEmail: data.userEmail,
      username: data.username,
    };
  } catch (error: any) {
    console.error("Error fetching important item by slug:", error);
    throw new Error(`Failed to fetch important item: ${error.message}`);
  }
}

/**
 * Update an important item
 */
export async function updateImportantItem(
  id: string,
  title: string,
  description: string,
  user: { uid: string; email?: string; username?: string }
): Promise<void> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const slug = createSlug(title);
    const docRef = doc(db, "importantItems", id);
    
    // Check if slug already exists for another document of this user
    const existingQuery = query(
      collection(db, "importantItems"),
      where("slug", "==", slug),
      where("userId", "==", user.uid)
    );
    const existingDocs = await getDocs(existingQuery);
    
    let finalSlug = slug;
    if (!existingDocs.empty && existingDocs.docs[0].id !== id) {
      // If slug exists for another document of this user, append a number
      let counter = 1;
      do {
        finalSlug = `${slug}-${counter}`;
        const checkQuery = query(
          collection(db, "importantItems"),
          where("slug", "==", finalSlug),
          where("userId", "==", user.uid)
        );
        const checkDocs = await getDocs(checkQuery);
        if (checkDocs.empty || checkDocs.docs[0].id === id) break;
        counter++;
      } while (true);
    }

    await updateDoc(docRef, {
      title: title.trim(),
      description,
      slug: finalSlug,
      updatedAt: Timestamp.now(),
    });
  } catch (error: any) {
    console.error("Error updating important item:", error);
    throw new Error(`Failed to update important item: ${error.message}`);
  }
}

/**
 * Delete an important item
 */
export async function deleteImportantItem(id: string): Promise<void> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    await deleteDoc(doc(db, "importantItems", id));
  } catch (error: any) {
    console.error("Error deleting important item:", error);
    throw new Error(`Failed to delete important item: ${error.message}`);
  }
}

// ==================== User Management Functions ====================

/**
 * Update user profile
 */
export async function updateUserProfile(
  uid: string,
  updates: Partial<Omit<UserProfile, "uid" | "createdAt" | "updatedAt">>
): Promise<void> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const userRef = doc(db, "users", uid);
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    // Remove undefined fields
    const cleanedData = removeUndefinedFields(updateData);

    await updateDoc(userRef, cleanedData);
  } catch (error: any) {
    console.error("Error updating user profile:", error);
    throw new Error(`Failed to update user profile: ${error.message}`);
  }
}

/**
 * Soft delete a user
 */
export async function softDeleteUser(uid: string): Promise<void> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      deleted: true,
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error: any) {
    console.error("Error soft deleting user:", error);
    throw new Error(`Failed to delete user: ${error.message}`);
  }
}

/**
 * Restore a soft-deleted user
 */
export async function restoreUser(uid: string): Promise<void> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      deleted: false,
      deletedAt: null,
      updatedAt: Timestamp.now(),
    });
  } catch (error: any) {
    console.error("Error restoring user:", error);
    throw new Error(`Failed to restore user: ${error.message}`);
  }
}

// ==================== TinyMCE API Key Management ====================

/**
 * Get TinyMCE API key from Firestore config
 */
export async function getTinyMCEApiKey(): Promise<string | null> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const configRef = doc(db, "config", "tinymceApiKey");
    const snapshot = await getDoc(configRef);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return data.value || null;
    }
    return null;
  } catch (error: any) {
    console.error("Error getting TinyMCE API key:", error);
    return null;
  }
}

/**
 * Set TinyMCE API key in Firestore config
 */
export async function setTinyMCEApiKey(apiKey: string): Promise<void> {
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    const configRef = doc(db, "config", "tinymceApiKey");
    await setDoc(configRef, {
      value: apiKey.trim(),
      updatedAt: Timestamp.now(),
    });
  } catch (error: any) {
    console.error("Error setting TinyMCE API key:", error);
    throw new Error(`Failed to set TinyMCE API key: ${error.message}`);
  }
}

/**
 * Create a new user (admin only)
 * Creates both Firebase Auth user and Firestore profile
 */
export async function createUser(
  email: string,
  password: string,
  username: string,
  userType: UserType
): Promise<string> {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized");
  }
  if (!db) {
    throw new Error("Firestore is not initialized");
  }

  try {
    // Step 1: Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const user = userCredential.user;

    // Step 2: Create Firestore user profile
    const isAdmin = email.toLowerCase() === "admin@gmail.com";
    await createUserProfile({
      uid: user.uid,
      email: user.email || email,
      displayName: undefined,
      username: username.trim(),
      userType: userType,
      isAdmin: isAdmin,
      status: 'active', // New users are active by default
    });

    return user.uid;
  } catch (error: any) {
    console.error("Error creating user:", error);
    throw new Error(`Failed to create user: ${error.message}`);
  }
}
