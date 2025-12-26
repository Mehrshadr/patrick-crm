import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// GET - Serve uploaded images
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const { path: pathSegments } = await params
        const imagePath = pathSegments.join('/')

        const fullPath = path.join(process.cwd(), 'public', 'uploads', 'content', imagePath)

        // Security: Check if path is within allowed directory
        const allowedBase = path.join(process.cwd(), 'public', 'uploads', 'content')
        const resolvedPath = path.resolve(fullPath)

        if (!resolvedPath.startsWith(allowedBase)) {
            return NextResponse.json({ error: "Invalid path" }, { status: 403 })
        }

        if (!fs.existsSync(resolvedPath)) {
            return NextResponse.json({ error: "File not found" }, { status: 404 })
        }

        const fileBuffer = fs.readFileSync(resolvedPath)

        // Determine content type
        const ext = path.extname(resolvedPath).toLowerCase()
        const contentTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }

        const contentType = contentTypes[ext] || 'application/octet-stream'

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        })
    } catch (error: any) {
        console.error("Failed to serve image:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
