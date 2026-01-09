import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { imageUrl, projectId } = body;

        if (!imageUrl) {
            return NextResponse.json(
                { error: "Image URL is required" },
                { status: 400 }
            );
        }

        // Get project settings for brand statement
        let brandStatement = "";
        if (projectId) {
            const settings = await prisma.projectSettings.findUnique({
                where: { projectId: parseInt(projectId) },
            });
            if (settings?.brandStatement) {
                brandStatement = settings.brandStatement;
            }
        }

        // Build the prompt
        let systemPrompt = `You are an SEO expert that writes concise, descriptive alt text for images.
Your alt text should:
- Be 125 characters or less
- Describe what the image shows clearly
- Be relevant for accessibility (screen readers)
- Include relevant keywords naturally when appropriate
- Not start with "Image of" or "Picture of"`;

        if (brandStatement) {
            systemPrompt += `\n\nBrand Context:\n${brandStatement}\nIncorporate brand voice and terminology when relevant.`;
        }

        // Call OpenAI Vision
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Write alt text for this image. Reply with ONLY the alt text, nothing else.",
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl,
                                detail: "low",
                            },
                        },
                    ],
                },
            ],
            max_tokens: 100,
        });

        const altText = response.choices[0]?.message?.content?.trim() || "";

        return NextResponse.json({
            success: true,
            altText,
            imageUrl,
        });
    } catch (error) {
        console.error("Error generating alt text:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate alt text" },
            { status: 500 }
        );
    }
}
