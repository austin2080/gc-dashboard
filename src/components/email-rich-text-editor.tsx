"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
} from "react";
import { Extension } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Palette,
  Paperclip,
  Type,
  Underline as UnderlineIcon,
} from "lucide-react";
import { sanitizeEmailHtml } from "@/lib/email/html";

export type EmailRichTextEditorHandle = {
  insertText: (text: string) => void;
  focus: () => void;
};

type EmailRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  attachmentLabel?: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).run(),
    };
  },
});

const TextIndent = Extension.create({
  name: "textIndent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "listItem"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const marginLeft = Number.parseInt(element.style.marginLeft || "0", 10);
              return Number.isFinite(marginLeft) ? Math.round(marginLeft / 24) : 0;
            },
            renderHTML: (attributes) => {
              const indent = Number(attributes.indent || 0);
              if (!indent) return {};
              return {
                style: `margin-left: ${indent * 24}px`,
              };
            },
          },
        },
      },
    ];
  },
});

const FONT_SIZES = [
  { label: "Size", value: "" },
  { label: "12", value: "12px" },
  { label: "14", value: "14px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "24", value: "24px" },
];

function toolbarButtonClass(active = false) {
  return [
    "inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-2 text-slate-500 transition",
    active
      ? "bg-slate-100 text-slate-900"
      : "hover:bg-slate-50 hover:text-slate-900",
  ].join(" ");
}

export const EmailRichTextEditor = forwardRef<
  EmailRichTextEditorHandle,
  EmailRichTextEditorProps
>(function EmailRichTextEditor(
  { value, onChange, placeholder = "Write your email message...", onFocus, attachmentLabel },
  ref
) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
      }),
      TextStyle,
      FontSize,
      TextIndent,
      Color,
      Highlight.configure({ multicolor: true }),
      Underline,
      TextAlign.configure({
        types: ["paragraph"],
        alignments: ["left", "center", "right"],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[420px] w-full px-10 py-8 text-[18px] leading-7 text-slate-900 outline-none",
      },
      transformPastedHTML: (html) => sanitizeEmailHtml(html),
    },
    onFocus,
    onUpdate: ({ editor: nextEditor }) => {
      onChange(sanitizeEmailHtml(nextEditor.getHTML()));
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
      focus: () => {
        editor?.chain().focus().run();
      },
    }),
    [editor]
  );

  useEffect(() => {
    if (!editor) return;
    const cleanValue = sanitizeEmailHtml(value);
    if (cleanValue !== sanitizeEmailHtml(editor.getHTML())) {
      editor.commands.setContent(cleanValue, { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="min-h-56 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
        Loading editor...
      </div>
    );
  }

  const applyFontSize = (fontSize: string) => {
    const chain = editor.chain().focus();
    if (fontSize) {
      chain.setFontSize(fontSize).run();
    } else {
      chain.unsetFontSize().run();
    }
  };

  return (
    <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white focus-within:border-blue-500">
      <style jsx global>{`
        .email-rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: rgb(100 116 139);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .email-rich-text-editor .ProseMirror p {
          margin: 0 0 1.5rem;
        }
        .email-rich-text-editor .ProseMirror p:last-child {
          margin-bottom: 0;
        }
        .email-rich-text-editor .ProseMirror ul,
        .email-rich-text-editor .ProseMirror ol {
          margin: 0 0 0.75rem 1.25rem;
          padding-left: 1rem;
        }
        .email-rich-text-editor .ProseMirror ul {
          list-style: disc;
        }
        .email-rich-text-editor .ProseMirror ol {
          list-style: decimal;
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-slate-200 bg-white px-2 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" className={toolbarButtonClass(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold">
            <Bold className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" className={toolbarButtonClass(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic">
            <Italic className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" className={toolbarButtonClass(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()} aria-label="Underline">
            <UnderlineIcon className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="mx-1 h-10 w-px bg-slate-200" />
          <button type="button" className={toolbarButtonClass(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list">
            <List className="h-4 w-4" strokeWidth={2} />
          </button>
          <button type="button" className={toolbarButtonClass(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Numbered list">
            <ListOrdered className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="mx-1 h-10 w-px bg-slate-200" />
          <button
            type="button"
            className={toolbarButtonClass()}
            onClick={() => editor.chain().focus().insertContent("{portal_link}").run()}
            aria-label="Insert link"
          >
            <Link2 className="h-4 w-4" strokeWidth={2} />
          </button>
          <label className="relative inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-50 hover:text-slate-900">
            <Palette className="h-4 w-4" strokeWidth={2} />
            <input
              aria-label="Highlight color"
              type="color"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()}
            />
          </label>
          <button type="button" className={toolbarButtonClass()} onClick={() => applyFontSize("18px")} aria-label="Large text">
            <Type className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        {attachmentLabel ? (
          <div className="inline-flex items-center gap-3 text-[15px] font-medium text-slate-500">
            <Paperclip className="h-4 w-4" />
            <span>{attachmentLabel}</span>
          </div>
        ) : null}
      </div>
      <div className="email-rich-text-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
