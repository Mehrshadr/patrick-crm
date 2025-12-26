import { prisma } from "@/lib/prisma"

// Types
export interface PageInfo {
    url: string
    title: string
    type: string  // blog, service, product, page, etc.
    content?: string
}

// Detect page type from URL patterns
export function detectPageType(url: string): string {
    const path = new URL(url).pathname.toLowerCase()

    if (path === '/' || path === '') return 'home'
    if (path.includes('/blog') || path.includes('/post') || path.includes('/article')) return 'blog'
    if (path.includes('/service') || path.includes('/خدمات')) return 'service'
    if (path.includes('/product') || path.includes('/محصول')) return 'product'
    if (path.includes('/category') || path.includes('/دسته')) return 'category'
    if (path.includes('/about') || path.includes('/درباره')) return 'about'
    if (path.includes('/contact') || path.includes('/تماس')) return 'contact'

    return 'page'
}

// Apply links to HTML content
export function applyLinksToContent(
    html: string,
    keywords: { id: number; keyword: string; targetUrl: string; onlyFirst: boolean; onlyFirstP: boolean }[],
    existingAnchors: Set<string> = new Set()
): { html: string; insertions: { keywordId: number; anchorId: string; position: number }[] } {
    let result = html
    const insertions: { keywordId: number; anchorId: string; position: number }[] = []

    // Sort keywords by length (longer first to avoid substring issues)
    const sortedKeywords = [...keywords].sort((a, b) => b.keyword.length - a.keyword.length)

    // Track which positions have been linked to avoid overlaps
    const linkedRanges: { start: number; end: number }[] = []

    for (const kw of sortedKeywords) {
        // Find all occurrences in body content (not in tags, not in headings)
        const regex = createKeywordRegex(kw.keyword)
        let match
        let count = 0
        let tempResult = result

        while ((match = regex.exec(tempResult)) !== null) {
            const position = match.index

            // Check if this position overlaps with already linked content
            const overlaps = linkedRanges.some(
                range => position >= range.start && position < range.end
            )
            if (overlaps) continue

            // Check if inside a tag or heading
            if (isInsideTagOrHeading(tempResult, position)) continue

            // Check if inside first paragraph only (if rule is set)
            if (kw.onlyFirstP && !isInFirstParagraph(tempResult, position)) continue

            // Generate anchor ID
            count++
            const anchorId = `lb-${kw.id}-${count}`

            // Skip if anchor already exists
            if (existingAnchors.has(anchorId)) continue

            // Create the linked version
            const linkedText = `<a href="${kw.targetUrl}" id="${anchorId}" class="lb-auto-link">${match[0]}</a>`

            // Replace at this position
            result = result.slice(0, position) + linkedText + result.slice(position + match[0].length)

            // Track the insertion
            insertions.push({ keywordId: kw.id, anchorId, position })

            // Mark this range as linked
            linkedRanges.push({
                start: position,
                end: position + linkedText.length
            })

            // If only first occurrence, break
            if (kw.onlyFirst) break

            // Update temp result and regex for next iteration
            tempResult = result
        }
    }

    return { html: result, insertions }
}

// Create regex for keyword (word boundary aware for Persian/Arabic)
function createKeywordRegex(keyword: string): RegExp {
    // Escape special regex characters
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // For Persian text, we can't use \b, so we use lookahead/behind for non-word chars
    return new RegExp(escaped, 'g')
}

// Check if position is inside an HTML tag or heading
function isInsideTagOrHeading(html: string, position: number): boolean {
    // Check if inside a tag
    const beforePosition = html.slice(0, position)
    const lastOpenTag = beforePosition.lastIndexOf('<')
    const lastCloseTag = beforePosition.lastIndexOf('>')

    if (lastOpenTag > lastCloseTag) {
        return true  // Inside a tag
    }

    // Check if inside heading tags
    const headingPattern = /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi
    let match
    while ((match = headingPattern.exec(html)) !== null) {
        if (position >= match.index && position < match.index + match[0].length) {
            return true
        }
    }

    // Check if inside title tag
    const titlePattern = /<title[^>]*>[\s\S]*?<\/title>/gi
    while ((match = titlePattern.exec(html)) !== null) {
        if (position >= match.index && position < match.index + match[0].length) {
            return true
        }
    }

    // Check if inside existing anchor tag
    const anchorPattern = /<a[^>]*>[\s\S]*?<\/a>/gi
    while ((match = anchorPattern.exec(html)) !== null) {
        if (position >= match.index && position < match.index + match[0].length) {
            return true
        }
    }

    return false
}

// Check if position is in the first paragraph
function isInFirstParagraph(html: string, position: number): boolean {
    const firstPMatch = html.match(/<p[^>]*>[\s\S]*?<\/p>/i)
    if (!firstPMatch) return false

    const firstPStart = html.indexOf(firstPMatch[0])
    const firstPEnd = firstPStart + firstPMatch[0].length

    return position >= firstPStart && position < firstPEnd
}

// WordPress API functions
export async function fetchWordPressPages(
    siteUrl: string,
    username: string,
    appPassword: string,
    pageTypes: string[] = ['posts', 'pages']
): Promise<PageInfo[]> {
    const results: PageInfo[] = []
    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64')

    for (const type of pageTypes) {
        const endpoint = type === 'posts' ? 'posts' : 'pages'
        try {
            const res = await fetch(`${siteUrl}/wp-json/wp/v2/${endpoint}?per_page=100`, {
                headers: { 'Authorization': `Basic ${auth}` }
            })

            if (res.ok) {
                const items = await res.json()
                for (const item of items) {
                    results.push({
                        url: item.link,
                        title: item.title?.rendered || '',
                        type: endpoint === 'posts' ? 'blog' : 'page',
                        content: item.content?.rendered || ''
                    })
                }
            }
        } catch (e) {
            console.error(`Failed to fetch ${type}:`, e)
        }
    }

    return results
}

export async function updateWordPressPage(
    siteUrl: string,
    username: string,
    appPassword: string,
    pageId: number,
    content: string,
    isPost: boolean = false
): Promise<boolean> {
    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64')
    const endpoint = isPost ? 'posts' : 'pages'

    try {
        const res = await fetch(`${siteUrl}/wp-json/wp/v2/${endpoint}/${pageId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        })

        return res.ok
    } catch (e) {
        console.error('Failed to update page:', e)
        return false
    }
}

// Crawl sitemap to discover pages
export async function crawlSitemap(siteUrl: string): Promise<PageInfo[]> {
    const results: PageInfo[] = []

    try {
        // Try to fetch sitemap
        const sitemapUrls = [
            `${siteUrl}/sitemap.xml`,
            `${siteUrl}/sitemap_index.xml`,
            `${siteUrl}/wp-sitemap.xml`
        ]

        for (const sitemapUrl of sitemapUrls) {
            try {
                const res = await fetch(sitemapUrl)
                if (res.ok) {
                    const xml = await res.text()
                    // Parse URLs from sitemap
                    const urlMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g)
                    for (const match of urlMatches) {
                        const url = match[1]
                        // Skip excluded patterns
                        if (url.includes('/wp-content/') || url.includes('/wp-admin/')) continue

                        results.push({
                            url,
                            title: '',
                            type: detectPageType(url)
                        })
                    }
                    if (results.length > 0) break
                }
            } catch { }
        }
    } catch (e) {
        console.error('Failed to crawl sitemap:', e)
    }

    return results
}
