import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import {
  encryptData,
  decryptData,
  encryptAndStore,
  retrieveAndDecrypt,
} from '@/services/encryptionService'
import {
  authenticateWithBiometric,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  getBiometricConfig,
} from '@/services/biometricService'
import {
  exportUserDataAsJSON,
  exportUserDataAsCSV,
  deleteAllUserData,
  getAllUserData,
} from '@/services/gdprService'

export function useEncryption() {
  const [isEncrypting, setIsEncrypting] = useState(false)
  const [encryptionError, setEncryptionError] = useState<string | null>(null)

  const encrypt = useCallback(async (data: string | Record<string, any>) => {
    try {
      setIsEncrypting(true)
      setEncryptionError(null)
      const encrypted = await encryptData(data)
      return encrypted
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Encryption failed'
      setEncryptionError(message)
      throw error
    } finally {
      setIsEncrypting(false)
    }
  }, [])

  const decrypt = useCallback(async (encryptedData: string) => {
    try {
      setIsEncrypting(true)
      setEncryptionError(null)
      const decrypted = await decryptData(encryptedData)
      return decrypted
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Decryption failed'
      setEncryptionError(message)
      throw error
    } finally {
      setIsEncrypting(false)
    }
  }, [])

  const saveEncrypted = useCallback(
    async (key: string, data: Record<string, any>) => {
      try {
        setIsEncrypting(true)
        setEncryptionError(null)
        await encryptAndStore(key, data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save encrypted data'
        setEncryptionError(message)
        throw error
      } finally {
        setIsEncrypting(false)
      }
    },
    []
  )

  const loadEncrypted = useCallback(async (key: string) => {
    try {
      setIsEncrypting(true)
      setEncryptionError(null)
      const data = await retrieveAndDecrypt(key)
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load encrypted data'
      setEncryptionError(message)
      throw error
    } finally {
      setIsEncrypting(false)
    }
  }, [])

  return {
    encrypt,
    decrypt,
    saveEncrypted,
    loadEncrypted,
    isEncrypting,
    encryptionError,
  }
}

export function useBiometric() {
  const [isBiometricLoading, setIsBiometricLoading] = useState(false)
  const [biometricError, setBiometricError] = useState<string | null>(null)

  const authenticate = useCallback(async () => {
    try {
      setIsBiometricLoading(true)
      setBiometricError(null)
      const success = await authenticateWithBiometric()
      return success
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed'
      setBiometricError(message)
      return false
    } finally {
      setIsBiometricLoading(false)
    }
  }, [])

  const checkEnabled = useCallback(async () => {
    try {
      const enabled = await isBiometricEnabled()
      return enabled
    } catch (error) {
      console.error('Failed to check biometric status:', error)
      return false
    }
  }, [])

  const enable = useCallback(async () => {
    try {
      setIsBiometricLoading(true)
      setBiometricError(null)
      const success = await enableBiometric()
      return success
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to enable biometric'
      setBiometricError(message)
      return false
    } finally {
      setIsBiometricLoading(false)
    }
  }, [])

  const disable = useCallback(async () => {
    try {
      setIsBiometricLoading(true)
      setBiometricError(null)
      await disableBiometric()
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disable biometric'
      setBiometricError(message)
      return false
    } finally {
      setIsBiometricLoading(false)
    }
  }, [])

  const getConfig = useCallback(async () => {
    try {
      const config = await getBiometricConfig()
      return config
    } catch (error) {
      console.error('Failed to get biometric config:', error)
      return { enabled: false, type: null }
    }
  }, [])

  return {
    authenticate,
    checkEnabled,
    enable,
    disable,
    getConfig,
    isBiometricLoading,
    biometricError,
  }
}

export function useGDPR(userId: string) {
  const [isGDPRLoading, setIsGDPRLoading] = useState(false)
  const [gdprError, setGdprError] = useState<string | null>(null)

  const exportJSON = useCallback(async () => {
    try {
      setIsGDPRLoading(true)
      setGdprError(null)
      const data = await exportUserDataAsJSON(userId)
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      setGdprError(message)
      throw error
    } finally {
      setIsGDPRLoading(false)
    }
  }, [userId])

  const exportCSV = useCallback(async () => {
    try {
      setIsGDPRLoading(true)
      setGdprError(null)
      const data = await exportUserDataAsCSV(userId)
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed'
      setGdprError(message)
      throw error
    } finally {
      setIsGDPRLoading(false)
    }
  }, [userId])

  const deleteData = useCallback(async () => {
    try {
      setIsGDPRLoading(true)
      setGdprError(null)
      await deleteAllUserData(userId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Deletion failed'
      setGdprError(message)
      throw error
    } finally {
      setIsGDPRLoading(false)
    }
  }, [userId])

  const getAllData = useCallback(async () => {
    try {
      setIsGDPRLoading(true)
      setGdprError(null)
      const data = await getAllUserData(userId)
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve data'
      setGdprError(message)
      throw error
    } finally {
      setIsGDPRLoading(false)
    }
  }, [userId])

  return {
    exportJSON,
    exportCSV,
    deleteData,
    getAllData,
    isGDPRLoading,
    gdprError,
  }
}
