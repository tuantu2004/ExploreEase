import { Platform } from 'react-native'

let AppMap: React.ComponentType<any>

if (Platform.OS === 'web') {
  AppMap = require('./AppMap.web').default
} else {
  AppMap = require('./AppMap.native').default
}

export default AppMap