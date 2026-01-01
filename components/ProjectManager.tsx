'use client';

import { useState } from 'react';
import { createProject } from '@/lib/firestore';
import { Project, ProjectStatus } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface ProjectManagerProps {
  onProjectCreated: () => void;
}

export default function ProjectManager({ onProjectCreated }: ProjectManagerProps) {
  const { user, userProfile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hasPanels, setHasPanels] = useState(false);
  const [panels, setPanels] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required');
      return;
    }

    if (!user?.uid) {
      setError('You must be logged in to create a project');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Creating project with userId:', user.uid);
      // Set status based on admin status
      const status: ProjectStatus = user?.email?.toLowerCase() === 'admin@gmail.com' ? 'active' : 'pending';
      const projectData: any = {
        name: name.trim(),
        description: description.trim(),
        userId: user.uid,
        status: status,
      };

      // Add panels if hasPanels is true and panels are provided
      if (hasPanels) {
        const validPanels = panels.filter(p => p.trim() !== '');
        if (validPanels.length > 0) {
          projectData.panels = validPanels.map(p => p.trim());
        }
      }

      const projectId = await createProject(projectData);
      console.log('Project created with ID:', projectId);
      setName('');
      setDescription('');
      setHasPanels(false);
      setPanels(['']);
      setShowForm(false);
      onProjectCreated();
    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 mt-10"
      >
        + New Project
      </button>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Enter project name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Enter project description"
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="hasPanels"
              checked={hasPanels}
              onChange={(e) => {
                setHasPanels(e.target.checked);
                if (!e.target.checked) {
                  setPanels(['']);
                }
              }}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="hasPanels" className="text-sm font-medium text-gray-700 cursor-pointer">
              This project has different panels (e.g., Admin Panel, Customer Panel)
            </label>
          </div>

          {hasPanels && (
            <div className="space-y-2 pl-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Panels</label>
              {panels.map((panel, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={panel}
                    onChange={(e) => {
                      const updated = [...panels];
                      updated[index] = e.target.value;
                      setPanels(updated);
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder={`Panel ${index + 1} (e.g., Admin Panel)`}
                  />
                  {panels.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPanels(panels.filter((_, i) => i !== index))}
                      className="px-3 py-2 text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPanels([...panels, ''])}
                className="text-sm text-indigo-600 hover:text-indigo-800"
              >
                + Add Panel
              </button>
            </div>
          )}
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setName('');
              setDescription('');
              setHasPanels(false);
              setPanels(['']);
              setError('');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

