import CryptoJS from 'crypto-js'
import { storage } from './storage'

/**
 * Encryption Service
 * Provides end-to-end encryption for sensitive data
 */

const ENCRYPTION_KEY_STORAGE = 'app_encryption_key'
const ENCRYPTION_SALT_STORAGE = 'app_encryption_salt'

/**
 * Generate a secure encryption key
 */
export async function generateEncryptionKey(): Promise<string> {
  const random = CryptoJS.lib.WordArray.random(256 / 8)
  const key = random.toString()
  return key
}

/**
 * Generate salt for additional security
 */
export function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(128 / 8).toString()
}

/**
 * Get or create encryption key
 */
export async function getOrCreateEncryptionKey(): Promise<string> {
  try {
    let key = await storage.getItem(ENCRYPTION_KEY_STORAGE)
    if (!key) {
      key = await generateEncryptionKey()
      await storage.setItem(ENCRYPTION_KEY_STORAGE, key)
    }
    return key
  } catch (error) {
    console.error('Failed to get encryption key:', error)
    throw new Error('Encryption key management failed')
  }
}

/**
 * Encrypt sensitive data
 */
export async function encryptData(
  data: string | Record<string, any>,
  customKey?: string
): Promise<string> {
  try {
    const key = customKey || (await getOrCreateEncryptionKey())
    const dataString = typeof data === 'string' ? data : JSON.stringify(data)
    
    const encrypted = CryptoJS.AES.encrypt(dataString, key).toString()
    return encrypted
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('Data encryption failed')
  }
}

/**
 * Decrypt sensitive data
 */
export async function decryptData(
  encryptedData: string,
  customKey?: string
): Promise<string> {
  try {
    const key = customKey || (await getOrCreateEncryptionKey())
    
    const decrypted = CryptoJS.AES.decrypt(encryptedData, key).toString(
      CryptoJS.enc.Utf8
    )
    return decrypted
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('Data decryption failed')
  }
}

/**
 * Encrypt and store object
 */
export async function encryptAndStore(
  key: string,
  data: Record<string, any>
): Promise<void> {
  try {
    const encrypted = await encryptData(data)
    await storage.setItem(key, encrypted)
  } catch (error) {
    console.error('Failed to encrypt and store:', error)
    throw error
  }
}

/**
 * Retrieve and decrypt object
 */
export async function retrieveAndDecrypt<T>(key: string): Promise<T | null> {
  try {
    const encrypted = await storage.getItem(key)
    if (!encrypted) return null
    
    const decrypted = await decryptData(encrypted)
    return JSON.parse(decrypted) as T
  } catch (error) {
    console.error('Failed to retrieve and decrypt:', error)
    return null
  }
}

/**
 * Hash password (for additional security layer)
 */
export function hashPassword(password: string, salt?: string): string {
  const finalSalt = salt || generateSalt()
  const hashed = CryptoJS.PBKDF2(password, finalSalt, {
    keySize: 256 / 32,
    iterations: 1000,
  }).toString()
  return hashed
}

/**
 * Clear encryption key (use carefully)
 */
export async function clearEncryptionKey(): Promise<void> {
  try {
    await storage.removeItem(ENCRYPTION_KEY_STORAGE)
    await storage.removeItem(ENCRYPTION_SALT_STORAGE)
  } catch (error) {
    console.error('Failed to clear encryption key:', error)
  }
}
