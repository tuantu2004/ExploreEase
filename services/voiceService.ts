const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? ''
const WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'

// Native: uri from expo-av Recording.getURI()
export async function transcribeAudioUri(uri: string): Promise<string> {
  const body = new FormData()
  body.append('file', { uri, type: 'audio/m4a', name: 'voice.m4a' } as any)
  body.append('model', 'whisper-large-v3')
  body.append('language', 'vi')

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body,
  })
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`)
  return (await res.json()).text?.trim() ?? ''
}

// Web: Blob from MediaRecorder
export async function transcribeBlob(blob: Blob): Promise<string> {
  const body = new FormData()
  body.append('file', new File([blob], 'voice.webm', { type: blob.type || 'audio/webm' }))
  body.append('model', 'whisper-large-v3')
  body.append('language', 'vi')

  const res = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_KEY}` },
    body,
  })
  if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`)
  return (await res.json()).text?.trim() ?? ''
}
