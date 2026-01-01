"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter description...",
}: RichTextEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-indigo-600 underline",
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[200px] p-4",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!mounted || !editor) {
    return (
      <div className="h-64 border border-gray-300 rounded-lg p-4 bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg bg-white">
      {/* Toolbar */}
      <div className="border-b border-gray-300 p-2 flex flex-wrap gap-2">
        {/* Text Formatting */}
        <div className="flex gap-1 border-r border-gray-300 pr-2">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={!editor.can().chain().focus().toggleBold().run()}
            className={`px-2 py-1 rounded ${
              editor.isActive("bold")
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={!editor.can().chain().focus().toggleItalic().run()}
            className={`px-2 py-1 rounded ${
              editor.isActive("italic")
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Italic"
          >
            <em>I</em>
          </button>
          <button
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={!editor.can().chain().focus().toggleStrike().run()}
            className={`px-2 py-1 rounded ${
              editor.isActive("strike")
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Strikethrough"
          >
            <span className="line-through">S</span>
          </button>
        </div>

        {/* Headings */}
        <div className="flex gap-1 border-r border-gray-300 pr-2">
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-2 py-1 rounded ${
              editor.isActive("heading", { level: 1 })
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 rounded ${
              editor.isActive("heading", { level: 2 })
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 py-1 rounded ${
              editor.isActive("heading", { level: 3 })
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Heading 3"
          >
            H3
          </button>
        </div>

        {/* Lists */}
        <div className="flex gap-1 border-r border-gray-300 pr-2">
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-2 py-1 rounded ${
              editor.isActive("bulletList")
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Bullet List"
          >
            •
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-2 py-1 rounded ${
              editor.isActive("orderedList")
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Numbered List"
          >
            1.
          </button>
        </div>

        {/* Alignment */}
        <div className="flex gap-1 border-r border-gray-300 pr-2">
          <button
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={`px-2 py-1 rounded ${
              editor.isActive({ textAlign: "left" })
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Align Left"
          >
            ⬅
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={`px-2 py-1 rounded ${
              editor.isActive({ textAlign: "center" })
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Align Center"
          >
            ⬌
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={`px-2 py-1 rounded ${
              editor.isActive({ textAlign: "right" })
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Align Right"
          >
            ➡
          </button>
        </div>

        {/* Link */}
        <div className="flex gap-1 border-r border-gray-300 pr-2">
          <button
            onClick={() => {
              const url = window.prompt("Enter URL:");
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }}
            className={`px-2 py-1 rounded ${
              editor.isActive("link")
                ? "bg-indigo-100 text-indigo-700"
                : "hover:bg-gray-100"
            }`}
            title="Add Link"
          >
            🔗
          </button>
          <button
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={!editor.isActive("link")}
            className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Remove Link"
          >
            🔗✕
          </button>
        </div>

        {/* Color */}
        <div className="flex gap-1">
          <input
            type="color"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
            title="Text Color"
          />
          <button
            onClick={() => editor.chain().focus().unsetColor().run()}
            className="px-2 py-1 rounded hover:bg-gray-100"
            title="Reset Color"
          >
            ↺
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="min-h-[200px] max-h-[400px] overflow-y-auto"
      />
    </div>
  );
}

