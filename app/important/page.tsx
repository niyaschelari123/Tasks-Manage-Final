"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import {
  getAllImportantItems,
  createImportantItem,
  deleteImportantItem,
} from "@/lib/firestore";
import { ImportantItem } from "@/types";
import ImportantItemModal from "@/components/ImportantItemModal";

export default function ImportantPage() {
  const { user, userProfile, signOut } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<ImportantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadItems();
    }
  }, [user]);

  const loadItems = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const fetchedItems = await getAllImportantItems(user.uid);
      setItems(fetchedItems);
    } catch (error) {
      console.error("Error loading important items:", error);
      alert("Failed to load important items");
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (title: string, description: string) => {
    if (!user) return;

    try {
      await createImportantItem(title, description, {
        uid: user.uid,
        email: user.email || undefined,
        username: userProfile?.username || undefined,
      });
      await loadItems();
      setShowModal(false);
    } catch (error) {
      console.error("Error creating important item:", error);
      alert("Failed to create important item");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      await deleteImportantItem(id);
      await loadItems();
    } catch (error) {
      console.error("Error deleting important item:", error);
      alert("Failed to delete important item");
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
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.push("/dashboard")}
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

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">
              Important Information
            </h2>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Add New Item
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-500">Loading items...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-500 mb-4">
                No important items yet
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Add Your First Item
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/important/${item.slug}`)}
                >
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {item.title}
                  </h3>
                  <div
                    className="text-sm text-gray-600 mb-4 line-clamp-3"
                    dangerouslySetInnerHTML={{
                      __html:
                        item.description.length > 150
                          ? item.description.substring(0, 150) + "..."
                          : item.description,
                    }}
                  />
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(item.id);
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {showModal && (
          <ImportantItemModal
            isOpen={showModal}
            onClose={() => setShowModal(false)}
            onSave={handleAddItem}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}

