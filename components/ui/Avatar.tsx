import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native'
import { Colors, Radius } from '../../constants/theme'

interface Props {
  uri?: string
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  style?: ViewStyle
}

const SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 }

export default function Avatar({ uri, name, size = 'md', style }: Props) {
  const px = SIZES[size]
  const initials = name
    ? name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <View style={[s.base, { width: px, height: px, borderRadius: px / 2 }, style]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: px, height: px, borderRadius: px / 2 }} />
      ) : (
        <Text style={[s.initials, { fontSize: px * 0.38 }]}>{initials}</Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  base: {
    backgroundColor: Colors.light.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '700',
    color: Colors.light.primary,
  },
})
