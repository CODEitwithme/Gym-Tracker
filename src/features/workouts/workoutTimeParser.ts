import { formatLocalDate } from '../../lib/dateTime'
import type { ParsedWorkout } from '../ai-logger/types'

export interface ParsedWorkoutContext {
  sessionName: string
  date: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  durationMinutes: number
}

function parseTimeToMinutes(timeStr: string, isDefaultPm = false): number | null {
  const cleaned = timeStr.trim().toLowerCase()
  const match = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return null

  let hours = parseInt(match[1], 10)
  const minutes = match[2] ? parseInt(match[2], 10) : 0
  const meridian = match[3]

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  if (meridian === 'pm') {
    if (hours < 12) hours += 12
  } else if (meridian === 'am') {
    if (hours === 12) hours = 0
  } else if (isDefaultPm && hours > 0 && hours < 12) {
    hours += 12
  }

  return hours * 60 + minutes
}

function formatMinutesToTime(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440
  const h = Math.floor(norm / 60)
  const m = norm % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function extractWorkoutContext(
  prompt: string,
  aiParsed?: Partial<ParsedWorkout> | null,
  now: Date = new Date(),
): ParsedWorkoutContext {
  const lower = prompt.toLowerCase()

  // 1. Determine Date
  let targetDate = formatLocalDate(now)
  if (aiParsed?.workoutDate) {
    if (aiParsed.workoutDate.toLowerCase() === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      targetDate = formatLocalDate(y)
    } else if (aiParsed.workoutDate.toLowerCase() === 'today') {
      targetDate = formatLocalDate(now)
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(aiParsed.workoutDate)) {
      targetDate = aiParsed.workoutDate
    }
  } else if (/\byesterday\b/i.test(lower)) {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    targetDate = formatLocalDate(y)
  }

  // 2. Determine Session Name
  let sessionName = 'Workout'
  if (aiParsed?.sessionName && aiParsed.sessionName.trim()) {
    sessionName = aiParsed.sessionName.trim()
  } else {
    // Check for "Name:" prefix at beginning
    const prefixMatch = prompt.match(/^\s*([^:\n]{3,40}):/i)
    if (prefixMatch && !/\b(today|yesterday|trained|workout|worked)\b/i.test(prefixMatch[1])) {
      const cleaned = prefixMatch[1]
        .replace(/\bfor\s+\d+.*$/i, '')
        .replace(/\b(?:from\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?/i, '')
        .trim()
      if (cleaned.length >= 2) {
        sessionName = cleaned
      }
    } else {
      // Check for common workout tags
      const splitPatterns: [RegExp, string][] = [
        [/\bchest(?:\s*&|\s+and)?\s*triceps?\b/i, 'Chest & Triceps'],
        [/\bback(?:\s*&|\s+and)?\s*biceps?\b/i, 'Back & Biceps'],
        [/\bleg\s*day\b|\blegs\b/i, 'Leg Day'],
        [/\bpush\s*day\b|\bpush\b/i, 'Push Day'],
        [/\bpull\s*day\b|\bpull\b/i, 'Pull Day'],
        [/\bupper(?:\s*body)?\b/i, 'Upper Body'],
        [/\blower(?:\s*body)?\b/i, 'Lower Body'],
        [/\bfull\s*body\b/i, 'Full Body'],
        [/\bshoulders?(?:\s*&|\s+and)?\s*arms?\b/i, 'Shoulders & Arms'],
        [/\bshoulders?\b/i, 'Shoulders'],
        [/\barms\b/i, 'Arms'],
        [/\bchest\b/i, 'Chest Day'],
        [/\bback\b/i, 'Back Day'],
      ]
      for (const [re, name] of splitPatterns) {
        if (re.test(lower)) {
          sessionName = name
          break
        }
      }
    }
  }

  // 3. Determine Time Range & Duration
  let startMinutes: number | null = null
  let endMinutes: number | null = null

  // If AI gave structured times
  if (aiParsed?.startTime) {
    startMinutes = parseTimeToMinutes(aiParsed.startTime)
  }
  if (aiParsed?.endTime) {
    endMinutes = parseTimeToMinutes(aiParsed.endTime)
  }

  // Otherwise, client-side regex: "from 5:30 to 6:45 pm" or "6 to 7:15 pm"
  if (startMinutes === null || endMinutes === null) {
    const rangeMatch = lower.match(
      /(?:from\s+)?(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i,
    )
    if (rangeMatch) {
      const rawStart = rangeMatch[1]
      const startMeridian = rangeMatch[2]
      const rawEnd = rangeMatch[3]
      const endMeridian = rangeMatch[4]

      // If end has PM and start has no meridian, start is likely PM if < 12
      const isEndPm = endMeridian === 'pm'
      const startHasNoMeridian = !startMeridian
      const defaultStartPm = isEndPm && startHasNoMeridian

      const parsedStart = parseTimeToMinutes(
        startMeridian ? `${rawStart} ${startMeridian}` : rawStart,
        defaultStartPm,
      )
      const parsedEnd = parseTimeToMinutes(
        endMeridian ? `${rawEnd} ${endMeridian}` : rawEnd,
        isEndPm,
      )

      if (parsedStart !== null && parsedEnd !== null) {
        startMinutes = parsedStart
        endMinutes = parsedEnd
      }
    }
  }

  // If still not found, check for "for X mins" or "for X hours"
  let durationMinutes = 60
  if (startMinutes !== null && endMinutes !== null) {
    durationMinutes = endMinutes >= startMinutes ? endMinutes - startMinutes : (endMinutes + 1440) - startMinutes
    if (durationMinutes === 0) durationMinutes = 60
  } else {
    const durMatch = lower.match(
      /for\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|mins?|minutes?|m)\b/i,
    )
    if (durMatch) {
      const val = parseFloat(durMatch[1])
      const unit = durMatch[2].toLowerCase()
      if (unit.startsWith('h')) {
        durationMinutes = Math.round(val * 60)
      } else {
        durationMinutes = Math.round(val)
      }
    } else if (aiParsed?.durationMinutes && aiParsed.durationMinutes > 0) {
      durationMinutes = aiParsed.durationMinutes
    }

    // Default to ending around now or 18:00
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    endMinutes = nowMinutes > 360 ? nowMinutes : 18 * 60 // if daytime/evening use now, else 6 PM
    startMinutes = endMinutes - durationMinutes
  }

  return {
    sessionName,
    date: targetDate,
    startTime: formatMinutesToTime(startMinutes),
    endTime: formatMinutesToTime(endMinutes),
    durationMinutes,
  }
}
