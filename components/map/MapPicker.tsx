import { Platform } from 'react-native'
import type { ComponentType } from 'react'

let MapPicker: ComponentType<any>
if (Platform.OS === 'web') {
  MapPicker = require('./MapPicker.web').default
} else {
  MapPicker = require('./MapPicker.native').default
}

export default MapPicker
