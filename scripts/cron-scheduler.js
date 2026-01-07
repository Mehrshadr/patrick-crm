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

async function callEndpoint(endpoint, name) {
    const url = `${BASE_URL}${endpoint}?secret=${encodeURIComponent(CRON_SECRET)}`

    try {
        console.log(`[${new Date().toISOString()}] [${name}] Starting...`)

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CRON_SECRET}`
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

// Initial run
console.log(`[${new Date().toISOString()}] Cron Scheduler starting...`)
console.log(`  BASE_URL: ${BASE_URL}`)
console.log(`  Meeting Sync: Every ${MEETING_SYNC_INTERVAL / 1000 / 60} minutes`)
console.log(`  General Cron: Every ${GENERAL_CRON_INTERVAL / 1000 / 60} minutes`)

// Run immediately on startup
runMeetingSync()
runGeneralCron()

// Set up intervals
setInterval(runMeetingSync, MEETING_SYNC_INTERVAL)
setInterval(runGeneralCron, GENERAL_CRON_INTERVAL)

console.log(`[${new Date().toISOString()}] Cron Scheduler is running!`)
