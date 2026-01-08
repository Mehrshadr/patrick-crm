#!/usr/bin/env node

/**
 * Cron Scheduler for Patrick CRM
 * This script runs cron jobs internally, calling the API endpoints with proper authentication.
 * Run with: node scripts/cron-scheduler.js
 * Or via PM2: pm2 start scripts/cron-scheduler.js --name cron-scheduler
 */

const CRON_SECRET = process.env.CRON_SECRET || 'patrick-cron-secret-2024'
const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'

// Cron schedule intervals (in milliseconds)
const MEETING_SYNC_INTERVAL = 2 * 60 * 1000  // Every 2 minutes
const GENERAL_CRON_INTERVAL = 5 * 60 * 1000  // Every 5 minutes
const IMAGE_SYNC_INTERVAL = 2 * 60 * 1000    // Every 2 minutes

// Startup delay to wait for main app to be ready
const STARTUP_DELAY = 30 * 1000  // 30 seconds

async function callEndpoint(endpoint, name, method = 'GET') {
    const url = `${BASE_URL}${endpoint}${method === 'GET' ? `?secret=${encodeURIComponent(CRON_SECRET)}` : ''}`

    try {
        console.log(`[${new Date().toISOString()}] [${name}] Starting...`)

        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${CRON_SECRET}`,
                'Content-Type': 'application/json'
            }
        })

        const data = await response.json()

        if (response.ok) {
            console.log(`[${new Date().toISOString()}] [${name}] Success:`, JSON.stringify(data))
        } else {
            console.error(`[${new Date().toISOString()}] [${name}] Error ${response.status}:`, JSON.stringify(data))
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] [${name}] Fetch error:`, error.message)
    }
}

async function runMeetingSync() {
    await callEndpoint('/api/cron/meeting-sync', 'MeetingSync')
}

async function runGeneralCron() {
    await callEndpoint('/api/cron', 'GeneralCron')
}

async function runImageSync() {
    await callEndpoint('/api/cron/image-sync', 'ImageSync', 'POST')
}

async function startScheduler() {
    console.log(`[${new Date().toISOString()}] Cron Scheduler starting...`)
    console.log(`  BASE_URL: ${BASE_URL}`)
    console.log(`  CRON_SECRET: ${CRON_SECRET.substring(0, 10)}...`)
    console.log(`  Startup delay: ${STARTUP_DELAY / 1000} seconds`)
    console.log(`  Meeting Sync: Every ${MEETING_SYNC_INTERVAL / 1000 / 60} minutes`)
    console.log(`  General Cron: Every ${GENERAL_CRON_INTERVAL / 1000 / 60} minutes`)
    console.log(`  Image Sync: Every ${IMAGE_SYNC_INTERVAL / 1000 / 60} minutes`)

    // Wait for main app to start
    console.log(`[${new Date().toISOString()}] Waiting ${STARTUP_DELAY / 1000} seconds for main app to start...`)
    await new Promise(resolve => setTimeout(resolve, STARTUP_DELAY))

    // Run immediately after delay
    console.log(`[${new Date().toISOString()}] Starting first sync...`)
    runMeetingSync()
    runGeneralCron()
    runImageSync()

    // Set up intervals
    setInterval(runMeetingSync, MEETING_SYNC_INTERVAL)
    setInterval(runGeneralCron, GENERAL_CRON_INTERVAL)
    setInterval(runImageSync, IMAGE_SYNC_INTERVAL)

    console.log(`[${new Date().toISOString()}] Cron Scheduler is running!`)
}

// Start the scheduler
startScheduler()
