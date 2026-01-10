/**
 * CrawlLab Engine
 * Main crawler that orchestrates page fetching and data extraction
 */

import { prisma } from '@/lib/prisma'
import {
    extractTitle,
    extractMetaDescription,
    extractH1,
    extractImages,
    extractLinks,
    countWords,
    parseSitemap,
    isSitemapIndex
} from './extractors'

const DEFAULT_DELAY_MS = 1000 // 1 second between requests
const DEFAULT_TIMEOUT_MS = 30000 // 30 second timeout
const MAX_PAGES = 500 // Safety limit

interface CrawlOptions {
    maxPages?: number
    delayMs?: number
    timeoutMs?: number
}

/**
 * Log a message for a crawl job
 */
async function log(jobId: number, level: 'info' | 'warn' | 'error', message: string, details?: any) {
    await prisma.crawlLog.create({
        data: {
            jobId,
            level,
            message,
            details: details ? JSON.stringify(details) : null
        }
    })
    console.log(`[CrawlLab][${level.toUpperCase()}] Job ${jobId}: ${message}`)
}

/**
 * Fetch a URL with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<{ html: string; status: number; loadTimeMs: number }> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const startTime = Date.now()

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'CrawlLab/1.0 (SEO Audit Bot)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        })

        const html = await response.text()
        const loadTimeMs = Date.now() - startTime

        return { html, status: response.status, loadTimeMs }
    } finally {
        clearTimeout(timeout)
    }
}

/**
 * Discover all URLs from sitemap(s)
 */
async function discoverFromSitemap(baseUrl: string, jobId: number): Promise<string[]> {
    const allUrls: string[] = []
    const sitemapQueue: string[] = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/wp-sitemap.xml`
    ]

    const visited = new Set<string>()

    while (sitemapQueue.length > 0) {
        const sitemapUrl = sitemapQueue.shift()!
        if (visited.has(sitemapUrl)) continue
        visited.add(sitemapUrl)

        try {
            await log(jobId, 'info', `Fetching sitemap: ${sitemapUrl}`)
            const { html: xml, status } = await fetchWithTimeout(sitemapUrl, 10000)

            if (status !== 200) {
                await log(jobId, 'warn', `Sitemap returned ${status}: ${sitemapUrl}`)
                continue
            }

            if (isSitemapIndex(xml)) {
                // This is a sitemap index, parse child sitemaps
                const childSitemaps = parseSitemap(xml)
                await log(jobId, 'info', `Found sitemap index with ${childSitemaps.length} sitemaps`)
                sitemapQueue.push(...childSitemaps)
            } else {
                // Regular sitemap, extract URLs
                const urls = parseSitemap(xml)
                await log(jobId, 'info', `Found ${urls.length} URLs in sitemap`)
                allUrls.push(...urls)
            }
        } catch (error: any) {
            await log(jobId, 'warn', `Failed to fetch sitemap: ${sitemapUrl}`, { error: error.message })
        }
    }

    return [...new Set(allUrls)] // Deduplicate
}

/**
 * Crawl a single page and save results
 */
async function crawlPage(
    jobId: number,
    url: string,
    baseUrl: string,
    timeoutMs: number
): Promise<string[]> {
    const newInternalUrls: string[] = []

    try {
        const { html, status, loadTimeMs } = await fetchWithTimeout(url, timeoutMs)

        const title = extractTitle(html)
        const metaDescription = extractMetaDescription(html)
        const h1s = extractH1(html)
        const images = extractImages(html, url)
        const links = extractLinks(html, url)
        const wordCount = countWords(html)

        // Save page to database
        const page = await prisma.crawledPage.create({
            data: {
                jobId,
                url,
                statusCode: status,
                title,
                metaDescription,
                h1: h1s[0] || null,
                wordCount,
                loadTimeMs
            }
        })

        // Save images (individual creates for SQLite compatibility)
        if (images.length > 0) {
            for (const img of images) {
                await prisma.crawledImage.create({
                    data: {
                        pageId: page.id,
                        url: img.url,
                        alt: img.alt
                    }
                })
            }
        }

        // Save links (individual creates for SQLite compatibility)
        if (links.length > 0) {
            for (const link of links) {
                await prisma.crawledLink.create({
                    data: {
                        pageId: page.id,
                        targetUrl: link.url,
                        anchorText: link.anchorText || null,
                        isInternal: link.isInternal
                    }
                })
            }

            // Collect internal URLs for discovery
            newInternalUrls.push(...links.filter(l => l.isInternal).map(l => l.url))
        }

        await log(jobId, 'info', `Crawled ${url}`, {
            status,
            loadTimeMs,
            images: images.length,
            links: links.length
        })

    } catch (error: any) {
        await log(jobId, 'error', `Failed to crawl ${url}`, { error: error.message })

        // Save failed page with error status
        await prisma.crawledPage.create({
            data: {
                jobId,
                url,
                statusCode: 0,
                title: null
            }
        })
    }

    return newInternalUrls
}

/**
 * Main crawl function - starts a crawl job
 */
export async function startCrawl(targetUrl: string, options: CrawlOptions = {}): Promise<number> {
    const {
        maxPages = MAX_PAGES,
        delayMs = DEFAULT_DELAY_MS,
        timeoutMs = DEFAULT_TIMEOUT_MS
    } = options

    // Normalize base URL
    let baseUrl = targetUrl.replace(/\/$/, '')
    if (!baseUrl.startsWith('http')) {
        baseUrl = 'https://' + baseUrl
    }

    // Create crawl job
    const job = await prisma.crawlJob.create({
        data: {
            url: baseUrl,
            status: 'running',
            startedAt: new Date()
        }
    })

    await log(job.id, 'info', `Starting crawl for ${baseUrl}`, { maxPages, delayMs })

    try {
        // Discover URLs from sitemap
        const sitemapUrls = await discoverFromSitemap(baseUrl, job.id)

        // If no sitemap, start with homepage
        const urlQueue = sitemapUrls.length > 0 ? sitemapUrls : [baseUrl]
        const crawledUrls = new Set<string>()

        await prisma.crawlJob.update({
            where: { id: job.id },
            data: { totalPages: Math.min(urlQueue.length, maxPages) }
        })

        await log(job.id, 'info', `Found ${urlQueue.length} URLs to crawl`)

        // Crawl pages
        let pagesCrawled = 0

        while (urlQueue.length > 0 && pagesCrawled < maxPages) {
            // Check if job was cancelled
            const currentJob = await prisma.crawlJob.findUnique({
                where: { id: job.id },
                select: { status: true }
            })
            if (currentJob?.status === 'cancelled') {
                await log(job.id, 'warn', 'Crawl cancelled by user')
                return job.id
            }

            const url = urlQueue.shift()!

            // Skip if already crawled
            if (crawledUrls.has(url)) continue
            crawledUrls.add(url)

            // Only crawl same-domain URLs
            try {
                const urlHost = new URL(url).hostname
                const baseHost = new URL(baseUrl).hostname
                if (urlHost !== baseHost && !urlHost.endsWith('.' + baseHost)) {
                    continue
                }
            } catch {
                continue
            }

            // Crawl the page
            const newUrls = await crawlPage(job.id, url, baseUrl, timeoutMs)
            pagesCrawled++

            // Update job progress
            await prisma.crawlJob.update({
                where: { id: job.id },
                data: { crawledPages: pagesCrawled }
            })

            // Add new discovered URLs to queue
            for (const newUrl of newUrls) {
                if (!crawledUrls.has(newUrl) && !urlQueue.includes(newUrl)) {
                    urlQueue.push(newUrl)
                }
            }

            // Rate limiting delay
            if (urlQueue.length > 0 && pagesCrawled < maxPages) {
                await new Promise(resolve => setTimeout(resolve, delayMs))
            }
        }

        // Mark job as completed
        await prisma.crawlJob.update({
            where: { id: job.id },
            data: {
                status: 'completed',
                completedAt: new Date(),
                crawledPages: pagesCrawled
            }
        })

        await log(job.id, 'info', `Crawl completed! ${pagesCrawled} pages crawled`)

    } catch (error: any) {
        await log(job.id, 'error', `Crawl failed: ${error.message}`)

        await prisma.crawlJob.update({
            where: { id: job.id },
            data: {
                status: 'failed',
                error: error.message,
                completedAt: new Date()
            }
        })
    }

    return job.id
}

/**
 * Get crawl job status and summary
 */
export async function getCrawlStatus(jobId: number) {
    const job = await prisma.crawlJob.findUnique({
        where: { id: jobId },
        include: {
            _count: {
                select: {
                    pages: true,
                    logs: true
                }
            }
        }
    })

    if (!job) return null

    // Get image and link counts
    const stats = await prisma.crawledPage.aggregate({
        where: { jobId },
        _count: { id: true }
    })

    const imageCount = await prisma.crawledImage.count({
        where: { page: { jobId } }
    })

    const linkCount = await prisma.crawledLink.count({
        where: { page: { jobId } }
    })

    return {
        ...job,
        imageCount,
        linkCount,
        pageCount: stats._count.id
    }
}
