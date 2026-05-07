import { View, Text, TextInput, TextInputProps } from 'react-native'

interface Props extends TextInputProps {
  label: string
  error?: string
}

export default function Input({ label, error, ...props }: Props) {
  return (
    <View className="mb-4">
      <Text className="text-gray-700 font-medium mb-1 text-sm">
        {label}
      </Text>
      <TextInput
        className={`border rounded-xl px-4 py-3 text-base bg-white ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
      {error && (
        <Text className="text-red-500 text-xs mt-1">{error}</Text>
      )}
    </View>
  )
}