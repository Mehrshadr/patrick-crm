/**
 * Robots.txt Parser - Reusable across CrawlLab and Projects
 * 
 * This module provides utilities for fetching and parsing robots.txt files,
 * extracting Disallow/Allow rules, sitemaps, and checking URL permissions.
 */

export interface RobotsTxtRule {
    type: 'disallow' | 'allow'
    path: string
}

export interface RobotsTxtData {
    userAgents: {
        [agent: string]: RobotsTxtRule[]
    }
    sitemaps: string[]
    crawlDelay?: number
    rawContent: string
    fetchedAt: Date
    error?: string
}

/**
 * Fetch and parse robots.txt from a URL
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<RobotsTxtData> {
    try {
        // Normalize URL
        let url = baseUrl.replace(/\/$/, '')
        if (!url.startsWith('http')) {
            url = 'https://' + url
        }

        const robotsUrl = `${url}/robots.txt`

        const response = await fetch(robotsUrl, {
            headers: {
                'User-Agent': 'MehranaBot/1.0'
            },
            signal: AbortSignal.timeout(10000)
        })

        if (!response.ok) {
            return {
                userAgents: {},
                sitemaps: [],
                rawContent: '',
                fetchedAt: new Date(),
                error: response.status === 404
                    ? 'No robots.txt found'
                    : `HTTP ${response.status}`
            }
        }

        const content = await response.text()
        return parseRobotsTxt(content)

    } catch (error: any) {
        return {
            userAgents: {},
            sitemaps: [],
            rawContent: '',
            fetchedAt: new Date(),
            error: error.message || 'Failed to fetch'
        }
    }
}

/**
 * Parse robots.txt content
 */
export function parseRobotsTxt(content: string): RobotsTxtData {
    const lines = content.split('\n')
    const userAgents: { [agent: string]: RobotsTxtRule[] } = {}
    const sitemaps: string[] = []
    let currentAgent = '*'
    let crawlDelay: number | undefined

    for (const rawLine of lines) {
        const line = rawLine.trim()

        // Skip comments and empty lines
        if (line.startsWith('#') || !line) continue

        const colonIndex = line.indexOf(':')
        if (colonIndex === -1) continue

        const directive = line.substring(0, colonIndex).toLowerCase().trim()
        const value = line.substring(colonIndex + 1).trim()

        switch (directive) {
            case 'user-agent':
                currentAgent = value.toLowerCase()
                if (!userAgents[currentAgent]) {
                    userAgents[currentAgent] = []
                }
                break

            case 'disallow':
                if (value) {
                    if (!userAgents[currentAgent]) {
                        userAgents[currentAgent] = []
                    }
                    userAgents[currentAgent].push({ type: 'disallow', path: value })
                }
                break

            case 'allow':
                if (value) {
                    if (!userAgents[currentAgent]) {
                        userAgents[currentAgent] = []
                    }
                    userAgents[currentAgent].push({ type: 'allow', path: value })
                }
                break

            case 'sitemap':
                if (value) {
                    sitemaps.push(value)
                }
                break

            case 'crawl-delay':
                const delay = parseFloat(value)
                if (!isNaN(delay)) {
                    crawlDelay = delay
                }
                break
        }
    }

    return {
        userAgents,
        sitemaps,
        crawlDelay,
        rawContent: content,
        fetchedAt: new Date()
    }
}

/**
 * Check if a URL path is allowed by robots.txt rules
 */
export function isPathAllowed(
    data: RobotsTxtData,
    path: string,
    userAgent: string = '*'
): boolean {
    // Normalize path
    if (!path.startsWith('/')) {
        path = '/' + path
    }

    // Get rules for user-agent, fallback to * if not found
    const rules = data.userAgents[userAgent.toLowerCase()] || data.userAgents['*'] || []

    if (rules.length === 0) {
        return true // No rules = everything allowed
    }

    // Find the most specific matching rule
    let matchedRule: RobotsTxtRule | null = null
    let matchedLength = 0

    for (const rule of rules) {
        // Check if path matches the rule pattern
        if (pathMatchesPattern(path, rule.path)) {
            // Use the most specific (longest) matching rule
            if (rule.path.length > matchedLength) {
                matchedRule = rule
                matchedLength = rule.path.length
            }
        }
    }

    // If no rule matched, path is allowed
    if (!matchedRule) {
        return true
    }

    return matchedRule.type === 'allow'
}

/**
 * Check if a path matches a robots.txt pattern
 */
function pathMatchesPattern(path: string, pattern: string): boolean {
    // Handle wildcards and $
    let regex = pattern
        .replace(/\*/g, '.*')  // * matches anything
        .replace(/\$/g, '$')   // $ matches end of URL
        .replace(/\?/g, '\\?') // Escape ?

    // If pattern doesn't end with *, it should match from the start
    if (!pattern.endsWith('*') && !pattern.endsWith('$')) {
        return path.startsWith(pattern)
    }

    try {
        return new RegExp(`^${regex}`).test(path)
    } catch {
        return path.startsWith(pattern)
    }
}

/**
 * Get all disallowed paths for a user-agent
 */
export function getDisallowedPaths(
    data: RobotsTxtData,
    userAgent: string = '*'
): string[] {
    const rules = data.userAgents[userAgent.toLowerCase()] || data.userAgents['*'] || []
    return rules
        .filter(r => r.type === 'disallow')
        .map(r => r.path)
}

/**
 * Check if a full URL is allowed
 */
export function isUrlAllowed(
    data: RobotsTxtData,
    url: string,
    userAgent: string = '*'
): boolean {
    try {
        const parsedUrl = new URL(url)
        return isPathAllowed(data, parsedUrl.pathname, userAgent)
    } catch {
        return true
    }
}
