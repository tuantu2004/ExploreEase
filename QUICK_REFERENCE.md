# Security & Privacy - Quick Reference

## 🔐 Encryption Service

```typescript
import * as Encryption from '@/services/encryptionService'

// Get or create encryption key
const key = await Encryption.getOrCreateEncryptionKey()

// Encrypt data
const encrypted = await Encryption.encryptData({ secret: 'value' })

// Decrypt data
const decrypted = await Encryption.decryptData(encrypted)

// Encrypt and store
await Encryption.encryptAndStore('myKey', { data: 'value' })

// Retrieve and decrypt
const data = await Encryption.retrieveAndDecrypt('myKey')

// Hash password
const hashed = Encryption.hashPassword('password123')

// Clear encryption key
await Encryption.clearEncryptionKey()
```

---

## 👆 Biometric Service

```typescript
import * as Biometric from '@/services/biometricService'

// Check if available
const available = await Biometric.isBiometricAvailable()

// Check if enrolled
const enrolled = await Biometric.isBiometricEnrolled()

// Get available types
const types = await Biometric.getAvailableBiometricTypes()
// Returns: [1] (FINGERPRINT), [2] (FACIAL), [3] (IRIS)

// Enable biometric
const success = await Biometric.enableBiometric()

// Disable biometric
await Biometric.disableBiometric()

// Check if enabled
const enabled = await Biometric.isBiometricEnabled()

// Authenticate
const authenticated = await Biometric.authenticateWithBiometric('Your reason')

// Get last auth time
const lastAuth = await Biometric.getLastBiometricAuth()

// Get config
const config = await Biometric.getBiometricConfig()
// Returns: { enabled: true, type: 'fingerprint', lastAuthenticated: Date }

// Require auth with timeout (minutes)
const valid = await Biometric.requireBiometricWithTimeout(30)
```

---

## 📋 GDPR Service

```typescript
import * as GDPR from '@/services/gdprService'

// Get all user data
const allData = await GDPR.getAllUserData(userId)

// Export as JSON
const json = await GDPR.exportUserDataAsJSON(userId)

// Export as CSV
const csv = await GDPR.exportUserDataAsCSV(userId)

// Get specific category
const reviews = await GDPR.getUserDataByCategory(userId, 'reviews')

// Delete all data (IRREVERSIBLE)
await GDPR.deleteAllUserData(userId)

// Delete specific category
await GDPR.deleteUserDataByCategory(userId, 'reviews')
// Valid categories: userActivity, preferences, savedPlaces, reviews, chats

// Request data export
const request = await GDPR.requestDataExport(userId, 'json')

// Get export status
const status = await GDPR.getExportRequestStatus(requestId)

// Download data
const { data, filename, mimeType } = await GDPR.downloadUserData(userId, 'json')

// Get compliance status
const status = await GDPR.getGDPRComplianceStatus(userId)
// Returns: { dataAvailable, canExport, canDelete, lastExportDate }
```

---

## 🔑 Auth Service (Security Updates)

```typescript
import * as Auth from '@/services/authService'

// Register (encrypts data automatically)
const session = await Auth.register({ email, password, name })

// Login email (encrypts session automatically)
const session = await Auth.login({ email, password })

// Login biometric
const success = await Auth.loginWithBiometric()

// Login Google (existing)
const session = await Auth.loginWithGoogle()

// Logout (clears encrypted data)
await Auth.logout()

// Get session
const session = await Auth.getSession()

// Get profile (with optional biometric verification)
const profile = await Auth.getProfile(userId)

// Update profile
const updated = await Auth.updateProfile(userId, { name: 'New Name' })

// Get encrypted profile
const encrypted = await Auth.getEncryptedProfile(userId)

// Verify session security
const isSecure = await Auth.verifySessionSecurity()

// Forgot password (existing)
await Auth.forgotPassword(email)
```

---

## 🪝 Security Hooks

### useEncryption()

```typescript
import { useEncryption } from '@/hooks/useSecurity'

const {
  encrypt,              // (data) => Promise<string>
  decrypt,              // (encrypted) => Promise<string>
  saveEncrypted,        // (key, data) => Promise<void>
  loadEncrypted,        // (key) => Promise<any | null>
  isEncrypting,         // boolean
  encryptionError       // string | null
} = useEncryption()

// Example
const encrypted = await encrypt({ secret: 'value' })
await saveEncrypted('myKey', { data: 'value' })
const data = await loadEncrypted('myKey')
```

### useBiometric()

```typescript
import { useBiometric } from '@/hooks/useSecurity'

const {
  authenticate,         // () => Promise<boolean>
  checkEnabled,         // () => Promise<boolean>
  enable,              // () => Promise<boolean>
  disable,             // () => Promise<boolean>
  getConfig,           // () => Promise<BiometricConfig>
  isBiometricLoading,  // boolean
  biometricError       // string | null
} = useBiometric()

// Example
const success = await authenticate()
const enabled = await checkEnabled()
```

### useGDPR(userId)

```typescript
import { useGDPR } from '@/hooks/useSecurity'

const {
  exportJSON,           // () => Promise<string>
  exportCSV,            // () => Promise<string>
  deleteData,           // () => Promise<void>
  getAllData,           // () => Promise<GDPRData>
  isGDPRLoading,        // boolean
  gdprError             // string | null
} = useGDPR(userId)

// Example
const json = await exportJSON()
await deleteData()
```

---

## 🎯 Common Patterns

### Secure Login Flow

```typescript
async function handleSecureLogin(email, password) {
  // Login and encrypt session
  const session = await login({ email, password })
  
  // Enable biometric (optional)
  const bioEnabled = await enableBiometric()
  
  // Navigate to app
  navigate('home')
}
```

### Protected Route

```typescript
async function ProtectedComponent({ children }) {
  const [isSecure, setIsSecure] = useState(false)
  
  useEffect(() => {
    const check = async () => {
      const secure = await verifySessionSecurity()
      setIsSecure(secure)
    }
    check()
  }, [])
  
  if (!isSecure) return <Text>Biometric required</Text>
  return children
}
```

### GDPR Export Button

```typescript
function ExportButton({ userId }) {
  const { exportJSON, isGDPRLoading } = useGDPR(userId)
  
  const handleExport = async () => {
    const data = await exportJSON()
    // Trigger download
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([data]))
    link.download = 'data.json'
    link.click()
  }
  
  return (
    <Button 
      onPress={handleExport}
      disabled={isGDPRLoading}
      label={isGDPRLoading ? 'Exporting...' : 'Export Data'}
    />
  )
}
```

### Settings Integration

```typescript
import { SecuritySettingsScreen, PrivacyPreferencesScreen } from '@/components/security'

// In your navigation
<Stack.Screen name="security" component={SecuritySettingsScreen} />
<Stack.Screen name="privacy" component={PrivacyPreferencesScreen} />

// In settings button
<Button label="Security" onPress={() => navigate('security')} />
<Button label="Privacy" onPress={() => navigate('privacy')} />
```

---

## 📊 Data Structures

### BiometricConfig
```typescript
{
  enabled: boolean
  type: 'fingerprint' | 'faceId' | 'iris' | null
  lastAuthenticated?: Date
}
```

### GDPRData
```typescript
{
  personalInfo: Record<string, any>      // Profile
  userActivity: Record<string, any>      // Activity logs
  preferences: Record<string, any>       // Settings
  savedPlaces: Record<string, any>       // Bookmarks
  reviews: Record<string, any>           // Reviews
  chats: Record<string, any>             // Messages
}
```

### PrivacyPreferences
```typescript
{
  profileVisible: boolean                // Show in search
  allowMessages: boolean                 // Accept messages
  shareLocation: boolean                 // Share location
  allowAnalytics: boolean                // Usage analytics
  dataRetention: '30days' | '90days' | '1year' | 'indefinite'
  allowThirdParty: boolean               // Third-party sharing
  emailNotifications: boolean
  pushNotifications: boolean
  marketingEmails: boolean
}
```

---

## ⚠️ Important Notes

1. **Keys persist**: Encryption keys survive app restarts
2. **Biometric optional**: Gracefully degrades on unsupported devices
3. **Deletion irreversible**: No recovery after GDPR delete
4. **Platform differences**: Native (Keychain/Keystore) vs Web (localStorage)
5. **Timeout granular**: Biometric timeout per operation, not global

---

## 🚨 Error Handling

```typescript
try {
  const encrypted = await encryptData(data)
} catch (error) {
  console.error('Encryption failed:', error.message)
  // Handle encryption error
}

try {
  const success = await authenticateWithBiometric()
  if (!success) {
    // User cancelled or authentication failed
  }
} catch (error) {
  console.error('Biometric unavailable:', error.message)
}

try {
  await deleteAllUserData(userId)
} catch (error) {
  console.error('Deletion failed:', error.message)
  // Likely database permission or table missing
}
```

---

## 🔗 Files Reference

| File | Purpose |
|------|---------|
| `services/encryptionService.ts` | Encryption operations |
| `services/biometricService.ts` | Biometric authentication |
| `services/gdprService.ts` | GDPR compliance |
| `services/authService.ts` | Auth with security |
| `hooks/useSecurity.ts` | React hooks |
| `types/security.ts` | TypeScript types |
| `components/security/SecuritySettingsScreen.tsx` | Settings UI |
| `components/security/PrivacyPreferencesScreen.tsx` | Privacy UI |
| `SECURITY_PRIVACY.md` | Full documentation |
| `SETUP_SECURITY.md` | Setup guide |

---

For detailed documentation, see [SECURITY_PRIVACY.md](./SECURITY_PRIVACY.md)
For setup instructions, see [SETUP_SECURITY.md](./SETUP_SECURITY.md)
