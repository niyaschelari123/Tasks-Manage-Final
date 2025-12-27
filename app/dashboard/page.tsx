"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getProjects } from "@/lib/firestore";
import { Project } from "@/types";
import TaskList from "@/components/TaskList";
import ProjectManager from "@/components/ProjectManager";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminPanel from "@/components/AdminPanel";

export default function DashboardPage() {
  const { user, userProfile, signOut } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user, userProfile]);

  const loadProjects = async () => {
    if (!user) return;
    try {
      setLoading(true);
      // All users can see all projects
      const fetchedProjects = await getProjects();
      console.log("Loaded projects:", fetchedProjects);
      setProjects(fetchedProjects);
    } catch (error) {
      console.error("Error loading projects:", error);
      // Show error to user
      alert(
        "Failed to load projects. Please check the browser console for details."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <h1 className="text-xl font-bold text-gray-800">
                Task Management System
              </h1>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">{user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AdminPanel />
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <ProjectManager onProjectCreated={loadProjects} />
              {loading ? (
                <span className="text-sm text-gray-500">
                  Loading projects...
                </span>
              ) : (
                <span className="text-sm text-gray-600">
                  {projects.length} project{projects.length !== 1 ? "s" : ""}{" "}
                  loaded
                </span>
              )}
            </div>
            {projects.length > 0 && (
              <div className="text-xs text-gray-500 mb-2">
                Projects: {projects.map((p) => p.name).join(", ")}
              </div>
            )}
          </div>
          <TaskList projects={projects} onProjectCreated={loadProjects} />
        </main>
      </div>
    </ProtectedRoute>
  );
}
