const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? ''
console.log('🔑 GROQ KEY:', GROQ_API_KEY ? GROQ_API_KEY.slice(0, 10) + '...' : 'MISSING!')
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

async function callGroq(prompt: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.choices[0]?.message?.content ?? ''
}

export async function getSuggestions(preferences: {
  interests: string[]
  travelStyle: string
  location: string
}) {
  const prompt = `Bạn là trợ lý du lịch Việt Nam.
Sở thích: ${preferences.interests.join(', ')}
Phong cách: ${preferences.travelStyle}
Vị trí: ${preferences.location}
Gợi ý 5 địa điểm phù hợp. Chỉ trả về JSON:
{"places":[{"name":"","category":"","description":"","reason":""}]}`

  try {
    const text = await callGroq(prompt)
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { places: [] }
  }
}

export async function getDayItinerary(params: {
  location: string
  duration: string
  mood: string
  budget: string
}) {
  const prompt = `Tạo lịch trình tại ${params.location}.
Thời gian: ${params.duration}, Tâm trạng: ${params.mood}, Ngân sách: ${params.budget}
Chỉ trả về JSON:
{"itinerary":[{"time":"08:00","place":"","activity":"","duration":"30 phút","cost":"miễn phí"}]}`

  try {
    const text = await callGroq(prompt)
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { itinerary: [] }
  }
}

export async function getSimilarPlaces(placeName: string) {
  const prompt = `Tìm 5 địa điểm tương tự "${placeName}" tại Việt Nam.
Chỉ trả về JSON:
{"places":[{"name":"","similarity":"","location":""}]}`

  try {
    const text = await callGroq(prompt)
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return { places: [] }
  }
}

export async function chatWithAI(message: string): Promise<string> {
  try {
    return await callGroq(message)
  } catch {
    return 'AI tạm thời không khả dụng. Thử lại sau!'
  }
}