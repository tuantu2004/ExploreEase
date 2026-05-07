import { supabase } from './supabase'

export interface Review {
  id: string
  user_id: string
  target_id: string
  target_type: 'place' | 'event'
  rating: number
  content: string
  images: string[]
  helpful_count: number
  is_flagged: boolean
  created_at: string
  reply_content?: string | null
  reply_by?: string | null
  replied_at?: string | null
  profiles?: {
    name: string
    avatar_url: string
  }
}

// Lấy reviews theo target
export async function getReviews(params: {
  targetId: string
  targetType: 'place' | 'event'
  sort?: 'newest' | 'top_rated' | 'most_helpful'
  limit?: number
  offset?: number
}) {
  let query = supabase
    .from('reviews')
    .select('*, profiles(name, avatar_url)')
    .eq('target_id', params.targetId)
    .eq('target_type', params.targetType)
    .eq('is_flagged', false)

  if (params.sort === 'newest') {
    query = query.order('created_at', { ascending: false })
  } else if (params.sort === 'top_rated') {
    query = query.order('rating', { ascending: false })
  } else if (params.sort === 'most_helpful') {
    query = query.order('helpful_count', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const limit = params.limit ?? 10
  const offset = params.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, error } = await query
  if (error) throw error
  return data as Review[]
}

// Tạo review mới
export async function createReview(review: {
  targetId: string
  targetType: 'place' | 'event'
  rating: number
  content: string
  userId: string
  images?: string[]
}) {
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      target_id: review.targetId,
      target_type: review.targetType,
      rating: review.rating,
      content: review.content,
      user_id: review.userId,
      images: review.images ?? [],
    })
    .select()
    .single()
  if (error) throw error

  // Cập nhật rating trung bình
  await updateTargetRating(review.targetId, review.targetType)

  return data as Review
}

// Đánh dấu helpful
export async function markHelpful(reviewId: string) {
  const { data: review } = await supabase
    .from('reviews')
    .select('helpful_count')
    .eq('id', reviewId)
    .single()

  const { error } = await supabase
    .from('reviews')
    .update({ helpful_count: (review?.helpful_count ?? 0) + 1 })
    .eq('id', reviewId)

  if (error) throw error
}

// Phản hồi review (bởi chủ sở hữu / admin)
export async function addReply(reviewId: string, content: string, userId: string) {
  const { error } = await supabase
    .from('reviews')
    .update({
      reply_content: content,
      reply_by: userId,
      replied_at: new Date().toISOString(),
    })
    .eq('id', reviewId)
  if (error) throw error
}

// Báo cáo review (dùng RPC để bypass RLS)
export async function flagReview(reviewId: string) {
  const { error } = await supabase.rpc('flag_review', { p_review_id: reviewId })
  if (error) throw error
}

// Lấy phân phối rating theo sao
export async function getRatingDistribution(
  targetId: string,
  targetType: 'place' | 'event'
): Promise<Record<number, number>> {
  const { data } = await supabase
    .from('reviews')
    .select('rating')
    .eq('target_id', targetId)
    .eq('target_type', targetType)
    .eq('is_flagged', false)

  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  if (!data) return dist

  data.forEach(r => {
    const star = Math.round(r.rating)
    if (star >= 1 && star <= 5) dist[star]++
  })

  return dist
}

// Cập nhật rating trung bình của place/event
async function updateTargetRating(
  targetId: string,
  targetType: 'place' | 'event'
) {
  const { data } = await supabase
    .from('reviews')
    .select('rating')
    .eq('target_id', targetId)
    .eq('target_type', targetType)
    .eq('is_flagged', false)

  if (!data || data.length === 0) return

  const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length
  const rounded = Math.round(avg * 10) / 10
  const table = targetType === 'place' ? 'places' : 'events'

  await supabase
    .from(table)
    .update({ rating: rounded, rating_count: data.length })
    .eq('id', targetId)
}