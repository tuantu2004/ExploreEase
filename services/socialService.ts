import { supabase } from './supabase'

export interface ActivityItem {
  id: string
  user_id: string
  type: 'review' | 'event_join' | 'follow' | 'plan_share' | 'place_visit'
  target_id?: string
  target_type?: string
  target_name?: string
  extra?: Record<string, any>
  created_at: string
  profiles?: { name: string; avatar_url?: string }
}

export async function followUser(followerId: string, followingId: string) {
  const { error } = await supabase.from('follows').insert({
    follower_id: followerId,
    following_id: followingId,
  })
  if (error) throw error
  await logActivity(followerId, 'follow', followingId, 'user', '')
}

export async function unfollowUser(followerId: string, followingId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) throw error
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  return !!data
}

export async function getFollowCounts(userId: string) {
  const [{ count: followers }, { count: following }] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followers ?? 0, following: following ?? 0 }
}

export async function getFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
  return (data ?? []).map(r => r.following_id)
}

export async function getActivityFeed(userId: string, limit = 20): Promise<ActivityItem[]> {
  const followingIds = await getFollowingIds(userId)
  if (followingIds.length === 0) return []

  const { data, error } = await supabase
    .from('activity_feed')
    .select('*, profiles(name, avatar_url)')
    .in('user_id', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as ActivityItem[]
}

export async function getUserActivity(userId: string, limit = 10): Promise<ActivityItem[]> {
  const { data } = await supabase
    .from('activity_feed')
    .select('*, profiles(name, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as ActivityItem[]
}

export async function getSuggestedUsers(currentUserId: string, limit = 8) {
  const followingIds = await getFollowingIds(currentUserId).catch(() => [])
  const excludeIds = [...followingIds, currentUserId]

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, travel_style')
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function logActivity(
  userId: string,
  type: ActivityItem['type'],
  targetId: string,
  targetType: string,
  targetName: string,
  extra?: Record<string, any>
) {
  await supabase.from('activity_feed').insert({
    user_id: userId,
    type,
    target_id: targetId,
    target_type: targetType,
    target_name: targetName,
    extra: extra ?? {},
  })
}

export function getQRUrl(type: 'place' | 'event' | 'user', id: string): string {
  const deep = `exploreease://${type}/${id}`
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deep)}&color=1e3a8a&bgcolor=eff6ff`
}

export function activityLabel(item: ActivityItem): string {
  const name = item.profiles?.name ?? 'Ai đó'
  switch (item.type) {
    case 'review':
      return `${name} vừa đánh giá ${item.target_name}`
    case 'event_join':
      return `${name} vừa tham gia sự kiện: ${item.target_name}`
    case 'follow':
      return `${name} đã bắt đầu theo dõi ai đó`
    case 'plan_share':
      return `${name} đã chia sẻ kế hoạch: ${item.target_name}`
    case 'place_visit':
      return `${name} vừa ghé thăm ${item.target_name}`
    default:
      return `${name} có hoạt động mới`
  }
}

export function activityIcon(type: ActivityItem['type']): string {
  switch (type) {
    case 'review': return '⭐'
    case 'event_join': return '🎪'
    case 'follow': return '👤'
    case 'plan_share': return '🗺️'
    case 'place_visit': return '📍'
    default: return '📢'
  }
}
