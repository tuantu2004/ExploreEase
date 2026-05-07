import { useEffect } from 'react'
import { router } from 'expo-router'

// Legacy route — real chats are at /dm/[id] (1-1) and /event/group-chat/[id] (group)
export default function LegacyChatRedirect() {
  useEffect(() => { router.replace('/chat' as any) }, [])
  return null
}
