module.exports = {
    apps: [
        {
            name: "patrick-crm",
            script: "npm",
            args: "start",
            env: {
                NODE_ENV: "production",
                NODE_OPTIONS: "--max-old-space-size=5120"
            }
        },
        {
            name: "cron-scheduler",
            script: "./scripts/cron-scheduler.js",
            env: {
                NODE_ENV: "production",
                NEXTAUTH_URL: "https://app.mehrana.agency",
                CRON_SECRET: "patrick-cron-secret-2024"
            },
            // Restart if it crashes
            autorestart: true,
            // Wait 5 seconds before restart
            restart_delay: 5000
        }
    ]
}
