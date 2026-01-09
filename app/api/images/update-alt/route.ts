import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { imageUrl, altText, projectId } = body;

        if (!imageUrl || altText === undefined) {
            return NextResponse.json(
                { error: "Image URL and alt text are required" },
                { status: 400 }
            );
        }

        if (!projectId) {
            return NextResponse.json(
                { error: "Project ID is required" },
                { status: 400 }
            );
        }

        // Get project settings for WordPress credentials
        const settings = await prisma.projectSettings.findUnique({
            where: { projectId: parseInt(projectId) },
        });

        if (!settings?.cmsUrl || !settings?.cmsApiKey) {
            return NextResponse.json(
                { error: "WordPress credentials not configured for this project" },
                { status: 400 }
            );
        }

        const wpUrl = settings.cmsUrl;
        const wpApiKey = settings.cmsApiKey;

        // First, find the media ID from the URL
        const findMediaUrl = `${wpUrl}/wp-json/mehrana/v1/find-media?url=${encodeURIComponent(imageUrl)}`;
        const findResponse = await fetch(findMediaUrl, {
            headers: {
                "X-MAP-API-Key": wpApiKey,
            },
        });

        if (!findResponse.ok) {
            const error = await findResponse.text();
            return NextResponse.json(
                { error: `Failed to find media: ${error}` },
                { status: findResponse.status }
            );
        }

        const findData = await findResponse.json();
        if (!findData.success || !findData.media_id) {
            return NextResponse.json(
                { error: "Media not found in WordPress library" },
                { status: 404 }
            );
        }

        const mediaId = findData.media_id;

        // Update the alt text
        const updateUrl = `${wpUrl}/wp-json/mehrana/v1/media/${mediaId}/alt`;
        const updateResponse = await fetch(updateUrl, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-MAP-API-Key": wpApiKey,
            },
            body: JSON.stringify({ alt: altText }),
        });

        if (!updateResponse.ok) {
            const error = await updateResponse.text();
            return NextResponse.json(
                { error: `Failed to update alt text: ${error}` },
                { status: updateResponse.status }
            );
        }

        await updateResponse.json();

        // Update the alt text in our local database
        try {
            await prisma.pageImage.updateMany({
                where: {
                    url: imageUrl,
                    projectId: parseInt(projectId),
                },
                data: {
                    alt: altText,
                },
            });
        } catch {
            // Ignore errors - the alt field might not exist in schema
            console.log("Note: Could not update local pageImage alt field");
        }

        return NextResponse.json({
            success: true,
            mediaId,
            altText,
        });
    } catch (error) {
        console.error("Error updating alt text:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update alt text" },
            { status: 500 }
        );
    }
}
