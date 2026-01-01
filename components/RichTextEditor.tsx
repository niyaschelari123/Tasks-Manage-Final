"use client";

import { useRef, useEffect, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import { getTinyMCEApiKey } from "@/lib/firestore";

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
  const editorRef = useRef<any>(null);
  const [apiKey, setApiKey] = useState<string>("no-api-key");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load API key from Firebase
    const loadApiKey = async () => {
      try {
        const key = await getTinyMCEApiKey();
        setApiKey(key || process.env.NEXT_PUBLIC_TINYMCE_API_KEY || "no-api-key");
      } catch (error) {
        console.error("Error loading TinyMCE API key:", error);
        setApiKey(process.env.NEXT_PUBLIC_TINYMCE_API_KEY || "no-api-key");
      } finally {
        setLoading(false);
      }
    };
    loadApiKey();
  }, []);

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.getContent()) {
      editorRef.current.setContent(value || "");
    }
  }, [value]);

  if (loading) {
    return (
      <div className="h-64 border border-gray-300 rounded-lg p-4 bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading editor...</div>
      </div>
    );
  }

  return (
    <div className="border border-gray-300 rounded-lg bg-white">
      <Editor
        apiKey={apiKey}
        onInit={(evt, editor) => {
          editorRef.current = editor;
        }}
        initialValue={value || ""}
        onEditorChange={(content) => {
          onChange(content);
        }}
        init={{
          height: 400,
          menubar: false,
          plugins: [
            "advlist",
            "autolink",
            "lists",
            "link",
            "image",
            "charmap",
            "preview",
            "anchor",
            "searchreplace",
            "visualblocks",
            "code",
            "fullscreen",
            "insertdatetime",
            "media",
            "table",
            "help",
            "wordcount",
            "fontsize",
          ],
          toolbar:
            "undo redo | blocks | fontsize | " +
            "bold italic forecolor | alignleft aligncenter " +
            "alignright alignjustify | bullist numlist outdent indent | " +
            "removeformat | help",
          font_size_formats: "8pt 10pt 12pt 14pt 16pt 18pt 24pt 36pt 48pt",
          content_style:
            "body { font-family:Helvetica,Arial,sans-serif; font-size:14px }",
          placeholder: placeholder,
        }}
      />
    </div>
  );
}
