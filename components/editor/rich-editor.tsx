"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useState } from 'react'
import {
    Bold,
    Italic,
    List,
    ListOrdered,
    Heading1,
    Heading2,
    Heading3,
    Link as LinkIcon,
    Image as ImageIcon,
    Undo,
    Redo,
    Quote
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface RichEditorProps {
    content: string
    onChange: (html: string) => void
    placeholder?: string
    editable?: boolean
}

export function RichEditor({ content, onChange, placeholder = "Start writing...", editable = true }: RichEditorProps) {
    // Track active states manually for reactivity
    const [activeStates, setActiveStates] = useState({
        bold: false,
        italic: false,
        h1: false,
        h2: false,
        h3: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        link: false
    })

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3]
                }
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-600 underline hover:text-blue-800'
                }
            }),
            Image.configure({
                inline: false,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'max-w-full rounded-lg my-4'
                }
            }),
            Placeholder.configure({
                placeholder
            })
        ],
        content,
        editable,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
            updateActiveStates(editor)
        },
        onSelectionUpdate: ({ editor }) => {
            updateActiveStates(editor)
        },
        onTransaction: ({ editor }) => {
            updateActiveStates(editor)
        },
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-[400px] p-4'
            }
        }
    }, [])

    function updateActiveStates(ed: typeof editor) {
        if (!ed) return
        setActiveStates({
            bold: ed.isActive('bold'),
            italic: ed.isActive('italic'),
            h1: ed.isActive('heading', { level: 1 }),
            h2: ed.isActive('heading', { level: 2 }),
            h3: ed.isActive('heading', { level: 3 }),
            bulletList: ed.isActive('bulletList'),
            orderedList: ed.isActive('orderedList'),
            blockquote: ed.isActive('blockquote'),
            link: ed.isActive('link')
        })
    }

    // Sync content when it changes externally
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content, { emitUpdate: false })
        }
    }, [content, editor])

    // Initial state update
    useEffect(() => {
        if (editor) {
            updateActiveStates(editor)
        }
    }, [editor])

    if (!editor) return null

    const addLink = () => {
        const url = window.prompt('Enter URL:')
        if (url) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }
    }

    const addImage = () => {
        const url = window.prompt('Enter image URL:')
        if (url) {
            editor.chain().focus().setImage({ src: url }).run()
        }
    }

    return (
        <div className="border rounded-lg overflow-hidden bg-white">
            {/* Toolbar - STICKY */}
            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 p-2 border-b bg-slate-50">
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        activeStates.bold && "bg-slate-300 text-blue-600"
                    )}
                >
                    <Bold className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        activeStates.italic && "bg-slate-300 text-blue-600"
                    )}
                >
                    <Italic className="h-4 w-4" />
                </button>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        activeStates.h1 && "bg-slate-300 text-blue-600"
                    )}
                >
                    <Heading1 className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        activeStates.h2 && "bg-slate-300 text-blue-600"
                    )}
                >
                    <Heading2 className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        activeStates.h3 && "bg-slate-300 text-blue-600"
                    )}
                >
                    <Heading3 className="h-4 w-4" />
                </button>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        activeStates.bulletList && "bg-slate-300 text-blue-600"
                    )}
                >
                    <List className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        activeStates.orderedList && "bg-slate-300 text-blue-600"
                    )}
                >
                    <ListOrdered className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        activeStates.blockquote && "bg-slate-300 text-blue-600"
                    )}
                >
                    <Quote className="h-4 w-4" />
                </button>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <button
                    type="button"
                    onClick={addLink}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        activeStates.link && "bg-slate-300 text-blue-600"
                    )}
                >
                    <LinkIcon className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={addImage}
                    className="p-2 rounded hover:bg-slate-200 transition-colors"
                >
                    <ImageIcon className="h-4 w-4" />
                </button>

                <div className="flex-1" />

                <button
                    type="button"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        !editor.can().undo() && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <Undo className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                    className={cn(
                        "p-2 rounded hover:bg-slate-200 transition-colors",
                        !editor.can().redo() && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <Redo className="h-4 w-4" />
                </button>
            </div>

            {/* Editor Area with heading styles */}
            <style jsx global>{`
                .ProseMirror {
                    min-height: 400px;
                    padding: 1rem;
                }
                .ProseMirror:focus {
                    outline: none;
                }
                .ProseMirror h1 {
                    font-size: 2rem;
                    font-weight: 700;
                    margin: 1.5rem 0 1rem 0;
                    line-height: 1.2;
                }
                .ProseMirror h2 {
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin: 1.25rem 0 0.75rem 0;
                    line-height: 1.3;
                }
                .ProseMirror h3 {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin: 1rem 0 0.5rem 0;
                    line-height: 1.4;
                }
                .ProseMirror p {
                    margin: 0.75rem 0;
                    line-height: 1.7;
                }
                .ProseMirror ul, .ProseMirror ol {
                    padding-left: 1.5rem;
                    margin: 0.75rem 0;
                }
                .ProseMirror li {
                    margin: 0.25rem 0;
                }
                .ProseMirror li p {
                    margin: 0;
                }
                .ProseMirror blockquote {
                    border-left: 4px solid #e2e8f0;
                    padding-left: 1rem;
                    margin: 1rem 0;
                    color: #64748b;
                    font-style: italic;
                }
                .ProseMirror img {
                    max-width: 100%;
                    border-radius: 0.5rem;
                    margin: 1rem 0;
                }
                .ProseMirror a {
                    color: #2563eb;
                    text-decoration: underline;
                }
                .ProseMirror strong {
                    font-weight: 600;
                }
                .ProseMirror em {
                    font-style: italic;
                }
                .ProseMirror p.is-editor-empty:first-child::before {
                    content: attr(data-placeholder);
                    color: #adb5bd;
                    pointer-events: none;
                    float: left;
                    height: 0;
                }
            `}</style>
            <EditorContent editor={editor} />
        </div>
    )
}
