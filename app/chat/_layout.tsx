import { Tabs } from 'expo-router'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10B981',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Khám phá' }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Bản đồ' }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Sự kiện' }}
      />
      <Tabs.Screen
        name="plan"
        options={{ title: 'Kế hoạch' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Hồ sơ' }}
      />
    </Tabs>
  )
}