"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback, useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface RichEditorProps {
    content: string
    onChange: (html: string) => void
    placeholder?: string
    editable?: boolean
}

export function RichEditor({ content, onChange, placeholder = "Start writing...", editable = true }: RichEditorProps) {
    const [, forceUpdate] = useState(0)

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                    HTMLAttributes: {
                        class: ''
                    }
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
        },
        onSelectionUpdate: () => {
            // Force re-render to update toolbar buttons
            forceUpdate(n => n + 1)
        },
        editorProps: {
            attributes: {
                class: 'focus:outline-none min-h-[400px] p-4'
            }
        }
    }, []) // Empty deps to avoid re-creating editor

    // Sync content when it changes externally
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content, { emitUpdate: false })
        }
    }, [content, editor])

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

    const ToolbarButton = ({
        onClick,
        isActive,
        children,
        disabled
    }: {
        onClick: () => void
        isActive?: boolean
        children: React.ReactNode
        disabled?: boolean
    }) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "p-2 rounded hover:bg-slate-200 transition-colors",
                isActive && "bg-slate-200 text-blue-600",
                disabled && "opacity-50 cursor-not-allowed"
            )}
        >
            {children}
        </button>
    )

    return (
        <div className="border rounded-lg overflow-hidden bg-white">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-slate-50">
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive('bold')}
                >
                    <Bold className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive('italic')}
                >
                    <Italic className="h-4 w-4" />
                </ToolbarButton>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    isActive={editor.isActive('heading', { level: 1 })}
                >
                    <Heading1 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    isActive={editor.isActive('heading', { level: 2 })}
                >
                    <Heading2 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    isActive={editor.isActive('heading', { level: 3 })}
                >
                    <Heading3 className="h-4 w-4" />
                </ToolbarButton>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive('bulletList')}
                >
                    <List className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    isActive={editor.isActive('orderedList')}
                >
                    <ListOrdered className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    isActive={editor.isActive('blockquote')}
                >
                    <Quote className="h-4 w-4" />
                </ToolbarButton>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <ToolbarButton onClick={addLink} isActive={editor.isActive('link')}>
                    <LinkIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={addImage}>
                    <ImageIcon className="h-4 w-4" />
                </ToolbarButton>

                <div className="flex-1" />

                <ToolbarButton
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                >
                    <Undo className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                >
                    <Redo className="h-4 w-4" />
                </ToolbarButton>
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
