"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
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
import { Toggle } from '@/components/ui/toggle'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface RichEditorProps {
    content: string
    onChange: (html: string) => void
    placeholder?: string
    editable?: boolean
}

export function RichEditor({ content, onChange, placeholder = "Start writing...", editable = true }: RichEditorProps) {
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
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg max-w-none focus:outline-none min-h-[400px] p-4'
            }
        }
    })

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
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-slate-50">
                <Toggle
                    size="sm"
                    pressed={editor.isActive('bold')}
                    onPressedChange={() => editor.chain().focus().toggleBold().run()}
                >
                    <Bold className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('italic')}
                    onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                >
                    <Italic className="h-4 w-4" />
                </Toggle>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <Toggle
                    size="sm"
                    pressed={editor.isActive('heading', { level: 1 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                >
                    <Heading1 className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('heading', { level: 2 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                    <Heading2 className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('heading', { level: 3 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                    <Heading3 className="h-4 w-4" />
                </Toggle>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <Toggle
                    size="sm"
                    pressed={editor.isActive('bulletList')}
                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                >
                    <List className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('orderedList')}
                    onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                >
                    <ListOrdered className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('blockquote')}
                    onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                >
                    <Quote className="h-4 w-4" />
                </Toggle>

                <Separator orientation="vertical" className="h-6 mx-1" />

                <Button variant="ghost" size="sm" onClick={addLink}>
                    <LinkIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={addImage}>
                    <ImageIcon className="h-4 w-4" />
                </Button>

                <div className="flex-1" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo()}
                >
                    <Undo className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo()}
                >
                    <Redo className="h-4 w-4" />
                </Button>
            </div>

            {/* Editor Area */}
            <EditorContent editor={editor} className="min-h-[400px]" />
        </div>
    )
}
