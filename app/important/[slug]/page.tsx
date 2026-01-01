"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getImportantItemBySlug, updateImportantItem, deleteImportantItem } from "@/lib/firestore";
import { ImportantItem } from "@/types";
import ImportantItemModal from "@/components/ImportantItemModal";

export default function ImportantItemDetailPage() {
  const { user, userProfile, signOut } = useAuth();
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  
  const [item, setItem] = useState<ImportantItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (slug && user) {
      loadItem();
    }
  }, [slug, user]);

  const loadItem = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const fetchedItem = await getImportantItemBySlug(slug, user.uid);
      if (!fetchedItem) {
        alert("Item not found");
        router.push("/important");
        return;
      }
      setItem(fetchedItem);
    } catch (error) {
      console.error("Error loading important item:", error);
      alert("Failed to load important item");
      router.push("/important");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItem = async (title: string, description: string) => {
    if (!user || !item) return;

    try {
      await updateImportantItem(item.id, title, description, {
        uid: user.uid,
        email: user.email || undefined,
        username: userProfile?.username || undefined,
      });
      await loadItem();
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating important item:", error);
      alert("Failed to update important item");
    }
  };

  const handleDeleteItem = async () => {
    if (!item) return;
    
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      await deleteImportantItem(item.id);
      router.push("/important");
    } catch (error) {
      console.error("Error deleting important item:", error);
      alert("Failed to delete important item");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const canEdit = user && item && (user.uid === item.userId || user.email?.toLowerCase() === "admin@gmail.com");

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push("/important")}
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
                  Important Items
                </h1>
              </div>
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

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-500">Loading item...</div>
            </div>
          ) : !item ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-500">Item not found</div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-3xl font-bold text-gray-800">
                  {item.title}
                </h2>
                {canEdit && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={handleDeleteItem}
                      className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
              
              <div className="mb-6">
                <div
                  dangerouslySetInnerHTML={{ __html: item.description }}
                  className="text-gray-700 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_li]:mb-2 [&_a]:text-indigo-600 [&_a]:underline [&_strong]:font-bold [&_em]:italic"
                />
              </div>

              <div className="border-t border-gray-200 pt-4 text-sm text-gray-500">
                <div className="flex justify-between items-center">
                  <div>
                    <span>Created: {new Date(item.createdAt).toLocaleString()}</span>
                    {item.updatedAt.getTime() !== item.createdAt.getTime() && (
                      <span className="ml-4">
                        Updated: {new Date(item.updatedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {item.username && (
                    <span>By: {item.username}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {showEditModal && item && (
          <ImportantItemModal
            isOpen={showEditModal}
            onClose={() => setShowEditModal(false)}
            onSave={handleUpdateItem}
            initialTitle={item.title}
            initialDescription={item.description}
            isEditing={true}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

