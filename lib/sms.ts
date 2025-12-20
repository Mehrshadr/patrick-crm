import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

let client: twilio.Twilio | null = null

function getClient() {
    if (!client && accountSid && authToken) {
        client = twilio(accountSid, authToken)
    }
    return client
}

interface SendSmsResult {
    success: boolean
    messageId?: string
    error?: string
}

export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
    const twilioClient = getClient()

    if (!twilioClient) {
        console.error('Twilio client not configured - check TWILIO_* env vars')
        return { success: false, error: 'Twilio not configured' }
    }

    if (!fromNumber) {
        return { success: false, error: 'TWILIO_PHONE_NUMBER not set' }
    }

    try {
        // Format phone number if needed
        let formattedTo = to.replace(/[^\d+]/g, '')
        if (!formattedTo.startsWith('+')) {
            formattedTo = '+1' + formattedTo // Default to US/Canada
        }

        const message = await twilioClient.messages.create({
            body,
            from: fromNumber,
            to: formattedTo
        })

        console.log(`SMS sent: ${message.sid} to ${formattedTo}`)
        return { success: true, messageId: message.sid }
    } catch (error: any) {
        console.error('Failed to send SMS:', error.message)
        return { success: false, error: error.message }
    }
}

// Test function
export async function testSmsConnection(): Promise<boolean> {
    const client = getClient()
    if (!client) return false

    try {
        // Just verify account is valid
        await client.api.accounts(accountSid!).fetch()
        return true
    } catch {
        return false
    }
}
