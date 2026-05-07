import { useState, useRef } from 'react'
import { Platform, Alert } from 'react-native'
import { transcribeAudioUri, transcribeBlob } from '../services/voiceService'

export function useVoiceSearch(onTranscribed: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)

  const nativeRecRef = useRef<any>(null)
  const webMrRef = useRef<MediaRecorder | null>(null)
  const webChunks = useRef<Blob[]>([])

  /* ─── Web ──────────────────────────────────────────────── */

  const startWeb = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      webChunks.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) webChunks.current.push(e.data) }
      mr.start()
      webMrRef.current = mr
      setIsRecording(true)
    } catch {
      Alert.alert('Lỗi', 'Không thể truy cập microphone. Hãy cho phép quyền truy cập.')
    }
  }

  const stopWeb = async () => {
    const mr = webMrRef.current
    if (!mr) return
    setIsRecording(false)
    setIsTranscribing(true)
    try {
      const text = await new Promise<string>((resolve) => {
        mr.onstop = async () => {
          try {
            const blob = new Blob(webChunks.current, { type: 'audio/webm' })
            mr.stream.getTracks().forEach(t => t.stop())
            resolve(await transcribeBlob(blob))
          } catch { resolve('') }
        }
        mr.stop()
      })
      if (text) onTranscribed(text)
    } catch (e) {
      console.error('Web voice error:', e)
    } finally {
      setIsTranscribing(false)
    }
  }

  /* ─── Native ───────────────────────────────────────────── */

  const startNative = async () => {
    try {
      const { Audio } = require('expo-av')
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Lỗi', 'Chưa cấp quyền microphone')
        return
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      nativeRecRef.current = recording
      setIsRecording(true)
    } catch {
      Alert.alert('Thiếu thư viện', 'Chạy: npx expo install expo-av')
    }
  }

  const stopNative = async () => {
    const rec = nativeRecRef.current
    if (!rec) return
    setIsRecording(false)
    setIsTranscribing(true)
    try {
      await rec.stopAndUnloadAsync()
      const uri = rec.getURI()
      nativeRecRef.current = null
      if (uri) {
        const text = await transcribeAudioUri(uri)
        if (text) onTranscribed(text)
      }
    } catch (e) {
      console.error('Native voice error:', e)
    } finally {
      setIsTranscribing(false)
    }
  }

  /* ─── Unified ──────────────────────────────────────────── */

  const startRecording = () => (Platform.OS === 'web' ? startWeb() : startNative())
  const stopRecording = () => (Platform.OS === 'web' ? stopWeb() : stopNative())

  return { isRecording, isTranscribing, startRecording, stopRecording }
}
