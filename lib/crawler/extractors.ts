/**
 * CrawlLab Extractors
 * HTML parsing utilities for extracting SEO data from web pages
 */

// Simple HTML tag regex patterns
const TITLE_REGEX = /<title[^>]*>([^<]*)<\/title>/i
const META_DESC_REGEX = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
const META_DESC_ALT_REGEX = /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i
const H1_REGEX = /<h1[^>]*>([^<]*)<\/h1>/gi
const H2_REGEX = /<h2[^>]*>([^<]*)<\/h2>/gi
const IMG_REGEX = /<img[^>]*>/gi
const LINK_REGEX = /<a[^>]*href=["']([^"'#]+)["'][^>]*>([^<]*)<\/a>/gi

/**
 * Extract page title from HTML
 */
export function extractTitle(html: string): string | null {
    const match = html.match(TITLE_REGEX)
    return match ? match[1].trim() : null
}

/**
 * Extract meta description from HTML
 */
export function extractMetaDescription(html: string): string | null {
    let match = html.match(META_DESC_REGEX)
    if (!match) {
        match = html.match(META_DESC_ALT_REGEX)
    }
    return match ? match[1].trim() : null
}

/**
 * Extract all H1 tags from HTML
 */
export function extractH1(html: string): string[] {
    const h1s: string[] = []
    let match
    const regex = new RegExp(H1_REGEX.source, 'gi')
    while ((match = regex.exec(html)) !== null) {
        const text = stripHtmlTags(match[1]).trim()
        if (text) h1s.push(text)
    }
    return h1s
}

/**
 * Extract all H2 tags from HTML
 */
export function extractH2(html: string): string[] {
    const h2s: string[] = []
    let match
    const regex = new RegExp(H2_REGEX.source, 'gi')
    while ((match = regex.exec(html)) !== null) {
        const text = stripHtmlTags(match[1]).trim()
        if (text) h2s.push(text)
    }
    return h2s
}

/**
 * Extract images from HTML
 */
export function extractImages(html: string, baseUrl: string): Array<{ url: string; alt: string | null }> {
    const images: Array<{ url: string; alt: string | null }> = []
    let match
    const regex = new RegExp(IMG_REGEX.source, 'gi')

    while ((match = regex.exec(html)) !== null) {
        const imgTag = match[0]

        // Extract src
        const srcMatch = imgTag.match(/src=["']([^"']+)["']/i)
        if (!srcMatch) continue

        let src = srcMatch[1]

        // Skip data URLs and empty sources
        if (src.startsWith('data:') || !src.trim()) continue

        // Resolve relative URLs
        src = resolveUrl(src, baseUrl)

        // Extract alt
        const altMatch = imgTag.match(/alt=["']([^"']*)["']/i)
        const alt = altMatch ? altMatch[1] : null

        images.push({ url: src, alt })
    }

    return images
}

/**
 * Extract links from HTML
 */
export function extractLinks(
    html: string,
    baseUrl: string
): Array<{ url: string; anchorText: string; isInternal: boolean }> {
    const links: Array<{ url: string; anchorText: string; isInternal: boolean }> = []
    let match
    const regex = new RegExp(LINK_REGEX.source, 'gi')
    const baseDomain = new URL(baseUrl).hostname

    while ((match = regex.exec(html)) !== null) {
        let href = match[1]
        const anchorText = stripHtmlTags(match[2]).trim()

        // Skip javascript:, mailto:, tel: links
        if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            continue
        }

        // Resolve relative URLs
        href = resolveUrl(href, baseUrl)

        // Determine if internal
        let isInternal = false
        try {
            const linkDomain = new URL(href).hostname
            isInternal = linkDomain === baseDomain || linkDomain.endsWith('.' + baseDomain)
        } catch {
            isInternal = true // Likely a relative URL that failed to parse
        }

        links.push({ url: href, anchorText, isInternal })
    }

    return links
}

/**
 * Count words in HTML content (text only)
 */
export function countWords(html: string): number {
    // Remove script and style tags
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

    // Remove all HTML tags
    text = stripHtmlTags(text)

    // Count words
    const words = text.split(/\s+/).filter(word => word.length > 0)
    return words.length
}

/**
 * Strip HTML tags from string
 */
function stripHtmlTags(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ')
}

/**
 * Resolve a relative URL to absolute
 */
function resolveUrl(href: string, baseUrl: string): string {
    try {
        return new URL(href, baseUrl).href
    } catch {
        return href
    }
}

/**
 * Extract sitemap URLs from XML
 */
export function parseSitemap(xml: string): string[] {
    const urls: string[] = []

    // Standard sitemap <loc> tags
    const locRegex = /<loc>([^<]+)<\/loc>/gi
    let match
    while ((match = locRegex.exec(xml)) !== null) {
        urls.push(match[1].trim())
    }

    return urls
}

/**
 * Check if URL is a sitemap index (contains other sitemaps)
 */
export function isSitemapIndex(xml: string): boolean {
    return xml.includes('<sitemapindex') || xml.includes('<sitemap>')
}
