# Security & Privacy Implementation Guide

## Overview
This document describes the security and privacy features implemented in ExploreEase, including end-to-end encryption, biometric authentication, and GDPR compliance.

---

## 1. End-to-End Encryption

### Purpose
Encrypt sensitive user data (login credentials, profile information) both at rest and in transit.

### Implementation
- **Service**: `encryptionService.ts`
- **Method**: AES encryption via `crypto-js`
- **Storage**: Encrypted keys stored in secure storage

### Key Functions

#### `getOrCreateEncryptionKey()`
Retrieves or generates a unique encryption key for the device.
```typescript
const key = await getOrCreateEncryptionKey()
```

#### `encryptData(data, customKey?)`
Encrypts sensitive data using AES.
```typescript
const encrypted = await encryptData({
  email: 'user@example.com',
  password: 'hashed_password'
})
```

#### `decryptData(encryptedData, customKey?)`
Decrypts previously encrypted data.
```typescript
const decrypted = await decryptData(encryptedData)
```

#### `encryptAndStore(key, data)`
Encrypts and securely stores data locally.
```typescript
await encryptAndStore('user_profile', {
  name: 'John Doe',
  preferences: { ... }
})
```

#### `retrieveAndDecrypt(key)`
Retrieves and decrypts stored data.
```typescript
const profile = await retrieveAndDecrypt('user_profile')
```

### Usage Example
```typescript
// In authService.ts
export async function register(form: RegisterForm) {
  const { data, error } = await supabase.auth.signUp({...})
  
  // Encrypt and store registration data
  await encryptAndStore(`user_profile_${data.user.id}`, {
    email: form.email,
    name: form.name,
    registeredAt: new Date().toISOString(),
  })
  
  return data
}
```

---

## 2. Biometric Authentication

### Purpose
Enable optional device-level biometric authentication (fingerprint, Face ID) for app access.

### Implementation
- **Service**: `biometricService.ts`
- **Library**: `expo-local-authentication`
- **Support**: iOS and Android devices with biometric hardware

### Key Functions

#### `isBiometricAvailable()`
Check if device supports biometric authentication.
```typescript
const available = await isBiometricAvailable()
```

#### `isBiometricEnrolled()`
Check if user has enrolled biometric data.
```typescript
const enrolled = await isBiometricEnrolled()
```

#### `enableBiometric()`
Enable biometric authentication for the app.
```typescript
const success = await enableBiometric()
if (success) {
  console.log('Biometric enabled')
}
```

#### `disableBiometric()`
Disable biometric authentication.
```typescript
await disableBiometric()
```

#### `authenticateWithBiometric(reason?)`
Prompt user for biometric authentication.
```typescript
const authenticated = await authenticateWithBiometric(
  'Authenticate to access ExploreEase'
)
if (authenticated) {
  // Grant access
}
```

#### `requireBiometricWithTimeout(timeoutMinutes?)`
Require biometric re-authentication after timeout period.
```typescript
const valid = await requireBiometricWithTimeout(30) // 30 minutes
```

#### `getBiometricConfig()`
Get current biometric configuration.
```typescript
const config = await getBiometricConfig()
// Returns: { enabled: boolean, type: 'fingerprint' | 'faceId' | 'iris' | null }
```

### Usage Example
```typescript
// In authService.ts
export async function loginWithBiometric() {
  const biometricEnabled = await isBiometricEnabled()
  if (!biometricEnabled) {
    throw new Error('Biometric not enabled')
  }
  
  const authenticated = await authenticateWithBiometric()
  return authenticated
}

// Require biometric before accessing profile
export async function getProfile(userId: string) {
  const bioEnabled = await isBiometricEnabled()
  if (bioEnabled) {
    const bioAuth = await requireBiometricWithTimeout(30)
    if (!bioAuth) {
      throw new Error('Biometric authentication required')
    }
  }
  
  return await supabase.from('profiles').select(...).eq('id', userId)
}
```

---

## 3. GDPR Compliance

### Purpose
Enable users to view, download, and delete their personal data according to GDPR regulations.

### Implementation
- **Service**: `gdprService.ts`
- **Compliance**: EU General Data Protection Regulation (GDPR)

### Key Functions

#### `getAllUserData(userId)`
Retrieve all user personal data.
```typescript
const allData = await getAllUserData(userId)
// Returns: {
//   personalInfo: {...},
//   userActivity: {...},
//   preferences: {...},
//   savedPlaces: {...},
//   reviews: {...},
//   chats: {...}
// }
```

#### `exportUserDataAsJSON(userId)`
Export all data in JSON format.
```typescript
const jsonData = await exportUserDataAsJSON(userId)
// Returns: JSON string with all user data
```

#### `exportUserDataAsCSV(userId)`
Export all data in CSV format.
```typescript
const csvData = await exportUserDataAsCSV(userId)
// Returns: CSV string with flattened data
```

#### `downloadUserData(userId, format?)`
Prepare data for download (JSON or CSV).
```typescript
const { data, filename, mimeType } = await downloadUserData(
  userId,
  'json'
)
// Use data and filename to trigger download
```

#### `deleteAllUserData(userId)`
⚠️ **IRREVERSIBLE** - Delete all user data.
```typescript
// This will delete:
// - User profile
// - All preferences
// - Saved places
// - Reviews
// - Chat history
// - Activity logs
// - Auth account
await deleteAllUserData(userId)
```

#### `deleteUserDataByCategory(userId, category)`
Delete specific data category.
```typescript
await deleteUserDataByCategory(userId, 'reviews')
// Valid categories: userActivity, preferences, savedPlaces, reviews, chats
```

#### `getGDPRComplianceStatus(userId)`
Check user's GDPR compliance status.
```typescript
const status = await getGDPRComplianceStatus(userId)
// Returns: { dataAvailable: boolean, canExport: boolean, canDelete: boolean }
```

### Data Categories Exported
- **personalInfo**: User profile, email, name, avatar
- **userActivity**: Login history, app usage logs
- **preferences**: Language, notifications, privacy settings
- **savedPlaces**: Bookmarked locations
- **reviews**: User reviews and ratings
- **chats**: Chat messages and conversations

### Usage Example
```typescript
// Export data
const jsonData = await exportUserDataAsJSON(userId)

// Download from web
const link = document.createElement('a')
link.href = URL.createObjectURL(new Blob([jsonData]))
link.download = `data_${new Date().toISOString()}.json`
link.click()

// Delete data (with confirmation)
if (userConfirmed) {
  await deleteAllUserData(userId)
}
```

---

## 4. Using Security Hooks

### `useEncryption()`
React hook for encryption operations.

```typescript
import { useEncryption } from '@/hooks/useSecurity'

export function MyComponent() {
  const { encrypt, decrypt, saveEncrypted, loadEncrypted, isEncrypting } =
    useEncryption()

  const handleSave = async (data) => {
    await saveEncrypted('my_data_key', data)
  }

  const handleLoad = async () => {
    const data = await loadEncrypted('my_data_key')
    return data
  }

  return (
    <View>
      <Button
        title={isEncrypting ? 'Saving...' : 'Save Data'}
        onPress={handleSave}
        disabled={isEncrypting}
      />
    </View>
  )
}
```

### `useBiometric()`
React hook for biometric operations.

```typescript
import { useBiometric } from '@/hooks/useSecurity'

export function BiometricSettings() {
  const {
    authenticate,
    enable,
    disable,
    checkEnabled,
    isBiometricLoading,
    biometricError,
  } = useBiometric()

  const handleToggle = async (enabled) => {
    if (enabled) {
      const success = await enable()
      if (success) {
        Alert.alert('Success', 'Biometric enabled')
      }
    } else {
      await disable()
    }
  }

  return (
    <Switch
      value={await checkEnabled()}
      onValueChange={handleToggle}
      disabled={isBiometricLoading}
    />
  )
}
```

### `useGDPR(userId)`
React hook for GDPR operations.

```typescript
import { useGDPR } from '@/hooks/useSecurity'

export function GDPRSettings({ userId }) {
  const { exportJSON, exportCSV, deleteData, getAllData, isGDPRLoading } =
    useGDPR(userId)

  const handleExport = async () => {
    const data = await exportJSON()
    // Trigger download
  }

  return (
    <View>
      <Button
        title={isGDPRLoading ? 'Exporting...' : 'Export Data'}
        onPress={handleExport}
        disabled={isGDPRLoading}
      />
    </View>
  )
}
```

---

## 5. Integration with Auth Flow

### Login with Encryption
```typescript
import { login } from '@/services/authService'

export async function handleLogin(email, password) {
  const session = await login({ email, password })

  // Session token is automatically encrypted
  // Sensitive data is encrypted and stored locally
  return session
}
```

### Profile Access with Biometric
```typescript
import { getProfile, verifySessionSecurity } from '@/services/authService'

export async function handleProfileAccess(userId) {
  // Verify session security (biometric if enabled)
  const isSecure = await verifySessionSecurity()
  if (!isSecure) {
    throw new Error('Session security verification failed')
  }

  return await getProfile(userId)
}
```

---

## 6. Security Best Practices

### For Developers

1. **Always encrypt sensitive data**
   ```typescript
   // ❌ WRONG
   await storage.setItem('password', userPassword)

   // ✅ CORRECT
   await encryptAndStore('user_password', { password: userPassword })
   ```

2. **Use biometric for sensitive operations**
   ```typescript
   // Before accessing sensitive data
   const authenticated = await requireBiometricWithTimeout(30)
   if (!authenticated) return

   // Proceed with sensitive operation
   ```

3. **Clear data on logout**
   ```typescript
   export async function logout() {
     await storage.removeItem('session_token')
     await clearEncryptionKey() // Optional: rotate keys
     // Perform Supabase logout
   }
   ```

### For Users

1. **Enable biometric authentication** for quick and secure access
2. **Regularly review** privacy settings and permissions
3. **Export and backup** your data periodically
4. **Use strong passwords** (handled by Supabase)
5. **Review GDPR rights** - you can always request data access/deletion

---

## 7. Database Schema (Required)

Ensure your Supabase database has these tables for GDPR compliance:

```sql
-- Data export requests tracking
CREATE TABLE data_export_requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  format TEXT,
  status TEXT,
  timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  action TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Troubleshooting

### Biometric Authentication Not Working
```typescript
// Check if device supports biometric
const available = await isBiometricAvailable()
const enrolled = await isBiometricEnrolled()

if (!available || !enrolled) {
  // Device doesn't support or has no biometric data enrolled
}
```

### Encryption Key Lost
```typescript
// Keys are stored securely and persist across app launches
// If lost, regenerate (note: previous encrypted data will be inaccessible)
await clearEncryptionKey()
const newKey = await getOrCreateEncryptionKey()
```

### GDPR Export Fails
```typescript
// Verify user exists in all tables
const data = await getAllUserData(userId)
// Check which categories are empty
Object.entries(data).forEach(([category, content]) => {
  console.log(`${category}: ${Object.keys(content).length} records`)
})
```

---

## 9. Compliance Checklist

- [x] End-to-end encryption for sensitive data
- [x] Biometric authentication support
- [x] GDPR data export (JSON/CSV)
- [x] Right to be forgotten (data deletion)
- [x] Secure session management
- [x] Encrypted local storage
- [x] Activity logging capability
- [x] Privacy policy integration
- [ ] Consent management (TODO: implement consent tracking)
- [ ] Audit logging (TODO: implement audit trail)

---

## Support & Questions

For security issues or questions:
- Review this documentation
- Check service implementations
- Test with provided hooks
- Contact development team for compliance questions
