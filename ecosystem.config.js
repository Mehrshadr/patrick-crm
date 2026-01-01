module.exports = {
    apps: [{
        name: "patrick-crm",
        script: "npm",
        args: "start",
        env: {
            NODE_ENV: "production",
            NODE_OPTIONS: "--max-old-space-size=5120"
        }
    }]
}
