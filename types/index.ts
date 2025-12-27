export type TaskStatus = 'Pending' | 'Completed' | 'Deleted';
export type ProjectStatus = 'pending' | 'active';
export type UserType = 'frontend' | 'backend' | 'designer' | string; // Allow custom types

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  projectId: string;
  projectName: string;
  version?: string;
  doneBy?: string;
  doneByEmail?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  order?: number; // Order for drag and drop rearrangement
  userIdUsername?: string; // Username of the task creator
  userIdType?: string; // User type of the task creator (e.g., frontend, backend, designer)
  assignedUserId?: string; // User assigned to the task
  assignedUserEmail?: string;
  assignedUserUsername?: string; // Username of assigned user
  panel?: string; // Panel name if project has panels (e.g., 'Admin Panel', 'Customer Panel')
  estimatedTime?: string; // Estimated time to complete the task (e.g., "2 hours", "1 day")
  reassignmentRequest?: {
    requestedBy: string;
    requestedByEmail: string;
    requestedAt: Date;
    reason?: string;
  };
  permissionRequest?: {
    requestedBy: string;
    requestedByEmail: string;
    requestedAt: Date;
    reason?: string;
    status?: 'pending' | 'approved' | 'rejected';
  };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: Date;
  userId: string;
  panels?: string[]; // Array of panel names (e.g., ['Admin Panel', 'Customer Panel'])
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  username: string;
  userType: UserType;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type HistoryAction = 
  | 'created' 
  | 'status_changed' 
  | 'assigned_user_changed' 
  | 'title_changed' 
  | 'description_changed' 
  | 'project_changed'
  | 'version_changed'
  | 'updated';

export interface TaskHistory {
  id: string;
  taskId: string;
  action: HistoryAction;
  performedBy: string; // User ID
  performedByEmail?: string;
  performedByUsername?: string;
  timestamp: Date;
  oldValue?: string;
  newValue?: string;
  field?: string; // Field that was changed (e.g., 'status', 'assignedUserId')
  description?: string; // Human-readable description
}

