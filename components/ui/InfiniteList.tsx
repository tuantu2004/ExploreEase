import {
  FlatList, ActivityIndicator, View,
  Text, StyleSheet, RefreshControl,
} from 'react-native'
import { useEffect } from 'react'

interface Props<T> {
  data: T[]
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactElement
  keyExtractor: (item: T) => string
  onLoadMore: () => void
  onRefresh: () => void
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error?: string | null
  emptyIcon?: string
  emptyTitle?: string
  emptyDesc?: string
  contentContainerStyle?: object
}

export default function InfiniteList<T>({
  data, renderItem, keyExtractor,
  onLoadMore, onRefresh,
  loading, loadingMore, hasMore,
  error, emptyIcon = '🔍',
  emptyTitle = 'Không có dữ liệu',
  emptyDesc = 'Thử lại sau',
  contentContainerStyle,
}: Props<T>) {

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={s.loadingText}>Đang tải...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorIcon}>⚠️</Text>
        <Text style={s.errorTitle}>Có lỗi xảy ra</Text>
        <Text style={s.errorDesc}>{error}</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.3}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          colors={['#2563EB']}
          tintColor="#2563EB"
        />
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={s.footer}>
            <ActivityIndicator color="#2563EB" size="small" />
            <Text style={s.footerText}>Đang tải thêm...</Text>
          </View>
        ) : !hasMore && data.length > 0 ? (
          <View style={s.footer}>
            <Text style={s.endText}>— Đã hiển thị tất cả —</Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyIcon}>{emptyIcon}</Text>
          <Text style={s.emptyTitle}>{emptyTitle}</Text>
          <Text style={s.emptyDesc}>{emptyDesc}</Text>
        </View>
      }
      contentContainerStyle={[
        data.length === 0 && s.emptyContainer,
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
    />
  )
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 40 },
  loadingText: { color: '#64748B', fontSize: 14 },
  errorIcon: { fontSize: 40 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  errorDesc: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
  footerText: { color: '#64748B', fontSize: 13 },
  endText: { color: '#CBD5E1', fontSize: 12, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingTop: 60 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  emptyDesc: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  emptyContainer: { flexGrow: 1 },
})