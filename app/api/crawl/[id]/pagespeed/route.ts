import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchPageSpeed } from '@/lib/crawler/pagespeed'

// GET - Get PageSpeed results for a job
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

        const results = await prisma.pageSpeedResult.findMany({
            where: { jobId },
            orderBy: { fetchedAt: 'desc' }
        })

        return NextResponse.json({
            success: true,
            results
        })

    } catch (error: any) {
        console.error('[PageSpeed] GET error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST - Run PageSpeed test for the job's URL
export async function POST(
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

        // Get job to find URL
        const job = await prisma.crawlJob.findUnique({
            where: { id: jobId }
        })

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        const body = await request.json().catch(() => ({}))
        const strategy = body.strategy || 'mobile'

        // Fetch PageSpeed metrics
        const result = await fetchPageSpeed(job.url, strategy)

        if (!result.success || !result.metrics) {
            return NextResponse.json({
                success: false,
                error: result.error || 'Failed to fetch PageSpeed metrics'
            }, { status: 500 })
        }

        // Save to database
        const saved = await prisma.pageSpeedResult.upsert({
            where: {
                jobId_url_strategy: {
                    jobId,
                    url: job.url,
                    strategy
                }
            },
            update: {
                performanceScore: result.metrics.performanceScore,
                accessibilityScore: result.metrics.accessibilityScore,
                seoScore: result.metrics.seoScore,
                bestPracticesScore: result.metrics.bestPracticesScore,
                lcp: result.metrics.lcp,
                fid: result.metrics.fid,
                cls: result.metrics.cls,
                fcp: result.metrics.fcp,
                tbt: result.metrics.tbt,
                tti: result.metrics.tti,
                speedIndex: result.metrics.speedIndex,
                serverResponseTime: result.metrics.serverResponseTime,
                fetchedAt: new Date()
            },
            create: {
                jobId,
                url: job.url,
                strategy,
                performanceScore: result.metrics.performanceScore,
                accessibilityScore: result.metrics.accessibilityScore,
                seoScore: result.metrics.seoScore,
                bestPracticesScore: result.metrics.bestPracticesScore,
                lcp: result.metrics.lcp,
                fid: result.metrics.fid,
                cls: result.metrics.cls,
                fcp: result.metrics.fcp,
                tbt: result.metrics.tbt,
                tti: result.metrics.tti,
                speedIndex: result.metrics.speedIndex,
                serverResponseTime: result.metrics.serverResponseTime
            }
        })

        return NextResponse.json({
            success: true,
            result: saved
        })

    } catch (error: any) {
        console.error('[PageSpeed] POST error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
