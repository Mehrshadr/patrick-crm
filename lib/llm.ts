import OpenAI from 'openai'

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

// Extract word count from brief if specified
function extractWordCount(brief: string): { min: number; max: number } | null {
    // Match patterns like "1500-2000", "1500 to 2000", "1500–2000"
    const rangeMatch = brief.match(/(\d{3,4})\s*[-–to]+\s*(\d{3,4})\s*(words?)?/i)
    if (rangeMatch) {
        return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) }
    }

    // Match patterns like "1500 words", "minimum 1500"
    const singleMatch = brief.match(/(minimum\s+)?(\d{3,4})\s*words?/i)
    if (singleMatch) {
        const count = parseInt(singleMatch[2])
        return { min: count, max: count + 500 }
    }

    return null
}

export async function generateContent(options: GenerateContentOptions): Promise<{ title: string; content: string; fullPrompt: string }> {
    const {
        brief,
        contentType,
        brandStatement,
        guidelines,
        aiRules,
        useGuidelines,
        useAiRules
    } = options

    // Extract word count requirement from brief
    const wordCount = extractWordCount(brief)
    const targetWords = wordCount ? `${wordCount.min}-${wordCount.max}` : '1000-1500'
    const minWords = wordCount?.min || 1000

    // Build the system prompt with explicit word count requirements
    let systemPrompt = `You are an expert SEO content writer who creates comprehensive, in-depth articles.

## CRITICAL REQUIREMENTS
1. **WORD COUNT**: Your content MUST be between ${targetWords} words. This is NON-NEGOTIABLE.
2. **THOROUGHNESS**: Cover every heading/topic mentioned in the brief with substantial, detailed paragraphs.
3. **NO SHORTCUTS**: Do not summarize or abbreviate. Each section needs proper depth.
4. **STRUCTURE**: Use proper HTML semantic tags (h2, h3, p, ul, li, strong, em).

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

## Output Format
Return ONLY a valid JSON object with these fields:
{
  "title": "SEO-optimized title",
  "content": "<h2>...</h2><p>...</p>...",
  "wordCount": [estimated word count of content]
}

IMPORTANT: 
- The content field must contain raw HTML, not markdown
- Do NOT wrap the JSON in code blocks
- Ensure the content is at least ${minWords} words`

    // Build the user prompt with emphasis on length
    const userPrompt = `Create a comprehensive ${contentType === 'BLOG_POST' ? 'blog post' : 'service page'} based on this brief.

REMEMBER: The final content MUST be ${targetWords} words minimum. Cover each heading thoroughly with multiple paragraphs per section.

---
BRIEF:
${brief}`

    try {
        // Use GPT-4-turbo for best quality content
        const model = process.env.OPENAI_MODEL || 'gpt-4-turbo'

        // Calculate tokens needed: ~1.3 tokens per word + overhead, but cap at model limit
        const estimatedTokens = Math.min(4096, Math.max(3000, (wordCount?.max || 2000) * 2))

        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: Math.min(estimatedTokens, 16000), // Cap at model limit
            response_format: { type: 'json_object' }
        })

        const responseText = response.choices[0]?.message?.content || '{}'

        let parsed
        try {
            parsed = JSON.parse(responseText)
        } catch (e) {
            // Try to extract JSON from response if it has extra text
            const jsonMatch = responseText.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0])
            } else {
                throw new Error('Invalid JSON response from AI')
            }
        }

        const content = parsed.content || ''

        // Log word count for debugging
        const actualWordCount = content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
        console.log(`[LLM] Generated content: ${actualWordCount} words (target: ${targetWords})`)

        // Build full prompt for debugging/transparency
        const fullPrompt = `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${userPrompt}`

        return {
            title: parsed.title || 'Untitled',
            content: content || '<p>Content generation failed.</p>',
            fullPrompt
        }
    } catch (error: any) {
        console.error('OpenAI API Error:', error)
        throw new Error(`Failed to generate content: ${error.message}`)
    }
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
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo-16k',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Original content:\n${content}\n\nFeedback:\n${feedback}` }
            ],
            temperature: 0.7,
            max_tokens: 8000,
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
