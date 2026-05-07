import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native'
import { useState, useEffect } from 'react'
import * as ImagePicker from 'expo-image-picker'
import {
  getReviews, createReview, markHelpful,
  flagReview, addReply, Review,
} from '../../services/reviewService'
import { useAuthStore } from '../../stores/useAuthStore'
import { supabase } from '../../services/supabase'

interface Props {
  targetId: string
  targetType: 'place' | 'event'
  ownerId?: string
}

const SORTS = [
  { id: 'newest', label: 'Mới nhất' },
  { id: 'top_rated', label: 'Đánh giá cao' },
  { id: 'most_helpful', label: 'Hữu ích nhất' },
]

export default function ReviewSection({ targetId, targetType, ownerId }: Props) {
  const user = useAuthStore((s) => s.user)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [sort, setSort] = useState<'newest' | 'top_rated' | 'most_helpful'>('newest')
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string; base64: string; mimeType: string }>>([])
  const [pickingImage, setPickingImage] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const LIMIT = 5

  const canReply = !!(user && ((user as any).role === 'admin' || user.id === ownerId))

  const loadReviews = async (reset = false) => {
    const currentPage = reset ? 0 : page
    if (reset) {
      setLoading(true)
      setPage(0)
    } else {
      setLoadingMore(true)
    }
    try {
      const data = await getReviews({
        targetId, targetType, sort,
        limit: LIMIT, offset: currentPage * LIMIT,
      })
      if (reset) {
        setReviews(data)
      } else {
        setReviews(prev => [...prev, ...data])
      }
      setHasMore(data.length === LIMIT)
      if (!reset) setPage(p => p + 1)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    loadReviews(true)
  }, [targetId, sort])

  const handlePickImage = async () => {
    if (selectedImages.length >= 3) {
      Alert.alert('Tối đa 3 ảnh', 'Bạn chỉ có thể upload tối đa 3 ảnh')
      return
    }
    try {
      setPickingImage(true)
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép truy cập thư viện ảnh')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
        base64: true,
      })
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        setSelectedImages(prev => [...prev, {
          uri: asset.uri,
          base64: asset.base64 ?? '',
          mimeType: asset.mimeType ?? 'image/jpeg',
        }])
      }
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setPickingImage(false)
    }
  }

  const uploadReviewImages = async (userId: string): Promise<string[]> => {
    const uploadedUrls: string[] = []
    for (let i = 0; i < selectedImages.length; i++) {
      const img = selectedImages[i]
      try {
        const fileExt = img.mimeType?.split('/')[1] ?? 'jpg'
        const fileName = `reviews/${userId}/${Date.now()}_${i}.${fileExt}`
        const byteCharacters = atob(img.base64)
        const byteArray = new Uint8Array(byteCharacters.length)
        for (let j = 0; j < byteCharacters.length; j++) {
          byteArray[j] = byteCharacters.charCodeAt(j)
        }
        const { error: uploadError } = await supabase.storage
          .from('reviews')
          .upload(fileName, byteArray, { contentType: img.mimeType ?? 'image/jpeg' })
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('reviews').getPublicUrl(fileName)
        uploadedUrls.push(`${data.publicUrl}?t=${Date.now()}`)
      } catch (e) {
        console.error('Error uploading image:', e)
      }
    }
    return uploadedUrls
  }

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Cần đăng nhập', 'Vui lòng đăng nhập để viết đánh giá')
      return
    }
    if (!content.trim()) {
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập nội dung đánh giá')
      return
    }
    setSubmitting(true)
    try {
      const imageUrls = await uploadReviewImages(user.id)
      await createReview({
        targetId, targetType, rating,
        content: content.trim(),
        userId: user.id,
        images: imageUrls,
      })
      setContent('')
      setRating(5)
      setSelectedImages([])
      setShowForm(false)
      Alert.alert('Thành công! ✅', 'Cảm ơn bạn đã đánh giá!')
      loadReviews(true)
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleHelpful = async (reviewId: string) => {
    await markHelpful(reviewId)
    setReviews(rs => rs.map(r =>
      r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r
    ))
  }

  const handleFlag = async (reviewId: string) => {
    // Web: window.confirm, Native: Alert.alert
    if (typeof window !== 'undefined' && typeof (window as any).confirm === 'function') {
      const ok = (window as any).confirm('Báo cáo đánh giá này là không phù hợp?')
      if (!ok) return
      try {
        await flagReview(reviewId)
        setReviews(rs => rs.filter(r => r.id !== reviewId))
        Alert.alert('Đã báo cáo ✅', 'Cảm ơn bạn đã phản hồi!')
      } catch (e: any) {
        Alert.alert('Lỗi', e.message)
      }
      return
    }
    Alert.alert(
      'Báo cáo đánh giá',
      'Bạn có chắc muốn báo cáo đánh giá này không phù hợp?',
      [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Báo cáo',
          style: 'destructive',
          onPress: async () => {
            try {
              await flagReview(reviewId)
              setReviews(rs => rs.filter(r => r.id !== reviewId))
              Alert.alert('Đã báo cáo ✅', 'Cảm ơn bạn đã phản hồi!')
            } catch (e: any) {
              Alert.alert('Lỗi', e.message)
            }
          },
        },
      ]
    )
  }

  const handleReply = async (reviewId: string) => {
    if (!replyContent.trim() || !user) return
    setReplySubmitting(true)
    try {
      await addReply(reviewId, replyContent.trim(), user.id)
      setReviews(rs => rs.map(r =>
        r.id === reviewId
          ? { ...r, reply_content: replyContent.trim(), reply_by: user.id, replied_at: new Date().toISOString() }
          : r
      ))
      setReplyingTo(null)
      setReplyContent('')
    } catch (e: any) {
      Alert.alert('Lỗi', e.message)
    } finally {
      setReplySubmitting(false)
    }
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return 'Vừa xong'
    if (mins < 60) return `${mins} phút trước`
    if (hours < 24) return `${hours} giờ trước`
    return `${days} ngày trước`
  }

  const renderReview = (item: Review) => (
    <View key={item.id} style={s.reviewCard}>
      {/* Header */}
      <View style={s.reviewHeader}>
        <View style={s.reviewAvatar}>
          <Text style={s.reviewAvatarText}>
            {item.profiles?.name?.[0]?.toUpperCase() ?? 'U'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.reviewerName}>{item.profiles?.name ?? 'Người dùng'}</Text>
          <Text style={s.reviewDate}>
            {new Date(item.created_at).toLocaleDateString('vi-VN', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleFlag(item.id)}>
          <Text style={s.flagBtn}>⚑</Text>
        </TouchableOpacity>
      </View>

      {/* Stars */}
      <View style={s.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Text key={star} style={[s.star, star <= item.rating && s.starActive]}>★</Text>
        ))}
        <Text style={s.ratingNum}>{item.rating}/5</Text>
      </View>

      {/* Content */}
      <Text style={s.reviewContent}>{item.content}</Text>

      {/* Review Images */}
      {item.images && item.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.reviewImagesScroll}>
          {item.images.map((img, idx) => (
            <Image key={idx} source={{ uri: img }} style={s.reviewThumbImg} />
          ))}
        </ScrollView>
      )}

      {/* Footer: Helpful */}
      <View style={s.reviewFooter}>
        <TouchableOpacity style={s.helpfulBtn} onPress={() => handleHelpful(item.id)}>
          <Text style={s.helpfulIcon}>👍</Text>
          <Text style={s.helpfulText}>Hữu ích ({item.helpful_count})</Text>
        </TouchableOpacity>

        {/* Reply button (owner/admin only, if no reply yet) */}
        {canReply && !item.reply_content && (
          <TouchableOpacity
            style={s.replyBtn}
            onPress={() => {
              setReplyingTo(replyingTo === item.id ? null : item.id)
              setReplyContent('')
            }}
          >
            <Text style={s.replyBtnText}>↩ Phản hồi</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Existing Reply */}
      {item.reply_content && (
        <View style={s.replyBox}>
          <View style={s.replyBoxHeader}>
            <Text style={s.replyBoxIcon}>↩</Text>
            <Text style={s.replyBoxLabel}>Phản hồi từ ban tổ chức</Text>
            {item.replied_at && (
              <Text style={s.replyBoxTime}> · {timeAgo(item.replied_at)}</Text>
            )}
          </View>
          <Text style={s.replyBoxText}>{item.reply_content}</Text>
        </View>
      )}

      {/* Inline Reply Form */}
      {replyingTo === item.id && (
        <View style={s.replyForm}>
          <TextInput
            style={s.replyInput}
            placeholder="Viết phản hồi của bạn..."
            placeholderTextColor="#94A3B8"
            value={replyContent}
            onChangeText={setReplyContent}
            multiline
            numberOfLines={3}
          />
          <View style={s.replyFormActions}>
            <TouchableOpacity
              style={s.replyCancelBtn}
              onPress={() => { setReplyingTo(null); setReplyContent('') }}
            >
              <Text style={s.replyCancelText}>Huỷ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.replySubmitBtn, (!replyContent.trim() || replySubmitting) && s.replySubmitBtnDisabled]}
              onPress={() => handleReply(item.id)}
              disabled={!replyContent.trim() || replySubmitting}
            >
              {replySubmitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.replySubmitText}>Gửi phản hồi</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>💬 Đánh giá ({reviews.length})</Text>
        <TouchableOpacity style={s.writeBtn} onPress={() => setShowForm(!showForm)}>
          <Text style={s.writeBtnText}>{showForm ? '✕ Đóng' : '✏️ Viết'}</Text>
        </TouchableOpacity>
      </View>

      {/* Write Review Form */}
      {showForm && (
        <View style={s.form}>
          <Text style={s.formTitle}>Đánh giá của bạn</Text>
          <View style={s.starSelector}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Text style={[s.starSelect, star <= rating && s.starSelectActive]}>★</Text>
              </TouchableOpacity>
            ))}
            <Text style={s.ratingLabel}>
              {['', 'Tệ', 'Không tốt', 'Bình thường', 'Tốt', 'Tuyệt vời'][rating]}
            </Text>
          </View>
          <TextInput
            style={s.contentInput}
            placeholder="Chia sẻ trải nghiệm của bạn..."
            placeholderTextColor="#94A3B8"
            multiline numberOfLines={4}
            value={content}
            onChangeText={setContent}
            maxLength={500}
          />
          <Text style={s.charCount}>{content.length}/500</Text>
          {selectedImages.length > 0 && (
            <View style={s.imagesContainer}>
              {selectedImages.map((img, idx) => (
                <View key={idx} style={s.imageWrapper}>
                  <Image source={{ uri: img.uri }} style={s.reviewImage} />
                  <TouchableOpacity
                    style={s.removeImageBtn}
                    onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))}
                  >
                    <Text>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {selectedImages.length < 3 && (
            <TouchableOpacity style={s.addImageBtn} onPress={handlePickImage} disabled={pickingImage}>
              {pickingImage
                ? <ActivityIndicator color="#2563EB" size="small" />
                : <Text style={s.addImageBtnText}>📷 Thêm ảnh ({selectedImages.length}/3)</Text>
              }
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.submitBtn, submitting && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.submitBtnText}>Gửi đánh giá ✅</Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Sort Tabs */}
      <View style={s.sortRow}>
        {SORTS.map((s2) => (
          <TouchableOpacity
            key={s2.id}
            style={[s.sortTab, sort === s2.id && s.sortTabActive]}
            onPress={() => setSort(s2.id as any)}
          >
            <Text style={[s.sortTabText, sort === s2.id && s.sortTabTextActive]}>{s2.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reviews List */}
      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color="#2563EB" />
          <Text style={s.loadingText}>Đang tải đánh giá...</Text>
        </View>
      ) : reviews.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>💬</Text>
          <Text style={s.emptyTitle}>Chưa có đánh giá</Text>
          <Text style={s.emptyDesc}>Hãy là người đầu tiên đánh giá!</Text>
        </View>
      ) : (
        <>
          {reviews.map(r => renderReview(r))}
          {hasMore && (
            <TouchableOpacity
              style={s.loadMoreBtn}
              onPress={() => loadReviews(false)}
              disabled={loadingMore}
            >
              {loadingMore
                ? <ActivityIndicator color="#2563EB" size="small" />
                : <Text style={s.loadMoreText}>Xem thêm đánh giá →</Text>
              }
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { marginBottom: 16 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  writeBtn: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 12,
    paddingVertical: 6, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#2563EB',
  },
  writeBtnText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },

  // Form
  form: {
    backgroundColor: '#F8FAFC', borderRadius: 16,
    padding: 16, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#E2E8F0',
  },
  formTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  starSelector: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  starSelect: { fontSize: 32, color: '#E2E8F0' },
  starSelectActive: { color: '#F59E0B' },
  ratingLabel: { fontSize: 13, color: '#F59E0B', fontWeight: '700', marginLeft: 4 },
  contentInput: {
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E2E8F0',
    padding: 12, fontSize: 14, color: '#0F172A',
    height: 100, textAlignVertical: 'top', marginBottom: 4,
  },
  charCount: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginBottom: 12 },
  submitBtn: {
    backgroundColor: '#2563EB', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Sort
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  sortTab: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  sortTabActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  sortTabText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  sortTabTextActive: { color: '#fff' },

  // Review Card
  reviewCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 6, elevation: 2,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#2563EB',
    justifyContent: 'center', alignItems: 'center',
  },
  reviewAvatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  reviewerName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  reviewDate: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  flagBtn: { color: '#CBD5E1', fontSize: 18 },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
  star: { fontSize: 16, color: '#E2E8F0' },
  starActive: { color: '#F59E0B' },
  ratingNum: { fontSize: 12, color: '#F59E0B', fontWeight: '700', marginLeft: 4 },
  reviewContent: { fontSize: 14, color: '#374151', lineHeight: 20, marginBottom: 10 },

  // Review images
  reviewImagesScroll: { marginBottom: 10 },
  reviewThumbImg: {
    width: 90, height: 90, borderRadius: 10,
    marginRight: 8,
  },

  // Footer
  reviewFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  helpfulBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F8FAFC', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  helpfulIcon: { fontSize: 14 },
  helpfulText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  replyBtn: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 8,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  replyBtnText: { fontSize: 12, color: '#2563EB', fontWeight: '600' },

  // Reply display
  replyBox: {
    backgroundColor: '#F8FAFC', borderRadius: 12,
    padding: 12, marginTop: 8,
    borderLeftWidth: 3, borderLeftColor: '#2563EB',
  },
  replyBoxHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  replyBoxIcon: { fontSize: 14, color: '#2563EB', marginRight: 4 },
  replyBoxLabel: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  replyBoxTime: { fontSize: 11, color: '#94A3B8' },
  replyBoxText: { fontSize: 13, color: '#374151', lineHeight: 18 },

  // Reply form
  replyForm: {
    backgroundColor: '#F8FAFC', borderRadius: 12,
    padding: 12, marginTop: 10,
    borderWidth: 1.5, borderColor: '#BFDBFE',
  },
  replyInput: {
    backgroundColor: '#fff', borderRadius: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
    padding: 10, fontSize: 13, color: '#0F172A',
    minHeight: 60, textAlignVertical: 'top',
  },
  replyFormActions: {
    flexDirection: 'row', justifyContent: 'flex-end',
    gap: 8, marginTop: 8,
  },
  replyCancelBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  replyCancelText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  replySubmitBtn: {
    backgroundColor: '#2563EB', paddingHorizontal: 14,
    paddingVertical: 7, borderRadius: 8,
  },
  replySubmitBtnDisabled: { backgroundColor: '#93C5FD' },
  replySubmitText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Loading / Empty
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20 },
  loadingText: { color: '#64748B', fontSize: 13 },
  emptyBox: { alignItems: 'center', padding: 24, gap: 6 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 13, color: '#64748B' },
  loadMoreBtn: {
    backgroundColor: '#EFF6FF', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#BFDBFE', marginTop: 4,
  },
  loadMoreText: { color: '#2563EB', fontSize: 13, fontWeight: '700' },

  // Form images
  imagesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  imageWrapper: { position: 'relative', width: 80, height: 80 },
  reviewImage: { width: 80, height: 80, borderRadius: 8 },
  removeImageBtn: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#fff', borderRadius: 12,
    width: 24, height: 24,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  addImageBtn: {
    backgroundColor: '#F0FDF4', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#BBDB3D',
    marginBottom: 12, flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  addImageBtnText: { color: '#16A34A', fontSize: 13, fontWeight: '600' },
})
