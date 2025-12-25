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

export async function generateContent(options: GenerateContentOptions): Promise<{ title: string; content: string }> {
    const {
        brief,
        contentType,
        brandStatement,
        guidelines,
        aiRules,
        useGuidelines,
        useAiRules
    } = options

    // Build the system prompt
    let systemPrompt = `You are an expert content writer. Your task is to create high-quality ${contentType === 'BLOG_POST' ? 'blog posts' : 'service pages'}.`

    if (brandStatement) {
        systemPrompt += `\n\n## Brand Information\n${brandStatement}`
    }

    if (useGuidelines && guidelines) {
        systemPrompt += `\n\n## Content Guidelines\nFollow these guidelines:\n${guidelines}`
    }

    if (useAiRules && aiRules) {
        systemPrompt += `\n\n## AI Rules\nAdhere to these specific rules:\n${aiRules}`
    }

    systemPrompt += `\n\n## Output Format
Return your response as a JSON object with these fields:
- title: A compelling, SEO-friendly title
- content: The full content in HTML format with proper semantic tags (h2, h3, p, ul, li, etc.)

Do not include any markdown or code blocks in your response. Only return the JSON object.`

    // Build the user prompt
    const userPrompt = `Create a ${contentType === 'BLOG_POST' ? 'blog post' : 'service page'} based on this brief:\n\n${brief}`

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 4000,
            response_format: { type: 'json_object' }
        })

        const responseText = response.choices[0]?.message?.content || '{}'
        const parsed = JSON.parse(responseText)

        return {
            title: parsed.title || 'Untitled',
            content: parsed.content || '<p>Content generation failed.</p>'
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
    let systemPrompt = `You are an expert content editor. Refine the given content based on the user's feedback.`

    if (brandStatement) {
        systemPrompt += `\n\n## Brand Information\nEnsure the content aligns with:\n${brandStatement}`
    }

    systemPrompt += `\n\n## Output Format
Return your response as a JSON object with:
- content: The refined content in HTML format

Only return the JSON object, no markdown or code blocks.`

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Original content:\n${content}\n\nFeedback:\n${feedback}` }
            ],
            temperature: 0.7,
            max_tokens: 4000,
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
