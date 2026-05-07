import { supabase } from './supabase'
import { storage } from './storage'
import { GDPRData, DataExportRequest } from '../types/security'

/**
 * GDPR Compliance Service
 * Handles user data export, viewing, and deletion according to GDPR regulations
 */

/**
 * Export all user personal data in JSON format
 */
export async function exportUserDataAsJSON(userId: string): Promise<string> {
  try {
    const data = await getAllUserData(userId)

    const exportData = {
      exportDate: new Date().toISOString(),
      userId,
      data,
    }

    return JSON.stringify(exportData, null, 2)
  } catch (error) {
    console.error('Failed to export user data as JSON:', error)
    throw new Error('Data export failed')
  }
}

/**
 * Export all user personal data in CSV format
 */
export async function exportUserDataAsCSV(userId: string): Promise<string> {
  try {
    const data = await getAllUserData(userId)

    let csv = 'Data Category,Content\n'

    // Helper function to flatten nested objects
    const flattenObject = (obj: Record<string, any>, prefix = '') => {
      let result = ''
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key
        if (typeof value === 'object' && value !== null) {
          result += flattenObject(value, fullKey)
        } else {
          const escapedValue = String(value).replace(/"/g, '""')
          result += `${fullKey},"${escapedValue}"\n`
        }
      }
      return result
    }

    csv += flattenObject(data)

    return csv
  } catch (error) {
    console.error('Failed to export user data as CSV:', error)
    throw new Error('Data export failed')
  }
}

/**
 * Get all user personal data (for viewing/download)
 */
export async function getAllUserData(userId: string): Promise<GDPRData> {
  try {
    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // Get user preferences
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)

    // Get saved places
    const { data: savedPlaces } = await supabase
      .from('saved_places')
      .select('*')
      .eq('user_id', userId)

    // Get reviews
    const { data: reviews } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId)

    // Get chat messages
    const { data: chats } = await supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)

    // Get user activity logs (if exists)
    const { data: activity } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)

    return {
      personalInfo: profile || {},
      userActivity: activity || {},
      preferences: preferences || {},
      savedPlaces: savedPlaces || {},
      reviews: reviews || {},
      chats: chats || {},
    }
  } catch (error) {
    console.error('Failed to get user data:', error)
    throw new Error('Failed to retrieve user data')
  }
}

/**
 * Get specific user data category
 */
export async function getUserDataByCategory(
  userId: string,
  category: keyof GDPRData
): Promise<any> {
  try {
    const data = await getAllUserData(userId)
    return data[category]
  } catch (error) {
    console.error(`Failed to get ${category} data:`, error)
    throw error
  }
}

/**
 * Delete all user personal data (GDPR right to be forgotten)
 * WARNING: This is irreversible
 */
export async function deleteAllUserData(userId: string): Promise<void> {
  try {
    // Delete user's saved places
    await supabase.from('saved_places').delete().eq('user_id', userId)

    // Delete user's reviews
    await supabase.from('reviews').delete().eq('user_id', userId)

    // Delete user's messages/chats
    await supabase.from('messages').delete().eq('user_id', userId)

    // Delete user preferences
    await supabase.from('user_preferences').delete().eq('user_id', userId)

    // Delete activity logs
    await supabase.from('activity_logs').delete().eq('user_id', userId)

    // Delete user profile
    await supabase.from('profiles').delete().eq('id', userId)

    // Delete auth user
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error

    // Clear local storage
    await storage.removeItem('user_session')
    await storage.removeItem('user_data')

    console.log('User data deletion completed')
  } catch (error) {
    console.error('Failed to delete user data:', error)
    throw new Error('Data deletion failed')
  }
}

/**
 * Delete specific user data category
 */
export async function deleteUserDataByCategory(
  userId: string,
  category: keyof Omit<GDPRData, 'personalInfo'>
): Promise<void> {
  try {
    const tableMap: Record<string, string> = {
      userActivity: 'activity_logs',
      preferences: 'user_preferences',
      savedPlaces: 'saved_places',
      reviews: 'reviews',
      chats: 'messages',
    }

    const table = tableMap[category]
    if (!table) {
      throw new Error(`Unknown data category: ${category}`)
    }

    await supabase.from(table).delete().eq('user_id', userId)

    console.log(`${category} data deleted for user ${userId}`)
  } catch (error) {
    console.error(`Failed to delete ${category}:`, error)
    throw error
  }
}

/**
 * Request data export (for async processing)
 */
export async function requestDataExport(
  userId: string,
  format: 'json' | 'csv' = 'json'
): Promise<DataExportRequest> {
  try {
    const exportRequest: DataExportRequest = {
      userId,
      format,
      timestamp: new Date(),
      status: 'pending',
    }

    // Store request in database for tracking
    const { error } = await supabase
      .from('data_export_requests')
      .insert([exportRequest])

    if (error) throw error

    return exportRequest
  } catch (error) {
    console.error('Failed to request data export:', error)
    throw new Error('Export request failed')
  }
}

/**
 * Get data export request status
 */
export async function getExportRequestStatus(
  requestId: string
): Promise<DataExportRequest | null> {
  try {
    const { data, error } = await supabase
      .from('data_export_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Failed to get export status:', error)
    return null
  }
}

/**
 * Download user data file
 */
export async function downloadUserData(
  userId: string,
  format: 'json' | 'csv' = 'json'
): Promise<{
  data: string
  filename: string
  mimeType: string
}> {
  try {
    let data: string
    let mimeType: string

    if (format === 'json') {
      data = await exportUserDataAsJSON(userId)
      mimeType = 'application/json'
    } else {
      data = await exportUserDataAsCSV(userId)
      mimeType = 'text/csv'
    }

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `exploreease_data_${timestamp}.${format}`

    return {
      data,
      filename,
      mimeType,
    }
  } catch (error) {
    console.error('Failed to download user data:', error)
    throw new Error('Download failed')
  }
}

/**
 * Get GDPR compliance status
 */
export async function getGDPRComplianceStatus(userId: string): Promise<{
  dataAvailable: boolean
  canExport: boolean
  canDelete: boolean
  lastExportDate?: Date
}> {
  try {
    const data = await getAllUserData(userId)
    const dataAvailable = Object.values(data).some(
      (category) => Object.keys(category).length > 0
    )

    return {
      dataAvailable,
      canExport: true,
      canDelete: true,
      lastExportDate: undefined,
    }
  } catch (error) {
    console.error('Failed to get GDPR status:', error)
    return {
      dataAvailable: false,
      canExport: false,
      canDelete: false,
    }
  }
}
