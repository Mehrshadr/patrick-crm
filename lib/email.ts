import nodemailer from 'nodemailer'
import { google } from 'googleapis'

// For OAuth2 with Gmail
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.NEXTAUTH_URL
)

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

// Create OAuth2 transporter for Gmail
async function createGmailTransporter(accessToken: string, refreshToken: string) {
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
    })

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            type: 'OAuth2',
            user: process.env.GMAIL_USER_EMAIL,
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            refreshToken: refreshToken,
            accessToken: accessToken
        }
    })
}

// Simple SMTP transporter (for app password approach)
function createSmtpTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER_EMAIL,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    })
}

export async function sendEmail(
    options: SendEmailOptions,
    tokens?: { accessToken: string; refreshToken: string }
): Promise<SendEmailResult> {
    try {
        let transporter: nodemailer.Transporter

        if (tokens?.accessToken && tokens?.refreshToken) {
            // Use OAuth2
            transporter = await createGmailTransporter(tokens.accessToken, tokens.refreshToken)
        } else if (process.env.GMAIL_APP_PASSWORD) {
            // Use app password
            transporter = createSmtpTransporter()
        } else {
            return { success: false, error: 'No email credentials configured' }
        }

        const mailOptions = {
            from: options.from || process.env.GMAIL_USER_EMAIL,
            to: options.to,
            subject: options.subject,
            html: options.html,
            replyTo: options.replyTo
        }

        const info = await transporter.sendMail(mailOptions)
        console.log(`Email sent: ${info.messageId} to ${options.to}`)
        return { success: true, messageId: info.messageId }
    } catch (error: any) {
        console.error('Failed to send email:', error.message)
        return { success: false, error: error.message }
    }
}

// Test email connection
export async function testEmailConnection(): Promise<boolean> {
    if (!process.env.GMAIL_USER_EMAIL) return false
    if (!process.env.GMAIL_APP_PASSWORD && !process.env.GOOGLE_CLIENT_ID) return false

    try {
        const transporter = createSmtpTransporter()
        await transporter.verify()
        return true
    } catch {
        return false
    }
}
