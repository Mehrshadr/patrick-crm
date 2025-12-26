import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

interface GenerateContentOptions {
    brief: string
    contentType: 'BLOG_POST' | 'SERVICE_PAGE'
    brandStatement?: string | null
    guidelines?: string | null
    aiRules?: string | null
    useGuidelines: boolean
    useAiRules: boolean
}

interface ImageSpec {
    position: number
    prompt: string
    alt: string
    filename: string
}

interface GenerateContentResult {
    title: string
    content: string
    fullPrompt: string
    images: ImageSpec[]
}

// Extract word count from brief if specified
function extractWordCount(brief: string): { min: number; max: number } | null {
    const rangeMatch = brief.match(/(\d{3,4})\s*[-–to]+\s*(\d{3,4})\s*(words?)?/i)
    if (rangeMatch) {
        return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) }
    }

    const singleMatch = brief.match(/(minimum\s+)?(\d{3,4})\s*words?/i)
    if (singleMatch) {
        const count = parseInt(singleMatch[2])
        return { min: count, max: count + 500 }
    }

    return null
}

// Extract image count from brief if specified
function extractImageCount(brief: string): number | null {
    const match = brief.match(/(\d+)[-–](\d+)\s*images?/i)
    if (match) {
        return parseInt(match[2]) // Use the higher number
    }
    const singleMatch = brief.match(/(\d+)\s*images?/i)
    if (singleMatch) {
        return parseInt(singleMatch[1])
    }
    return null
}

export async function generateContent(options: GenerateContentOptions): Promise<GenerateContentResult> {
    const {
        brief,
        contentType,
        brandStatement,
        guidelines,
        aiRules,
        useGuidelines,
        useAiRules
    } = options

    // Extract requirements from brief
    const wordCount = extractWordCount(brief)
    const targetWords = wordCount ? `${wordCount.min}-${wordCount.max}` : '1000-1500'
    const minWords = wordCount?.min || 1000
    const imageCount = extractImageCount(brief) || Math.ceil(minWords / 400) // 1 image per 400 words

    // Build the system prompt
    let systemPrompt = `You are an expert SEO content writer who creates comprehensive, in-depth articles with image placement recommendations.

## CRITICAL REQUIREMENTS
1. **WORD COUNT**: Your content MUST be between ${targetWords} words. This is NON-NEGOTIABLE. Count your words and ensure you meet this requirement.
2. **THOROUGHNESS**: Cover every heading/topic mentioned in the brief with substantial, detailed paragraphs (2-3 paragraphs per heading minimum).
3. **NO SHORTCUTS**: Do not summarize or abbreviate. Each section needs proper depth with examples and explanations.
4. **STRUCTURE**: Use proper HTML semantic tags (h2, h3, p, ul, li, strong, em).
5. **IMAGES**: Generate ${imageCount} image specifications for DALL-E image generation.

## Content Type
You are creating a ${contentType === 'BLOG_POST' ? 'detailed blog post' : 'comprehensive service page'}.`

    if (brandStatement) {
        systemPrompt += `\n\n## Brand Voice & Identity\n${brandStatement}\nMatch this brand's tone, style, and personality throughout the content.`
    }

    if (useGuidelines && guidelines) {
        systemPrompt += `\n\n## Content Guidelines\nStrictly follow these guidelines:\n${guidelines}`
    }

    if (useAiRules && aiRules) {
        systemPrompt += `\n\n## AI Behavior Rules\n${aiRules}`
    }

    systemPrompt += `

## Image Generation Requirements
- Generate ${imageCount} image specifications
- Each image should be photorealistic, 16:9 aspect ratio
- Images should illustrate different sections of the content
- No text overlays, watermarks, or logos
- Each image needs a detailed DALL-E prompt

## Output Format
Return ONLY a valid JSON object with these exact fields:
{
  "title": "SEO-optimized title",
  "content": "<h2>Heading</h2><p>Paragraph content...</p><!-- IMAGE_1 --><p>More content...</p><!-- IMAGE_2 -->...",
  "wordCount": 1500,
  "images": [
    {
      "position": 1,
      "prompt": "Photorealistic 16:9 image of [detailed description including setting, lighting, colors, camera angle]",
      "alt": "Descriptive alt text for accessibility",
      "filename": "kebab-case-filename"
    }
  ]
}

IMPORTANT:
- Place <!-- IMAGE_N --> placeholders in the content at appropriate locations
- The content field must contain raw HTML, not markdown
- Do NOT wrap the JSON in code blocks
- Ensure the content is at least ${minWords} words - THIS IS MANDATORY`

    const userPrompt = `Create a comprehensive ${contentType === 'BLOG_POST' ? 'blog post' : 'service page'} based on this brief.

CRITICAL: 
- The final content MUST be ${targetWords} words. This is mandatory. Write extensively for each section.
- Include ${imageCount} image placeholders with detailed DALL-E prompts.

---
BRIEF:
${brief}`

    try {
        // Use gpt-4.1 for best instruction following and longer output
        const model = process.env.OPENAI_MODEL || 'gpt-4.1'

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 16000, // Maximum for longer content
            response_format: { type: 'json_object' }
        })

        const responseText = response.choices[0]?.message?.content || '{}'

        let parsed
        try {
            parsed = JSON.parse(responseText)
        } catch (e) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0])
            } else {
                throw new Error('Invalid JSON response from AI')
            }
        }

        const content = parsed.content || ''
        const images: ImageSpec[] = parsed.images || []

        // Log word count for debugging
        const actualWordCount = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
        console.log(`[LLM] Generated content: ${actualWordCount} words (target: ${targetWords}), ${images.length} images`)

        const fullPrompt = `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${userPrompt}`

        return {
            title: parsed.title || 'Untitled',
            content: content || '<p>Content generation failed.</p>',
            fullPrompt,
            images
        }
    } catch (error: any) {
        console.error('OpenAI API Error:', error)
        throw new Error(`Failed to generate content: ${error.message}`)
    }
}

// Generate images using DALL-E 3
export async function generateImages(
    images: ImageSpec[],
    contentId: number
): Promise<{ position: number; url: string; alt: string }[]> {
    const results: { position: number; url: string; alt: string }[] = []

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'content', String(contentId))
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
    }

    for (const image of images) {
        try {
            console.log(`[DALL-E] Generating image ${image.position}: ${image.filename}`)

            const response = await openai.images.generate({
                model: "dall-e-3",
                prompt: image.prompt,
                n: 1,
                size: "1792x1024", // 16:9 ratio
                quality: "standard"
            })

            const imageUrl = response.data[0]?.url
            if (imageUrl) {
                // Download and save the image
                const imageRes = await fetch(imageUrl)
                const arrayBuffer = await imageRes.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                const filename = `${image.filename}.png`
                const filepath = path.join(uploadDir, filename)
                fs.writeFileSync(filepath, buffer)

                const publicUrl = `/uploads/content/${contentId}/${filename}`

                results.push({
                    position: image.position,
                    url: publicUrl,
                    alt: image.alt
                })

                console.log(`[DALL-E] Saved image ${image.position}: ${publicUrl}`)
            }
        } catch (error: any) {
            console.error(`[DALL-E] Failed to generate image ${image.position}:`, error.message)
            // Continue with other images even if one fails
        }
    }

    return results
}

// Replace image placeholders with actual image tags
export function replaceImagePlaceholders(
    content: string,
    images: { position: number; url: string; alt: string }[]
): string {
    let result = content

    for (const image of images) {
        const placeholder = `<!-- IMAGE_${image.position} -->`
        const imageTag = `<figure class="content-image"><img src="${image.url}" alt="${image.alt}" loading="lazy" /><figcaption>${image.alt}</figcaption></figure>`
        result = result.replace(placeholder, imageTag)
    }

    return result
}

export async function refineContent(
    content: string,
    feedback: string,
    brandStatement?: string | null
): Promise<{ content: string }> {
    let systemPrompt = `You are an expert content editor. Refine and EXPAND the given content based on the user's feedback.
    
IMPORTANT: If the feedback mentions word count or length, you MUST add more content to meet the requirement. Do not shorten the content.`

    if (brandStatement) {
        systemPrompt += `\n\n## Brand Information\nEnsure the content aligns with:\n${brandStatement}`
    }

    systemPrompt += `\n\n## Output Format
Return a JSON object with:
- content: The refined content in HTML format
- wordCount: Estimated word count

Only return the JSON object, no markdown or code blocks.`

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4.1',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Original content:\n${content}\n\nFeedback:\n${feedback}` }
            ],
            temperature: 0.7,
            max_tokens: 16000,
            response_format: { type: 'json_object' }
        })

        const responseText = response.choices[0]?.message?.content || '{}'
        const parsed = JSON.parse(responseText)

        return {
            content: parsed.content || content
        }
    } catch (error: any) {
        console.error('OpenAI API Error:', error)
        throw new Error(`Failed to refine content: ${error.message}`)
    }
}
