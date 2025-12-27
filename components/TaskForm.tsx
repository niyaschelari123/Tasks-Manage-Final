'use client';

import { useState, useEffect } from 'react';
import { createTask, updateTask, createProject, getTaskStatuses, getAllUsers } from '@/lib/firestore';
import { Task, Project, TaskStatus, ProjectStatus, UserProfile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface TaskItem {
  title: string;
  description: string;
  projectId: string;
  status: TaskStatus;
  version: string;
  panel?: string;
  assignedUserId?: string;
  estimatedTime?: string;
}

interface TaskFormProps {
  task?: Task;
  projects: Project[];
  onSuccess: () => void;
  onCancel: () => void;
  onProjectCreated?: () => void;
}

export default function TaskForm({ task, projects, onSuccess, onCancel, onProjectCreated }: TaskFormProps) {
  const { user, userProfile } = useAuth();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'Pending');
  const [projectId, setProjectId] = useState(task?.projectId || '');
  const [version, setVersion] = useState(task?.version || '');
  const [panel, setPanel] = useState(task?.panel || '');
  const [estimatedTime, setEstimatedTime] = useState(task?.estimatedTime || '');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [hasPanels, setHasPanels] = useState(false);
  const [newProjectPanels, setNewProjectPanels] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableStatuses, setAvailableStatuses] = useState<string[]>(['Pending', 'Completed', 'Deleted']);
  const [addMultiple, setAddMultiple] = useState(false);
  const [useSameProject, setUseSameProject] = useState(false);
  const [useSamePanel, setUseSamePanel] = useState(false);
  const [taskItems, setTaskItems] = useState<TaskItem[]>([
    { title: '', description: '', projectId: '', status: 'Pending' as TaskStatus, version: '', panel: '', estimatedTime: '' }
  ]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  useEffect(() => {
    console.log('TaskForm received projects:', projects);
  }, [projects]);

  useEffect(() => {
    loadTaskStatuses();
    loadAllUsers();
  }, []);

  const loadAllUsers = async () => {
    try {
      const users = await getAllUsers();
      // Filter out admin user
      const filteredUsers = users.filter((u) => u.email?.toLowerCase() !== 'admin@gmail.com');
      setAllUsers(filteredUsers);
      // If admin is creating a task, set default to first user (or empty)
      if (user?.email?.toLowerCase() === 'admin@gmail.com' && !task && filteredUsers.length > 0) {
        setSelectedUserId(filteredUsers[0].uid);
      }
    } catch (error) {
      console.error('Error loading all users:', error);
    }
  };

  // Update hasPanels when projectId changes
  useEffect(() => {
    if (projectId) {
      const selectedProject = projects.find((p) => p.id === projectId);
      setHasPanels(selectedProject?.panels && selectedProject.panels.length > 0);
      if (!selectedProject?.panels || selectedProject.panels.length === 0) {
        setPanel('');
      }
    } else {
      setHasPanels(false);
      setPanel('');
    }
  }, [projectId, projects]);

  const loadTaskStatuses = async () => {
    try {
      const statuses = await getTaskStatuses();
      setAvailableStatuses(statuses);
      // If current status is not in available statuses, set to first available
      if (statuses.length > 0 && !statuses.includes(status)) {
        setStatus(statuses[0] as TaskStatus);
      }
    } catch (error) {
      console.error('Error loading task statuses:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If editing, use single task logic
    if (task) {
      if (!title.trim() || !projectId) {
        setError('Title and project are required');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const selectedProject = projects.find((p) => p.id === projectId);
        // When editing, NEVER change ownership fields (userId, userIdUsername, userIdType)
        // Only update editable fields
        const taskData: any = {
          title: title.trim(),
          status,
          projectId,
          projectName: selectedProject?.name || '',
          // Preserve assigned user when editing
          assignedUserId: task.assignedUserId || user?.uid || '',
          assignedUserEmail: task.assignedUserEmail || user?.email || '',
          assignedUserUsername: task.assignedUserUsername || userProfile?.username || user?.email || 'Unknown',
        };

        // Add description only if it's not empty
        if (description.trim()) {
          taskData.description = description.trim();
        }

        // Add panel if project has panels and panel is selected
        if (hasPanels && panel) {
          taskData.panel = panel;
        }

        // Add estimated time if provided
        if (estimatedTime.trim()) {
          taskData.estimatedTime = estimatedTime.trim();
        }

        // Only add these fields if status is Completed
        if (status === 'Completed') {
          if (version && version.trim()) {
            taskData.version = version.trim();
          }
          taskData.doneBy = user?.displayName || user?.email || 'Unknown';
          if (user?.email) {
            taskData.doneByEmail = user.email;
          }
        }

        await updateTask(
          task.id,
          taskData,
          user
            ? {
                uid: user.uid,
                email: user.email || undefined,
                username: userProfile?.username || undefined,
              }
            : undefined
        );

        onSuccess();
      } catch (err: any) {
        setError(err.message || 'Failed to save task');
      } finally {
        setLoading(false);
      }
      return;
    }

    // If adding multiple tasks
    if (addMultiple) {
      // Validate all task items
      const invalidTasks = taskItems.filter(
        (item) => !item.title.trim() || !item.projectId
      );
      if (invalidTasks.length > 0) {
        setError('All tasks must have a title and project selected');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const createPromises = taskItems.map(async (item) => {
          const selectedProject = projects.find((p) => p.id === item.projectId);
          
          // Determine assigned user: if admin and item.assignedUserId is set, use that; otherwise use current user
          let assignedUserId = user?.uid || '';
          let assignedUserEmail = user?.email || '';
          let assignedUserUsername = userProfile?.username || user?.email || 'Unknown';
          
          if (user?.email?.toLowerCase() === 'admin@gmail.com' && item.assignedUserId) {
            const selectedUser = allUsers.find((u) => u.uid === item.assignedUserId);
            if (selectedUser) {
              assignedUserId = selectedUser.uid;
              assignedUserEmail = selectedUser.email || '';
              assignedUserUsername = selectedUser.username || selectedUser.email || 'Unknown';
            }
          }
          
          const taskData: any = {
            title: item.title.trim(),
            status: item.status,
            projectId: item.projectId,
            projectName: selectedProject?.name || '',
            userId: user?.uid || '',
            userIdUsername: userProfile?.username || user?.email || 'Unknown',
            userIdType: userProfile?.userType || undefined,
            assignedUserId,
            assignedUserEmail,
            assignedUserUsername,
          };

          // Add panel if project has panels and panel is selected
          if (selectedProject?.panels && selectedProject.panels.length > 0 && item.panel) {
            taskData.panel = item.panel;
          }

          if (item.description.trim()) {
            taskData.description = item.description.trim();
          }

          if (item.estimatedTime && item.estimatedTime.trim()) {
            taskData.estimatedTime = item.estimatedTime.trim();
          }

          if (item.status === 'Completed') {
            if (item.version && item.version.trim()) {
              taskData.version = item.version.trim();
            }
            taskData.doneBy = user?.displayName || user?.email || 'Unknown';
            if (user?.email) {
              taskData.doneByEmail = user.email;
            }
          }

          return createTask(
            taskData,
            user
              ? {
                  uid: user.uid,
                  email: user.email || undefined,
                  username: userProfile?.username || undefined,
                }
              : undefined
          );
        });

        await Promise.all(createPromises);
        onSuccess();
      } catch (err: any) {
        setError(err.message || 'Failed to create tasks');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Single task creation
    if (!title.trim() || !projectId) {
      setError('Title and project are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const selectedProject = projects.find((p) => p.id === projectId);
      
      // Determine assigned user: if admin and selectedUserId is set, use that; otherwise use current user
      let assignedUserId = user?.uid || '';
      let assignedUserEmail = user?.email || '';
      let assignedUserUsername = userProfile?.username || user?.email || 'Unknown';
      
      if (user?.email?.toLowerCase() === 'admin@gmail.com' && selectedUserId) {
        const selectedUser = allUsers.find((u) => u.uid === selectedUserId);
        if (selectedUser) {
          assignedUserId = selectedUser.uid;
          assignedUserEmail = selectedUser.email || '';
          assignedUserUsername = selectedUser.username || selectedUser.email || 'Unknown';
        }
      }
      
      // When creating, set ownership fields
      const taskData: any = {
        title: title.trim(),
        status,
        projectId,
        projectName: selectedProject?.name || '',
        userId: user?.uid || '',
        userIdUsername: userProfile?.username || user?.email || 'Unknown',
        userIdType: userProfile?.userType || undefined, // Store user type (frontend, backend, etc.)
        // Set assigned user (can be different if admin selected a user)
        assignedUserId,
        assignedUserEmail,
        assignedUserUsername,
      };

      // Add panel if project has panels and panel is selected
      if (hasPanels && panel) {
        taskData.panel = panel;
      }

      // Add description only if it's not empty
      if (description.trim()) {
        taskData.description = description.trim();
      }

      // Add estimated time if provided
      if (estimatedTime.trim()) {
        taskData.estimatedTime = estimatedTime.trim();
      }

      // Only add these fields if status is Completed
      if (status === 'Completed') {
        if (version && version.trim()) {
          taskData.version = version.trim();
        }
        taskData.doneBy = user?.displayName || user?.email || 'Unknown';
        if (user?.email) {
          taskData.doneByEmail = user.email;
        }
      }

      await createTask(
        taskData,
        user
          ? {
              uid: user.uid,
              email: user.email || undefined,
              username: userProfile?.username || undefined,
            }
          : undefined
      );

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const addTaskItem = () => {
    const newTask: TaskItem = {
      title: '',
      description: '',
      projectId: '',
      status: 'Pending' as TaskStatus,
      version: '',
      panel: '',
      estimatedTime: ''
    };
    
    // If "use same project" is checked, copy project from first task
    if (useSameProject && taskItems.length > 0 && taskItems[0].projectId) {
      newTask.projectId = taskItems[0].projectId;
      // If "use same panel" is also checked, copy panel from first task
      if (useSamePanel && taskItems[0].panel) {
        newTask.panel = taskItems[0].panel;
      }
    }
    
    setTaskItems([...taskItems, newTask]);
  };

  const removeTaskItem = (index: number) => {
    if (taskItems.length > 1) {
      setTaskItems(taskItems.filter((_, i) => i !== index));
    }
  };

  const updateTaskItem = (index: number, field: keyof TaskItem, value: string | TaskStatus) => {
    const updated = [...taskItems];
    updated[index] = { ...updated[index], [field]: value };
    // If project changed, reset panel
    if (field === 'projectId') {
      updated[index].panel = '';
    }
    
    // If "use same project" is checked and first task's project is changed, update all other tasks
    if (useSameProject && index === 0 && field === 'projectId') {
      // Update project for all other tasks
      for (let i = 1; i < updated.length; i++) {
        updated[i].projectId = value as string;
        // If useSamePanel is not checked, reset panel when project changes
        if (!useSamePanel) {
          updated[i].panel = '';
        }
      }
    }
    
    // If "use same panel" is checked and first task's panel is changed, update all other tasks
    if (useSamePanel && useSameProject && index === 0 && field === 'panel') {
      // Update panel for all other tasks
      for (let i = 1; i < updated.length; i++) {
        updated[i].panel = value as string;
      }
    }
    
    setTaskItems(updated);
  };

  // Reset multiple tasks when toggling
  useEffect(() => {
    if (addMultiple && taskItems.length === 0) {
      setTaskItems([
        { title: '', description: '', projectId: '', status: 'Pending' as TaskStatus, version: '', panel: '', estimatedTime: '' }
      ]);
    }
    if (!addMultiple) {
      setUseSameProject(false); // Reset checkbox when disabling multiple tasks
      setUseSamePanel(false); // Reset panel checkbox as well
    }
  }, [addMultiple]);

  const getProjectPanels = (projectId: string): string[] => {
    const project = projects.find((p) => p.id === projectId);
    return project?.panels || [];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!task && (
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="addMultiple"
            checked={addMultiple}
            onChange={(e) => setAddMultiple(e.target.checked)}
            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="addMultiple" className="text-sm font-medium text-gray-700 cursor-pointer">
            Add multiple tasks for multiple projects
          </label>
        </div>
      )}

      {addMultiple && !task ? (
        // Multiple tasks form
        <div className="space-y-6">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useSameProject"
                checked={useSameProject}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseSameProject(checked);
                  // If unchecked, also uncheck useSamePanel
                  if (!checked) {
                    setUseSamePanel(false);
                  }
                  // If checked, copy first task's project to all other tasks
                  if (checked && taskItems.length > 0 && taskItems[0].projectId) {
                    const updated = taskItems.map((item, index) => {
                      if (index === 0) return item;
                      return {
                        ...item,
                        projectId: taskItems[0].projectId,
                        // Only copy panel if useSamePanel is also checked
                        panel: useSamePanel ? (taskItems[0].panel || '') : item.panel
                      };
                    });
                    setTaskItems(updated);
                  }
                }}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="useSameProject" className="text-sm font-medium text-gray-700 cursor-pointer">
                Keep same project for all tasks
              </label>
            </div>
            {useSameProject && (
              <div className="flex items-center gap-2 pl-6">
                <input
                  type="checkbox"
                  id="useSamePanel"
                  checked={useSamePanel}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseSamePanel(checked);
                    // If checked, copy first task's panel to all other tasks
                    if (checked && taskItems.length > 0 && taskItems[0].panel) {
                      const updated = taskItems.map((item, index) => {
                        if (index === 0) return item;
                        return {
                          ...item,
                          panel: taskItems[0].panel || ''
                        };
                      });
                      setTaskItems(updated);
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="useSamePanel" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Keep same panel for all tasks
                </label>
              </div>
            )}
          </div>
          {taskItems.map((item, index) => {
            const itemProjectPanels = getProjectPanels(item.projectId);
            const itemHasPanels = itemProjectPanels.length > 0;
            return (
              <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-semibold text-gray-700">Task {index + 1}</h3>
                  {taskItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTaskItem(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateTaskItem(index, 'title', e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter task title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={item.description}
                    onChange={(e) => updateTaskItem(index, 'description', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter task description"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project * {useSameProject && index > 0 && <span className="text-xs text-gray-500">(synced with Task 1)</span>}
                  </label>
                  <select
                    value={item.projectId}
                    onChange={(e) => updateTaskItem(index, 'projectId', e.target.value)}
                    required
                    disabled={useSameProject && index > 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a project</option>
                    {projects
                      .filter((project) => project.status === "active")
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                  </select>
                </div>

                {itemHasPanels && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Panel {useSamePanel && useSameProject && index > 0 && <span className="text-xs text-gray-500">(synced with Task 1)</span>}
                    </label>
                    <select
                      value={item.panel || ''}
                      onChange={(e) => updateTaskItem(index, 'panel', e.target.value)}
                      disabled={useSamePanel && useSameProject && index > 0}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select a panel</option>
                      {itemProjectPanels.map((panelName) => (
                        <option key={panelName} value={panelName}>
                          {panelName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={item.status}
                    onChange={(e) => updateTaskItem(index, 'status', e.target.value as TaskStatus)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    {availableStatuses.map((statusOption: string) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </div>

                {item.status === 'Completed' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                    <input
                      type="text"
                      value={item.version}
                      onChange={(e) => updateTaskItem(index, 'version', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., v1.1.1"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Time</label>
                  <input
                    type="text"
                    value={item.estimatedTime || ''}
                    onChange={(e) => updateTaskItem(index, 'estimatedTime', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., 2 hours, 1 day, 3 days"
                  />
                </div>

                {!task && user?.email?.toLowerCase() === 'admin@gmail.com' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign To User *</label>
                    <select
                      value={item.assignedUserId || ''}
                      onChange={(e) => updateTaskItem(index, 'assignedUserId', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="">Select a user</option>
                      {allUsers.map((u) => (
                        <option key={u.uid} value={u.uid}>
                          {u.username || u.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={addTaskItem}
            className="w-full py-2 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-500 hover:text-indigo-600 transition-colors"
          >
            + Add Another Task
          </button>
        </div>
      ) : (
        // Single task form
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter task title"
            />
          </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="Enter task description"
        />
      </div>

      {!task && user?.email?.toLowerCase() === 'admin@gmail.com' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Assign To User *</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Select a user</option>
            {allUsers.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.username || u.email}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
        {!showNewProject ? (
          <div className="flex gap-2">
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">Select a project</option>
              {projects
                .filter((project) => project.status === "active")
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              + New
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="New project name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={async () => {
                  if (newProjectName.trim()) {
                    try {
                      // Set status based on admin status
                      const status: ProjectStatus = user?.email?.toLowerCase() === 'admin@gmail.com' ? 'active' : 'pending';
                      const projectData: any = {
                        name: newProjectName.trim(),
                        description: '',
                        userId: user?.uid || '',
                        status: status,
                      };

                      // Add panels if provided
                      if (hasPanels) {
                        const validPanels = newProjectPanels.filter(p => p.trim() !== '');
                        if (validPanels.length > 0) {
                          projectData.panels = validPanels.map(p => p.trim());
                        }
                      }

                      const newProjectId = await createProject(projectData);
                      setProjectId(newProjectId);
                      setShowNewProject(false);
                      setNewProjectName('');
                      setHasPanels(false);
                      setNewProjectPanels(['']);
                      if (onProjectCreated) {
                        onProjectCreated();
                      }
                    } catch (err: any) {
                      setError(err.message || 'Failed to create project');
                    }
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewProject(false);
                  setNewProjectName('');
                  setHasPanels(false);
                  setNewProjectPanels(['']);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  id="newProjectHasPanels"
                  checked={hasPanels}
                  onChange={(e) => {
                    setHasPanels(e.target.checked);
                    if (!e.target.checked) {
                      setNewProjectPanels(['']);
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="newProjectHasPanels" className="text-sm font-medium text-gray-700 cursor-pointer">
                  This project has different panels
                </label>
              </div>

              {hasPanels && (
                <div className="space-y-2 pl-6">
                  {newProjectPanels.map((panelName, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={panelName}
                        onChange={(e) => {
                          const updated = [...newProjectPanels];
                          updated[index] = e.target.value;
                          setNewProjectPanels(updated);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder={`Panel ${index + 1} (e.g., Admin Panel)`}
                      />
                      {newProjectPanels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewProjectPanels(newProjectPanels.filter((_, i) => i !== index))}
                          className="px-3 py-2 text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setNewProjectPanels([...newProjectPanels, ''])}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    + Add Panel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {hasPanels && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Panel</label>
          <select
            value={panel}
            onChange={(e) => setPanel(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">Select a panel</option>
            {projects
              .find((p) => p.id === projectId)
              ?.panels?.map((panelName) => (
                <option key={panelName} value={panelName}>
                  {panelName}
                </option>
              ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
                  {availableStatuses.map((statusOption: string) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption}
                    </option>
                  ))}
        </select>
      </div>

      {status === 'Completed' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="e.g., v1.1.1"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Time</label>
        <input
          type="text"
          value={estimatedTime}
          onChange={(e) => setEstimatedTime(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          placeholder="e.g., 2 hours, 1 day, 3 days"
        />
      </div>

        </>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Saving...'
            : task
            ? 'Update Task'
            : addMultiple
            ? `Create ${taskItems.length} Task${taskItems.length > 1 ? 's' : ''}`
            : 'Create Task'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
