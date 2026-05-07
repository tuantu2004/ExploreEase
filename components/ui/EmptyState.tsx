import { View, Text, StyleSheet } from 'react-native'
import { Colors, Spacing, Typography } from '../../constants/theme'
import Button from './Button'

interface Props {
  icon?: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ icon = '🔍', title, description, actionLabel, onAction }: Props) {
  return (
    <View style={s.container}>
      <Text style={s.icon}>{icon}</Text>
      <Text style={s.title}>{title}</Text>
      {description && <Text style={s.desc}>{description}</Text>}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} style={s.btn} />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['3xl'],
  },
  icon: { fontSize: 56, marginBottom: Spacing.base },
  title: {
    ...Typography.titleLarge,
    color: Colors.light.onBackground,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  desc: {
    ...Typography.bodyMedium,
    color: Colors.light.onSurfaceVariant,
    textAlign: 'center',
  },
  btn: { marginTop: Spacing.xl, minWidth: 160 },
})
