/**
 * PageSpeed Insights API Integration
 * Fetches Core Web Vitals and performance metrics from Google
 */

import { prisma } from '@/lib/prisma'
import { decrypt, isEncryptionConfigured } from '@/lib/encryption'

const PAGESPEED_API = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

/**
 * Get PageSpeed API key from database settings
 */
async function getPageSpeedApiKey(): Promise<string | null> {
    try {
        const setting = await prisma.appSettings.findUnique({
            where: { key: 'pagespeed_api_key' }
        })

        if (!setting?.value) return null

        if (setting.isEncrypted && isEncryptionConfigured()) {
            return decrypt(setting.value)
        }

        return setting.value
    } catch (error) {
        console.error('[PageSpeed] Error getting API key:', error)
        return null
    }
}

export interface PageSpeedMetrics {
    // Scores (0-100)
    performanceScore: number
    accessibilityScore: number
    seoScore: number
    bestPracticesScore: number

    // Core Web Vitals
    lcp: number     // Largest Contentful Paint (ms)
    fid: number     // First Input Delay (ms) - or TBT as proxy
    cls: number     // Cumulative Layout Shift
    fcp: number     // First Contentful Paint (ms)
    tbt: number     // Total Blocking Time (ms)
    tti: number     // Time to Interactive (ms)

    // Additional
    speedIndex: number
    serverResponseTime: number
}

export interface PageSpeedResult {
    success: boolean
    url: string
    strategy: 'mobile' | 'desktop'
    metrics?: PageSpeedMetrics
    error?: string
    fetchedAt: Date
}

/**
 * Fetch PageSpeed metrics for a URL
 */
export async function fetchPageSpeed(
    url: string,
    strategy: 'mobile' | 'desktop' = 'mobile',
    apiKey?: string
): Promise<PageSpeedResult> {
    // Get API key from: 1) passed param, 2) database settings, 3) env variable
    const key = apiKey || await getPageSpeedApiKey() || process.env.PAGESPEED_API_KEY

    if (!key) {
        return {
            success: false,
            url,
            strategy,
            error: 'PageSpeed API key not configured. Add it in Settings > Integrations.',
            fetchedAt: new Date()
        }
    }

    try {
        // PageSpeed API needs all categories as separate params
        const apiUrl = `${PAGESPEED_API}?url=${encodeURIComponent(url)}&key=${key}&strategy=${strategy}&category=performance&category=accessibility&category=seo&category=best-practices`

        console.log(`[PageSpeed] Fetching metrics for ${url} (${strategy})`)

        const response = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/json'
            }
        })

        if (!response.ok) {
            const errorData = await response.json()
            return {
                success: false,
                url,
                strategy,
                error: errorData.error?.message || `API error: ${response.status}`,
                fetchedAt: new Date()
            }
        }

        const data = await response.json()

        // Extract scores
        const categories = data.lighthouseResult?.categories || {}
        const audits = data.lighthouseResult?.audits || {}

        const metrics: PageSpeedMetrics = {
            // Scores (convert from 0-1 to 0-100)
            performanceScore: Math.round((categories.performance?.score || 0) * 100),
            accessibilityScore: Math.round((categories.accessibility?.score || 0) * 100),
            seoScore: Math.round((categories.seo?.score || 0) * 100),
            bestPracticesScore: Math.round((categories['best-practices']?.score || 0) * 100),

            // Core Web Vitals (from audits)
            lcp: audits['largest-contentful-paint']?.numericValue || 0,
            fid: audits['max-potential-fid']?.numericValue || 0,
            cls: audits['cumulative-layout-shift']?.numericValue || 0,
            fcp: audits['first-contentful-paint']?.numericValue || 0,
            tbt: audits['total-blocking-time']?.numericValue || 0,
            tti: audits['interactive']?.numericValue || 0,

            // Additional
            speedIndex: audits['speed-index']?.numericValue || 0,
            serverResponseTime: audits['server-response-time']?.numericValue || 0
        }

        return {
            success: true,
            url,
            strategy,
            metrics,
            fetchedAt: new Date()
        }

    } catch (error: any) {
        return {
            success: false,
            url,
            strategy,
            error: error.message,
            fetchedAt: new Date()
        }
    }
}
