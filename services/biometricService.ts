import * as LocalAuthentication from 'expo-local-authentication'
import { storage } from './storage'
import { BiometricConfig } from '../types/security'

/**
 * Biometric Authentication Service
 * Handles device-level biometric authentication (fingerprint, Face ID)
 */

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'
const BIOMETRIC_TYPE_KEY = 'biometric_type'
const LAST_AUTH_KEY = 'biometric_last_auth'

/**
 * Check if device supports biometric authentication
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync()
    return compatible
  } catch (error) {
    console.error('Biometric availability check failed:', error)
    return false
  }
}

/**
 * Get available biometric types on device
 */
export async function getAvailableBiometricTypes(): Promise<
  LocalAuthentication.AuthenticationType[]
> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync()
    return types
  } catch (error) {
    console.error('Failed to get biometric types:', error)
    return []
  }
}

/**
 * Get biometric enrollment status
 */
export async function isBiometricEnrolled(): Promise<boolean> {
  try {
    const enrolled = await LocalAuthentication.isEnrolledAsync()
    return enrolled
  } catch (error) {
    console.error('Biometric enrollment check failed:', error)
    return false
  }
}

/**
 * Enable biometric authentication for the app
 */
export async function enableBiometric(): Promise<boolean> {
  try {
    const available = await isBiometricAvailable()
    const enrolled = await isBiometricEnrolled()

    if (!available || !enrolled) {
      throw new Error(
        'Biometric is not available or not enrolled on this device'
      )
    }

    const types = await getAvailableBiometricTypes()
    const type = types[0] // Use the first available type

    await storage.setItem(BIOMETRIC_ENABLED_KEY, 'true')
    await storage.setItem(BIOMETRIC_TYPE_KEY, type.toString())

    return true
  } catch (error) {
    console.error('Failed to enable biometric:', error)
    return false
  }
}

/**
 * Disable biometric authentication
 */
export async function disableBiometric(): Promise<void> {
  try {
    await storage.removeItem(BIOMETRIC_ENABLED_KEY)
    await storage.removeItem(BIOMETRIC_TYPE_KEY)
    await storage.removeItem(LAST_AUTH_KEY)
  } catch (error) {
    console.error('Failed to disable biometric:', error)
  }
}

/**
 * Check if biometric is enabled for app
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const enabled = await storage.getItem(BIOMETRIC_ENABLED_KEY)
    return enabled === 'true'
  } catch (error) {
    console.error('Failed to check biometric status:', error)
    return false
  }
}

/**
 * Authenticate with biometric
 */
export async function authenticateWithBiometric(
  reason: string = 'Authenticate to access ExploreEase'
): Promise<boolean> {
  try {
    const enabled = await isBiometricEnabled()
    if (!enabled) {
      throw new Error('Biometric authentication is not enabled')
    }

    const result = await LocalAuthentication.authenticateAsync({
      disableDeviceFallback: false,
      reason,
      fallbackLabel: 'Use passcode',
      disableDeviceOS: false,
    })

    if (result.success) {
      const timestamp = new Date().toISOString()
      await storage.setItem(LAST_AUTH_KEY, timestamp)
      return true
    }

    return false
  } catch (error) {
    console.error('Biometric authentication failed:', error)
    return false
  }
}

/**
 * Get last biometric authentication timestamp
 */
export async function getLastBiometricAuth(): Promise<Date | null> {
  try {
    const timestamp = await storage.getItem(LAST_AUTH_KEY)
    return timestamp ? new Date(timestamp) : null
  } catch (error) {
    console.error('Failed to get last auth time:', error)
    return null
  }
}

/**
 * Get current biometric configuration
 */
export async function getBiometricConfig(): Promise<BiometricConfig> {
  try {
    const enabled = await isBiometricEnabled()
    const typeStr = await storage.getItem(BIOMETRIC_TYPE_KEY)
    const lastAuth = await getLastBiometricAuth()

    let type: 'fingerprint' | 'faceId' | 'iris' | null = null
    if (typeStr) {
      if (typeStr.includes('FINGERPRINT')) type = 'fingerprint'
      else if (typeStr.includes('FACIAL')) type = 'faceId'
      else if (typeStr.includes('IRIS')) type = 'iris'
    }

    return {
      enabled,
      type,
      lastAuthenticated: lastAuth || undefined,
    }
  } catch (error) {
    console.error('Failed to get biometric config:', error)
    return {
      enabled: false,
      type: null,
    }
  }
}

/**
 * Require biometric authentication with timeout
 * Returns true if authenticated within timeout
 */
export async function requireBiometricWithTimeout(
  timeoutMinutes: number = 30
): Promise<boolean> {
  try {
    const lastAuth = await getLastBiometricAuth()
    if (!lastAuth) {
      return await authenticateWithBiometric()
    }

    const now = new Date()
    const minutesSinceAuth =
      (now.getTime() - lastAuth.getTime()) / (1000 * 60)

    if (minutesSinceAuth > timeoutMinutes) {
      return await authenticateWithBiometric()
    }

    return true
  } catch (error) {
    console.error('Biometric timeout check failed:', error)
    return false
  }
}
