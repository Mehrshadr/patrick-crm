import { google } from 'googleapis'

interface SendEmailOptions {
    to: string
    subject: string
    html: string
    from?: string
    replyTo?: string
}

interface SendEmailResult {
    success: boolean
    messageId?: string
    error?: string
}

// Send email using Gmail API directly (like n8n does)
async function sendViaGmailAPI(
    options: SendEmailOptions,
    accessToken: string,
    refreshToken: string
): Promise<SendEmailResult> {
    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.NEXTAUTH_URL
        )

        oauth2Client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken
        })

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

        // Hardened Recipient Validation
        const recipient = (options.to || '').trim()
        if (!recipient) {
            console.error('[Email Service] Error: Recipient email is empty or invalid.')
            return { success: false, error: 'Recipient address required (Hardened Check)' }
        }

        console.log(`[Email Service] Preparing to send email to: "${recipient}"`)

        // Use the provided 'from' which can be a name or email, format properly for RFC 5322
        const senderInfo = (options.from || '').trim()

        // Fetch the authenticated user's email address from Gmail API
        // This is needed to properly format the From header
        let authenticatedEmail = ''
        try {
            const profile = await gmail.users.getProfile({ userId: 'me' })
            authenticatedEmail = profile.data.emailAddress || ''
            console.log(`[Email Service] Authenticated as: ${authenticatedEmail}`)
        } catch (e) {
            console.error('[Email Service] Failed to fetch user profile:', e)
        }

        // Build proper From header: "Sender Name" <email@example.com>
        let fromHeader: string | null = null
        if (senderInfo) {
            if (senderInfo.includes('@')) {
                // It's already an email address (possibly with name)
                fromHeader = `From: ${senderInfo}`
            } else if (authenticatedEmail) {
                // It's a display name - combine with authenticated email
                fromHeader = `From: "${senderInfo}" <${authenticatedEmail}>`
            } else {
                // Fallback: just use the name (Gmail might add email automatically)
                fromHeader = `From: ${senderInfo}`
            }
        } else if (authenticatedEmail) {
            // No sender info provided, use just the authenticated email
            fromHeader = `From: ${authenticatedEmail}`
        }

        // Build the email in RFC 2822 format
        const messageParts = [
            fromHeader,
            options.replyTo ? `Reply-To: ${options.replyTo}` : null,
            `To: ${recipient}`,
            `Subject: ${options.subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            options.html
        ]
        const message = messageParts.filter(part => part !== null).join('\n')

        console.log('[Email Service] Raw Message Header Preview:\n', message.split('\n\n')[0])

        // Encode to base64url
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')

        // Send via Gmail API
        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        })

        console.log(`Email sent via Gmail API: ${res.data.id} to ${options.to}`)
        return { success: true, messageId: res.data.id || undefined }
    } catch (error: any) {
        console.error('Gmail API error:', error.message)
        return { success: false, error: error.message }
    }
}

export async function sendEmail(
    options: SendEmailOptions,
    tokens?: { accessToken: string; refreshToken: string }
): Promise<SendEmailResult> {
    // Try Gmail API first (like n8n)
    if (tokens?.accessToken && tokens?.refreshToken) {
        console.log('Attempting to send via Gmail API with OAuth...')
        return await sendViaGmailAPI(options, tokens.accessToken, tokens.refreshToken)
    }

    // No credentials available
    return { success: false, error: 'No OAuth tokens available. Please log out and log back in with Google.' }
}

// Test email connection
export async function testEmailConnection(): Promise<boolean> {
    // For Gmail API, we can't really test without tokens
    // Return false to indicate manual testing is needed
    return false
}
