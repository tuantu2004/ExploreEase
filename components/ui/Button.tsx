import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native'

interface Props extends TouchableOpacityProps {
  title: string
  loading?: boolean
  variant?: 'primary' | 'outline' | 'danger'
}

export default function Button({
  title,
  loading,
  variant = 'primary',
  disabled,
  ...props
}: Props) {
  const base = 'rounded-xl py-4 items-center justify-center'
  const variants = {
    primary: 'bg-primary',
    outline: 'border-2 border-primary bg-white',
    danger: 'bg-red-500',
  }
  const textVariants = {
    primary: 'text-white font-semibold text-base',
    outline: 'text-primary font-semibold text-base',
    danger: 'text-white font-semibold text-base',
  }

  return (
    <TouchableOpacity
      className={`${base} ${variants[variant]} ${
        disabled || loading ? 'opacity-50' : ''
      }`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? '#10B981' : '#fff'} />
      ) : (
        <Text className={textVariants[variant]}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}