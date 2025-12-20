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

        // Use the provided 'from' email or fallback to empty (Gmail will fill it)
        const senderEmail = options.from || ''

        // Build the email in RFC 2822 format
        const messageParts = [
            senderEmail ? `From: ${senderEmail}` : '',
            `To: ${options.to}`,
            `Subject: ${options.subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            options.html
        ]
        const message = messageParts.join('\n')

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
