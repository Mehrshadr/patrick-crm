"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Loader2, Globe, Link2, FileText, ExternalLink, ChevronRight, ChevronDown, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface DeepcrawlDashboardProps {
    siteUrl: string
    projectName: string
}

interface LinkNode {
    url: string
    name?: string
    metadata?: {
        title?: string
        description?: string
    }
    extractedLinks?: {
        internal?: string[]
        external?: string[]
    }
    children?: LinkNode[]
}

interface ReadResult {
    title?: string
    description?: string
    metadata?: Record<string, unknown>
    markdown?: string
    metrics?: {
        durationMs?: number
        readableDuration?: string
    }
}

interface LinksResult {
    tree?: LinkNode
    extractedLinks?: {
        internal?: string[]
        external?: string[]
    }
    metrics?: {
        durationMs?: number
    }
}

export function DeepcrawlDashboard({ siteUrl: initialSiteUrl, projectName }: DeepcrawlDashboardProps) {
    const [loading, setLoading] = useState(false)
    const [readResult, setReadResult] = useState<ReadResult | null>(null)
    const [linksResult, setLinksResult] = useState<LinksResult | null>(null)
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
    const [customUrl, setCustomUrl] = useState(initialSiteUrl)

    // Use customUrl for scanning
    const siteUrl = customUrl || initialSiteUrl

    const scanSite = async () => {
        if (!siteUrl) {
            toast.error("Please enter a site URL")
            return
        }
        setLoading(true)
        try {
            // First, read the homepage
            const readRes = await fetch("/api/deepcrawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "read", url: siteUrl })
            })
            const readData = await readRes.json()

            if (readData.success) {
                setReadResult(readData.data)
            } else {
                toast.error(`Read failed: ${readData.error}`)
            }

            // Then, extract links
            const linksRes = await fetch("/api/deepcrawl", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "links", url: siteUrl })
            })
            const linksData = await linksRes.json()

            if (linksData.success) {
                setLinksResult(linksData.data)
                toast.success("Site scan complete!")
            } else {
                toast.error(`Links extraction failed: ${linksData.error}`)
            }

        } catch (error) {
            console.error(error)
            toast.error("Failed to scan site")
        } finally {
            setLoading(false)
        }
    }

    const toggleNode = (url: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev)
            if (next.has(url)) {
                next.delete(url)
            } else {
                next.add(url)
            }
            return next
        })
    }

    const renderLinkTree = (node: LinkNode, depth = 0) => {
        const hasChildren = node.children && node.children.length > 0
        const isExpanded = expandedNodes.has(node.url)

        return (
            <div key={node.url} style={{ marginLeft: depth * 16 }}>
                <div
                    className="flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer"
                    onClick={() => hasChildren && toggleNode(node.url)}
                >
                    {hasChildren ? (
                        isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                    ) : (
                        <div className="w-4" />
                    )}
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate flex-1">
                        {node.metadata?.title || node.name || new URL(node.url).pathname || "/"}
                    </span>
                    <a
                        href={node.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>
                {hasChildren && isExpanded && (
                    <div>
                        {node.children!.map(child => renderLinkTree(child, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    // Count total links
    const countLinks = (node?: LinkNode): number => {
        if (!node) return 0
        let count = 1
        if (node.children) {
            for (const child of node.children) {
                count += countLinks(child)
            }
        }
        return count
    }

    const totalPages = countLinks(linksResult?.tree)
    const internalLinks = linksResult?.extractedLinks?.internal?.length ||
        linksResult?.tree?.extractedLinks?.internal?.length || 0
    const externalLinks = linksResult?.extractedLinks?.external?.length ||
        linksResult?.tree?.extractedLinks?.external?.length || 0

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Globe className="h-6 w-6" />
                        Deepcrawl Dashboard
                    </h2>
                    <p className="text-muted-foreground">
                        Site analysis for <strong>{projectName}</strong>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="w-64"
                    />
                    <Button onClick={scanSite} disabled={loading || !siteUrl}>
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Scanning...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Scan Site
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            {(readResult || linksResult) && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Pages Found</CardDescription>
                            <CardTitle className="text-3xl">{totalPages}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Internal Links</CardDescription>
                            <CardTitle className="text-3xl">{internalLinks}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>External Links</CardDescription>
                            <CardTitle className="text-3xl">{externalLinks}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Scan Time</CardDescription>
                            <CardTitle className="text-3xl">
                                {readResult?.metrics?.readableDuration || `${(linksResult?.metrics?.durationMs || 0) / 1000}s`}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            {/* Tabs */}
            {(readResult || linksResult) && (
                <Tabs defaultValue="overview" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="links">Links Tree</TabsTrigger>
                        <TabsTrigger value="content">Content</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <Card>
                            <CardHeader>
                                <CardTitle>Site Metadata</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Title</label>
                                    <p className="text-lg">{readResult?.title || readResult?.metadata?.title as string || "N/A"}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                                    <p>{readResult?.description || readResult?.metadata?.description as string || "N/A"}</p>
                                </div>
                                {readResult?.metadata && (
                                    <div>
                                        <label className="text-sm font-medium text-muted-foreground">Additional Metadata</label>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {Object.entries(readResult.metadata)
                                                .filter(([k]) => !['title', 'description'].includes(k))
                                                .slice(0, 10)
                                                .map(([key, value]) => (
                                                    <Badge key={key} variant="secondary">
                                                        {key}: {String(value).slice(0, 30)}
                                                    </Badge>
                                                ))
                                            }
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="links">
                        <Card>
                            <CardHeader>
                                <CardTitle>Site Structure</CardTitle>
                                <CardDescription>
                                    Hierarchical view of all pages found on the site
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {linksResult?.tree ? (
                                    <div className="max-h-[500px] overflow-auto">
                                        {renderLinkTree(linksResult.tree)}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground">No link tree available</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="content">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    <FileText className="h-5 w-5 inline mr-2" />
                                    Homepage Content (Markdown)
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {readResult?.markdown ? (
                                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-[500px] whitespace-pre-wrap">
                                        {readResult.markdown}
                                    </pre>
                                ) : (
                                    <p className="text-muted-foreground">No content available</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            )}

            {/* Empty State */}
            {!readResult && !linksResult && !loading && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">Ready to Scan</h3>
                        <p className="text-muted-foreground text-center mb-4">
                            Click "Scan Site" to analyze {siteUrl} using Deepcrawl API
                        </p>
                        <Button onClick={scanSite}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Start Scan
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
