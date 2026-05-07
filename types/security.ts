// Security & Privacy Types

export interface EncryptionKey {
  key: string
  salt: string
}

export interface BiometricConfig {
  enabled: boolean
  type: 'fingerprint' | 'faceId' | 'iris' | null
  lastAuthenticated?: Date
}

export interface GDPRData {
  personalInfo: Record<string, any>
  userActivity: Record<string, any>
  preferences: Record<string, any>
  savedPlaces: Record<string, any>
  reviews: Record<string, any>
  chats: Record<string, any>
}

export interface DataExportRequest {
  userId: string
  format: 'json' | 'csv'
  timestamp: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

export interface SecurityPolicy {
  encryptionEnabled: boolean
  biometricRequired: boolean
  sessionTimeout: number // in minutes
  autoLockEnabled: boolean
}
