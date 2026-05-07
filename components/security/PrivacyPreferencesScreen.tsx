import React, { useState, useEffect } from 'react'
import { View, ScrollView, Switch, Alert } from 'react-native'
import { Text } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/useAuthStore'

interface PrivacyPreferences {
  profileVisible: boolean // Profile visible in search
  allowMessages: boolean // Allow other users to message
  shareLocation: boolean // Share location data
  allowAnalytics: boolean // Allow usage analytics
  dataRetention: '30days' | '90days' | '1year' | 'indefinite'
  allowThirdParty: boolean // Share data with partners
  emailNotifications: boolean
  pushNotifications: boolean
  marketingEmails: boolean
}

const DEFAULT_PREFERENCES: PrivacyPreferences = {
  profileVisible: true,
  allowMessages: true,
  shareLocation: false,
  allowAnalytics: true,
  dataRetention: '1year',
  allowThirdParty: false,
  emailNotifications: true,
  pushNotifications: true,
  marketingEmails: false,
}

export default function PrivacyPreferencesScreen() {
  const { user } = useAuthStore()
  const [preferences, setPreferences] = useState<PrivacyPreferences>(
    DEFAULT_PREFERENCES
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [user?.id])

  const loadPreferences = async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('user_preferences')
        .select('privacy_settings')
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      if (data?.privacy_settings) {
        setPreferences(data.privacy_settings)
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const savePreferences = async () => {
    if (!user?.id) return

    try {
      setIsSaving(true)
      const { error } = await supabase
        .from('user_preferences')
        .update({
          privacy_settings: preferences,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)

      if (error) throw error

      Alert.alert('Success', 'Privacy preferences updated')
    } catch (error) {
      Alert.alert('Error', 'Failed to save preferences')
      console.error('Save error:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = (key: keyof PrivacyPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const handleDataRetention = (value: string) => {
    setPreferences((prev) => ({
      ...prev,
      dataRetention: value as PrivacyPreferences['dataRetention'],
    }))
  }

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text>Loading preferences...</Text>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-4">
        {/* Profile Privacy */}
        <Card className="mb-4 p-4">
          <Text className="text-lg font-bold mb-3">Profile Visibility</Text>

          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-semibold">Public Profile</Text>
              <Switch
                value={preferences.profileVisible}
                onValueChange={() => handleToggle('profileVisible')}
              />
            </View>
            <Text className="text-xs text-gray-600">
              Allow other users to find your profile in search results
            </Text>
          </View>

          <View className="border-t border-gray-200 pt-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-semibold">Accept Messages</Text>
              <Switch
                value={preferences.allowMessages}
                onValueChange={() => handleToggle('allowMessages')}
              />
            </View>
            <Text className="text-xs text-gray-600">
              Allow other users to send you direct messages
            </Text>
          </View>
        </Card>

        {/* Location Privacy */}
        <Card className="mb-4 p-4">
          <Text className="text-lg font-bold mb-3">Location & Activity</Text>

          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-semibold">Share Location</Text>
              <Switch
                value={preferences.shareLocation}
                onValueChange={() => handleToggle('shareLocation')}
              />
            </View>
            <Text className="text-xs text-gray-600">
              Share your location for location-based features and recommendations
            </Text>
          </View>

          <View className="bg-blue-50 p-3 rounded-lg">
            <Text className="text-xs text-blue-800">
              📍 Location data is encrypted and never shared with third parties
            </Text>
          </View>
        </Card>

        {/* Data & Analytics */}
        <Card className="mb-4 p-4">
          <Text className="text-lg font-bold mb-3">Data & Analytics</Text>

          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-semibold">Analytics</Text>
              <Switch
                value={preferences.allowAnalytics}
                onValueChange={() => handleToggle('allowAnalytics')}
              />
            </View>
            <Text className="text-xs text-gray-600">
              Help us improve by sharing anonymized usage data
            </Text>
          </View>

          <View className="border-t border-gray-200 pt-4 mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-semibold">Third-Party Sharing</Text>
              <Switch
                value={preferences.allowThirdParty}
                onValueChange={() => handleToggle('allowThirdParty')}
              />
            </View>
            <Text className="text-xs text-gray-600">
              Allow sharing with partner services (maps, analytics)
            </Text>
          </View>

          <View>
            <Text className="font-semibold mb-2">Data Retention</Text>
            <View className="gap-2">
              {[
                { label: '30 Days', value: '30days' },
                { label: '90 Days', value: '90days' },
                { label: '1 Year', value: '1year' },
                { label: 'Indefinite', value: 'indefinite' },
              ].map((option) => (
                <View
                  key={option.value}
                  className={`p-3 rounded-lg border ${
                    preferences.dataRetention === option.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <Text
                    className={`${
                      preferences.dataRetention === option.value
                        ? 'text-blue-700 font-semibold'
                        : 'text-gray-700'
                    }`}
                    onPress={() => handleDataRetention(option.value)}
                  >
                    {option.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </Card>

        {/* Notifications */}
        <Card className="mb-4 p-4">
          <Text className="text-lg font-bold mb-3">Notifications</Text>

          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-semibold">Email Notifications</Text>
              <Switch
                value={preferences.emailNotifications}
                onValueChange={() => handleToggle('emailNotifications')}
              />
            </View>
            <Text className="text-xs text-gray-600">
              Receive email about important updates
            </Text>
          </View>

          <View className="border-t border-gray-200 pt-4 mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-semibold">Push Notifications</Text>
              <Switch
                value={preferences.pushNotifications}
                onValueChange={() => handleToggle('pushNotifications')}
              />
            </View>
            <Text className="text-xs text-gray-600">
              Receive push notifications on your device
            </Text>
          </View>

          <View className="border-t border-gray-200 pt-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-semibold">Marketing Emails</Text>
              <Switch
                value={preferences.marketingEmails}
                onValueChange={() => handleToggle('marketingEmails')}
              />
            </View>
            <Text className="text-xs text-gray-600">
              Receive promotional content and special offers
            </Text>
          </View>
        </Card>

        {/* Privacy Policy Info */}
        <Card className="mb-4 p-4">
          <Text className="text-lg font-bold mb-3">Privacy Information</Text>
          <View className="gap-2">
            <Text className="text-sm">
              • Your data is protected under GDPR regulations
            </Text>
            <Text className="text-sm">
              • You can export or delete your data at any time
            </Text>
            <Text className="text-sm">
              • Sensitive data is encrypted end-to-end
            </Text>
            <Text className="text-sm">
              • We never sell your personal information
            </Text>
          </View>

          <Button
            label="View Privacy Policy"
            onPress={() => {
              // Open privacy policy URL
            }}
            className="bg-gray-200 mt-4"
          />
        </Card>

        {/* Save Button */}
        <View className="gap-2 mb-8">
          <Button
            label={isSaving ? 'Saving...' : 'Save Preferences'}
            onPress={savePreferences}
            disabled={isSaving}
            className="bg-blue-500"
          />
          <Button
            label="Reset to Default"
            onPress={() => {
              Alert.alert(
                'Reset Preferences',
                'Are you sure you want to reset to default privacy preferences?',
                [
                  { text: 'Cancel', onPress: () => {} },
                  {
                    text: 'Reset',
                    onPress: () => setPreferences(DEFAULT_PREFERENCES),
                    style: 'destructive',
                  },
                ]
              )
            }}
            className="bg-gray-300"
          />
        </View>
      </View>
    </ScrollView>
  )
}
