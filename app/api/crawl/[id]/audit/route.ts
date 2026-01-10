import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Get comprehensive audit data for a crawl job
 * Used for generating SEO audit reports
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const jobId = parseInt(id)

        if (isNaN(jobId)) {
            return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 })
        }

        // Get job info
        const job = await prisma.crawlJob.findUnique({
            where: { id: jobId }
        })

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        // Get all pages
        const pages = await prisma.crawledPage.findMany({
            where: { jobId },
            include: {
                images: true,
                links: true
            }
        })

        // Get PageSpeed results
        const pageSpeed = await prisma.pageSpeedResult.findFirst({
            where: { jobId },
            orderBy: { fetchedAt: 'desc' }
        })

        // Calculate issues
        const issues = {
            missingTitle: pages.filter(p => !p.title || p.title.trim() === '').length,
            missingMetaDescription: pages.filter(p => !p.metaDescription || p.metaDescription.trim() === '').length,
            missingH1: pages.filter(p => !p.h1 || p.h1.trim() === '').length,
            missingAltImages: pages.flatMap(p => p.images).filter(img => !img.alt || img.alt.trim() === '').length,
            slowPages: pages.filter(p => p.loadTimeMs && p.loadTimeMs > 3000).length,
            brokenPages: pages.filter(p => p.statusCode >= 400).length,
            thinContent: pages.filter(p => p.wordCount && p.wordCount < 300).length
        }

        // Calculate totals
        const totals = {
            pages: pages.length,
            images: pages.flatMap(p => p.images).length,
            links: pages.flatMap(p => p.links).length,
            internalLinks: pages.flatMap(p => p.links).filter(l => l.isInternal).length,
            externalLinks: pages.flatMap(p => p.links).filter(l => !l.isInternal).length
        }

        // Calculate SEO score (0-100)
        const issueWeights = {
            missingTitle: 15,
            missingMetaDescription: 10,
            missingH1: 10,
            missingAltImages: 8,
            slowPages: 7,
            brokenPages: 20,
            thinContent: 5
        }

        let deductions = 0
        const maxDeduction = 75 // Leave room for base score

        if (totals.pages > 0) {
            deductions += (issues.missingTitle / totals.pages) * issueWeights.missingTitle
            deductions += (issues.missingMetaDescription / totals.pages) * issueWeights.missingMetaDescription
            deductions += (issues.missingH1 / totals.pages) * issueWeights.missingH1
            deductions += (issues.brokenPages / totals.pages) * issueWeights.brokenPages
            deductions += (issues.slowPages / totals.pages) * issueWeights.slowPages
            deductions += (issues.thinContent / totals.pages) * issueWeights.thinContent
        }

        if (totals.images > 0) {
            deductions += (issues.missingAltImages / totals.images) * issueWeights.missingAltImages
        }

        const baseScore = 100
        const seoScore = Math.max(0, Math.round(baseScore - Math.min(deductions, maxDeduction)))

        // Build audit report
        const audit = {
            job: {
                id: job.id,
                url: job.url,
                status: job.status,
                crawledAt: job.completedAt || job.createdAt
            },
            scores: {
                seo: seoScore,
                performance: pageSpeed?.performanceScore || null,
                accessibility: pageSpeed?.accessibilityScore || null,
                bestPractices: pageSpeed?.bestPracticesScore || null
            },
            coreWebVitals: pageSpeed ? {
                lcp: pageSpeed.lcp,
                fid: pageSpeed.fid,
                cls: pageSpeed.cls,
                fcp: pageSpeed.fcp,
                tbt: pageSpeed.tbt,
                tti: pageSpeed.tti,
                speedIndex: pageSpeed.speedIndex
            } : null,
            totals,
            issues,
            issueDetails: {
                pagesWithMissingTitle: pages.filter(p => !p.title).map(p => ({ url: p.url, title: p.title })),
                pagesWithMissingMeta: pages.filter(p => !p.metaDescription).map(p => ({ url: p.url })),
                pagesWithMissingH1: pages.filter(p => !p.h1).map(p => ({ url: p.url })),
                slowPages: pages.filter(p => p.loadTimeMs && p.loadTimeMs > 3000)
                    .map(p => ({ url: p.url, loadTime: p.loadTimeMs })),
                brokenPages: pages.filter(p => p.statusCode >= 400)
                    .map(p => ({ url: p.url, statusCode: p.statusCode })),
                imagesWithMissingAlt: pages.flatMap(p =>
                    p.images.filter(img => !img.alt)
                        .map(img => ({ imageUrl: img.url, pageUrl: p.url }))
                ).slice(0, 50) // Limit to 50
            }
        }

        return NextResponse.json({
            success: true,
            audit
        })

    } catch (error: any) {
        console.error('[Audit] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
