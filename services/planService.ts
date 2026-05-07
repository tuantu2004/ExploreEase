import AsyncStorage from '@react-native-async-storage/async-storage'
import { Share } from 'react-native'

const PLANS_KEY = 'travel_plans_v1'

export interface PlanItem {
  id: string
  type: 'place' | 'event' | 'note'
  title: string
  address?: string
  lat?: number
  lng?: number
  time?: string
  note?: string
  duration?: string
  cost?: string
}

export interface PlanDay {
  date: string
  items: PlanItem[]
}

export interface TravelPlan {
  id: string
  title: string
  description?: string
  days: PlanDay[]
  created_at: string
  updated_at: string
}

export async function getPlans(): Promise<TravelPlan[]> {
  const raw = await AsyncStorage.getItem(PLANS_KEY)
  if (!raw) return []
  return JSON.parse(raw)
}

export async function getPlanById(id: string): Promise<TravelPlan | null> {
  const plans = await getPlans()
  return plans.find(p => p.id === id) ?? null
}

export async function savePlan(plan: TravelPlan): Promise<void> {
  const plans = await getPlans()
  const idx = plans.findIndex(p => p.id === plan.id)
  if (idx >= 0) {
    plans[idx] = { ...plan, updated_at: new Date().toISOString() }
  } else {
    plans.unshift(plan)
  }
  await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans))
}

export async function deletePlan(id: string): Promise<void> {
  const plans = await getPlans()
  await AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans.filter(p => p.id !== id)))
}

export function createPlan(title: string, numDays: number, startDate: Date): TravelPlan {
  const days: PlanDay[] = []
  for (let i = 0; i < numDays; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    days.push({ date: d.toISOString().split('T')[0], items: [] })
  }
  return {
    id: Date.now().toString(),
    title,
    days,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

// Nearest-neighbor route optimization for items in a day
export function optimizeRoute(items: PlanItem[]): PlanItem[] {
  const withCoords = items.filter(i => i.lat != null && i.lng != null)
  const withoutCoords = items.filter(i => i.lat == null || i.lng == null)

  if (withCoords.length <= 1) return items

  const dist = (a: PlanItem, b: PlanItem) => {
    const dlat = (a.lat! - b.lat!) * 111
    const dlng = (a.lng! - b.lng!) * 111 * Math.cos((a.lat! * Math.PI) / 180)
    return Math.sqrt(dlat * dlat + dlng * dlng)
  }

  const visited = new Set<number>()
  const result: PlanItem[] = [withCoords[0]]
  visited.add(0)

  while (visited.size < withCoords.length) {
    const last = result[result.length - 1]
    let nearest = -1
    let minDist = Infinity
    withCoords.forEach((item, idx) => {
      if (!visited.has(idx)) {
        const d = dist(last, item)
        if (d < minDist) { minDist = d; nearest = idx }
      }
    })
    if (nearest === -1) break
    visited.add(nearest)
    result.push(withCoords[nearest])
  }

  return [...result, ...withoutCoords]
}

export async function sharePlan(plan: TravelPlan): Promise<void> {
  const lines: string[] = [`📍 ${plan.title}`, '']
  plan.days.forEach((day, i) => {
    const dateStr = new Date(day.date + 'T00:00:00').toLocaleDateString('vi-VN', {
      weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    })
    lines.push(`📅 Ngày ${i + 1} – ${dateStr}`)
    if (day.items.length === 0) {
      lines.push('  (Chưa có lịch)')
    } else {
      day.items.forEach(item => {
        const time = item.time ? `[${item.time}] ` : ''
        const note = item.note ? ` – ${item.note}` : ''
        lines.push(`  ${time}📌 ${item.title}${note}`)
      })
    }
    lines.push('')
  })
  lines.push('Được tạo bằng ExploreEase 🗺️')

  await Share.share({ message: lines.join('\n') })
}
