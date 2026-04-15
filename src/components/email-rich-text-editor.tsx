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
import { sanitizeEmailHtml } from "@/lib/email/html";

export type EmailRichTextEditorHandle = {
  insertText: (text: string) => void;
  focus: () => void;
};

type EmailRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  tokens: readonly string[];
  placeholder?: string;
  onFocus?: () => void;
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
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-semibold transition",
    active
      ? "border-slate-900 bg-slate-900 text-white"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  ].join(" ");
}

export const EmailRichTextEditor = forwardRef<
  EmailRichTextEditorHandle,
  EmailRichTextEditorProps
>(function EmailRichTextEditor(
  { value, onChange, tokens, placeholder = "Write your email message...", onFocus },
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
          "min-h-56 w-full px-4 py-3 text-sm leading-6 text-slate-900 outline-none",
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

  const insertToken = (token: string) => {
    if (!token) return;
    editor.chain().focus().insertContent(token).run();
  };

  const increaseIndent = () => {
    if (editor.isActive("listItem")) {
      editor.chain().focus().sinkListItem("listItem").run();
      return;
    }
    const currentIndent = Number(editor.getAttributes("paragraph").indent || 0);
    editor.commands.updateAttributes("paragraph", {
      indent: Math.min(currentIndent + 1, 6),
    });
  };

  const decreaseIndent = () => {
    if (editor.isActive("listItem")) {
      editor.chain().focus().liftListItem("listItem").run();
      return;
    }
    const currentIndent = Number(editor.getAttributes("paragraph").indent || 0);
    editor.commands.updateAttributes("paragraph", {
      indent: Math.max(currentIndent - 1, 0),
    });
  };

  return (
    <div className="rounded-md border border-slate-300 bg-white focus-within:border-blue-500">
      <style jsx global>{`
        .email-rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: rgb(100 116 139);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .email-rich-text-editor .ProseMirror p {
          margin: 0 0 0.75rem;
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
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
        <button type="button" className={toolbarButtonClass(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </button>
        <button type="button" className={toolbarButtonClass(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </button>
        <button type="button" className={toolbarButtonClass(editor.isActive("underline"))} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          U
        </button>
        <button type="button" className={toolbarButtonClass(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()}>
          S
        </button>
        <select
          aria-label="Font size"
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
          defaultValue=""
          onChange={(event) => applyFontSize(event.target.value)}
        >
          {FONT_SIZES.map((size) => (
            <option key={size.label} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
        <label className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700">
          Text
          <input
            aria-label="Text color"
            type="color"
            className="size-5 cursor-pointer border-0 bg-transparent p-0"
            onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
          />
        </label>
        <label className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700">
          Highlight
          <input
            aria-label="Highlight color"
            type="color"
            className="size-5 cursor-pointer border-0 bg-transparent p-0"
            onChange={(event) => editor.chain().focus().toggleHighlight({ color: event.target.value }).run()}
          />
        </label>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <button type="button" className={toolbarButtonClass(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Bullets
        </button>
        <button type="button" className={toolbarButtonClass(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. 2.
        </button>
        <button type="button" className={toolbarButtonClass()} onClick={increaseIndent}>
          Indent
        </button>
        <button type="button" className={toolbarButtonClass()} onClick={decreaseIndent}>
          Outdent
        </button>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <button type="button" className={toolbarButtonClass(editor.isActive({ textAlign: "left" }))} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          Left
        </button>
        <button type="button" className={toolbarButtonClass(editor.isActive({ textAlign: "center" }))} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          Center
        </button>
        <button type="button" className={toolbarButtonClass(editor.isActive({ textAlign: "right" }))} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          Right
        </button>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <button type="button" className={toolbarButtonClass()} onClick={() => editor.chain().focus().undo().run()}>
          Undo
        </button>
        <button type="button" className={toolbarButtonClass()} onClick={() => editor.chain().focus().redo().run()}>
          Redo
        </button>
        <button type="button" className={toolbarButtonClass()} onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          Clear
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold text-slate-600">Insert token</span>
        <select
          aria-label="Insert token"
          className="h-8 max-w-full rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700"
          defaultValue=""
          onChange={(event) => {
            insertToken(event.target.value);
            event.target.value = "";
          }}
        >
          <option value="">Choose a token...</option>
          {tokens.map((token) => (
            <option key={token} value={token}>
              {token}
            </option>
          ))}
        </select>
      </div>
      <div className="email-rich-text-editor">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
