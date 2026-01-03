/**
 * AES-256-GCM Encryption Utility
 * 
 * Used for encrypting sensitive API keys stored in the database.
 * Requires ENCRYPTION_KEY environment variable (32 bytes / 64 hex characters)
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits

/**
 * Get the encryption key from environment variable
 * Key should be 32 bytes (256 bits) - can be provided as hex string or raw
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY

    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is not set')
    }

    // If it looks like a hex string (64 chars), convert it
    if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
        return Buffer.from(key, 'hex')
    }

    // If it's exactly 32 bytes, use as-is
    if (key.length === 32) {
        return Buffer.from(key, 'utf8')
    }

    // Hash the key to get exactly 32 bytes
    return crypto.createHash('sha256').update(key).digest()
}

/**
 * Encrypt a plaintext string
 * 
 * @param plaintext - The string to encrypt
 * @returns Base64 encoded string containing IV + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Combine IV + AuthTag + Ciphertext and encode as base64
    const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
    ])

    return combined.toString('base64')
}

/**
 * Decrypt a ciphertext string
 * 
 * @param ciphertext - Base64 encoded string from encrypt()
 * @returns The original plaintext string
 */
export function decrypt(ciphertext: string): string {
    const key = getEncryptionKey()

    // Decode from base64
    const combined = Buffer.from(ciphertext, 'base64')

    // Extract IV, authTag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}

/**
 * Mask a sensitive value for display (show last 4 chars)
 * 
 * @param value - The sensitive value to mask
 * @returns Masked string like "••••xxxx"
 */
export function maskValue(value: string): string {
    if (!value || value.length <= 4) {
        return '••••••••'
    }

    const lastFour = value.slice(-4)
    return `••••${lastFour}`
}

/**
 * Check if encryption key is configured
 */
export function isEncryptionConfigured(): boolean {
    return !!process.env.ENCRYPTION_KEY
}

/**
 * Generate a random encryption key (for setup)
 * 
 * @returns 64-character hex string suitable for ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex')
}
