# Security & Privacy Setup Guide

## 📋 Prerequisites

Make sure you have these dependencies installed in your `package.json`:
- `crypto-js`: ^4.2.0 (for encryption)
- `expo-local-authentication`: ~17.0.8 (for biometric authentication)
- `expo-secure-store`: ~15.0.8 (for secure storage)

## 🚀 Quick Start

### Step 1: Install Dependencies
```bash
npm install crypto-js
# or
yarn add crypto-js
```

### Step 2: Update Database Schema

Add these tables to your Supabase database:

```sql
-- Data export requests tracking
CREATE TABLE IF NOT EXISTS data_export_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  format text,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Activity logs (optional, for audit trail)
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  action text,
  metadata jsonb,
  created_at timestamp DEFAULT now()
);

-- User preferences (if not already created)
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  privacy_settings jsonb DEFAULT '{"profileVisible": true, "allowMessages": true}',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy for data_export_requests
CREATE POLICY "Users can view their own export requests"
  ON data_export_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create export requests"
  ON data_export_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy for user_preferences
CREATE POLICY "Users can view their own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### Step 3: Configure Encryption

The encryption service automatically generates and manages encryption keys. Keys are stored securely using:
- **iOS/Android**: `expo-secure-store` (Keychain/Keystore)
- **Web**: `localStorage` (encrypted)

No additional configuration needed!

### Step 4: Integrate with Auth Flow

Update your authentication logic to use security features:

```typescript
// In your auth component or store
import { loginWithBiometric } from '@/services/authService'
import { useBiometric } from '@/hooks/useSecurity'

export function LoginScreen() {
  const { authenticate: bioAuth } = useBiometric()
  
  const handleBioLogin = async () => {
    const success = await bioAuth()
    if (success) {
      // Navigate to home
    }
  }
  
  return (
    <Button 
      label="Login with Biometric"
      onPress={handleBioLogin}
    />
  )
}
```

### Step 5: Add Security Settings Page

Use the provided components in your navigation:

```typescript
import SecuritySettingsScreen from '@/components/security/SecuritySettingsScreen'
import PrivacyPreferencesScreen from '@/components/security/PrivacyPreferencesScreen'

// In your app navigation
export const securityRoutes = {
  'security/settings': SecuritySettingsScreen,
  'security/privacy': PrivacyPreferencesScreen,
}
```

## 📱 Component Usage

### Security Settings Screen
Allows users to:
- Enable/disable biometric authentication
- Export personal data (JSON/CSV)
- Delete all personal data (GDPR)
- View encryption status

```typescript
import SecuritySettingsScreen from '@/components/security/SecuritySettingsScreen'

<Stack.Screen name="security-settings" component={SecuritySettingsScreen} />
```

### Privacy Preferences Screen
Allows users to:
- Control profile visibility
- Manage message permissions
- Configure location sharing
- Set data retention policy
- Manage notification preferences

```typescript
import PrivacyPreferencesScreen from '@/components/security/PrivacyPreferencesScreen'

<Stack.Screen name="privacy-settings" component={PrivacyPreferencesScreen} />
```

## 🔐 Security Features

### 1. End-to-End Encryption

**Automatic encryption for:**
- Login credentials
- User profile data
- Session tokens
- Stored user preferences

**Usage:**
```typescript
import { encryptAndStore, retrieveAndDecrypt } from '@/services/encryptionService'

// Save encrypted data
await encryptAndStore('my_key', { secret: 'value' })

// Load encrypted data
const data = await retrieveAndDecrypt('my_key')
```

### 2. Biometric Authentication

**Supported types:**
- Fingerprint (Android/iOS)
- Face ID (iOS)
- Iris scanning (supported devices)

**Usage:**
```typescript
import { 
  enableBiometric, 
  authenticateWithBiometric 
} from '@/services/biometricService'

// Enable
const success = await enableBiometric()

// Authenticate
const authenticated = await authenticateWithBiometric('Unlock app')

// Require with timeout
const valid = await requireBiometricWithTimeout(30) // 30 minutes
```

### 3. GDPR Compliance

**User rights supported:**
- ✅ **Right of Access**: Export all personal data
- ✅ **Right to Download**: Export as JSON or CSV
- ✅ **Right to Erasure**: Delete all personal data
- ✅ **Right to Portability**: Download in standard formats

**Usage:**
```typescript
import { 
  exportUserDataAsJSON,
  deleteAllUserData,
  getGDPRComplianceStatus
} from '@/services/gdprService'

// Export data
const jsonData = await exportUserDataAsJSON(userId)

// Delete data
await deleteAllUserData(userId)

// Check status
const status = await getGDPRComplianceStatus(userId)
```

## 🪝 React Hooks

### useEncryption()
```typescript
const { 
  encrypt, 
  decrypt, 
  saveEncrypted, 
  loadEncrypted,
  isEncrypting,
  encryptionError 
} = useEncryption()
```

### useBiometric()
```typescript
const { 
  authenticate, 
  enable, 
  disable,
  checkEnabled,
  getConfig,
  isBiometricLoading,
  biometricError 
} = useBiometric()
```

### useGDPR(userId)
```typescript
const { 
  exportJSON, 
  exportCSV, 
  deleteData,
  getAllData,
  isGDPRLoading,
  gdprError 
} = useGDPR(userId)
```

## 📊 Database Tables

### user_preferences
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "privacy_settings": {
    "profileVisible": true,
    "allowMessages": true,
    "shareLocation": false,
    "allowAnalytics": true,
    "dataRetention": "1year",
    "allowThirdParty": false,
    "emailNotifications": true,
    "pushNotifications": true,
    "marketingEmails": false
  },
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### data_export_requests
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "format": "json|csv",
  "status": "pending|processing|completed|failed",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

## 🛡️ Best Practices

### For Developers

1. **Always encrypt sensitive data**
   ```typescript
   // ❌ Wrong
   await localStorage.setItem('password', pwd)
   
   // ✅ Correct
   await encryptAndStore('password', { pwd })
   ```

2. **Verify biometric before sensitive operations**
   ```typescript
   const auth = await requireBiometricWithTimeout(30)
   if (!auth) return
   
   // Proceed with sensitive operation
   ```

3. **Clear data on logout**
   ```typescript
   await logout() // Clears encrypted session data
   ```

4. **Handle encryption errors gracefully**
   ```typescript
   try {
     const data = await retrieveAndDecrypt('key')
   } catch (error) {
     // Fallback or retry logic
   }
   ```

### For Users

1. **Enable biometric authentication** for extra security
2. **Review privacy settings** regularly
3. **Export data** for backup and portability
4. **Use strong passwords** (Supabase enforces this)
5. **Understand GDPR rights** - you control your data

## 🐛 Troubleshooting

### Biometric not working
```typescript
// Check device support
const available = await isBiometricAvailable()
const enrolled = await isBiometricEnrolled()

if (!available || !enrolled) {
  // Guide user to enable biometric on device
}
```

### Encryption key issues
```typescript
// Keys persist in secure storage
// If corrupted, clear and regenerate
await clearEncryptionKey()
const newKey = await getOrCreateEncryptionKey()
// Note: Previous encrypted data becomes inaccessible
```

### GDPR export fails
```typescript
// Ensure user exists in all required tables
const data = await getAllUserData(userId)
console.log(data) // Check which categories have data
```

## 📚 Files Structure

```
services/
├── encryptionService.ts      # Encryption utilities
├── biometricService.ts       # Biometric auth
├── gdprService.ts           # GDPR compliance
└── authService.ts           # Updated with security

hooks/
├── useSecurity.ts           # Security hooks
└── useEncryption.ts         # Encryption specific

components/security/
├── SecuritySettingsScreen.tsx    # Settings UI
└── PrivacyPreferencesScreen.tsx  # Privacy UI

types/
└── security.ts              # Type definitions
```

## 📖 Documentation

See `SECURITY_PRIVACY.md` for comprehensive documentation on:
- Detailed API reference
- Integration patterns
- Code examples
- Compliance details

## ✅ Compliance Checklist

- [x] End-to-end encryption
- [x] Biometric authentication (optional)
- [x] GDPR data access
- [x] GDPR data download
- [x] GDPR data deletion
- [x] Secure session management
- [x] Encrypted local storage
- [ ] Consent management (TODO)
- [ ] Audit logging (TODO)
- [ ] Privacy policy integration (TODO)

## 🚨 Important Notes

1. **Encryption keys**: Automatically managed, stored securely
2. **Biometric**: Optional, enhances user experience
3. **GDPR**: Full compliance with export/delete functionality
4. **Data deletion**: ⚠️ **IRREVERSIBLE** - delete endpoint requires user confirmation
5. **Session security**: Can require re-authentication based on timeout

## Support

For issues or questions:
1. Check SECURITY_PRIVACY.md documentation
2. Review service implementations
3. Test with provided hooks
4. Contact development team for compliance questions
