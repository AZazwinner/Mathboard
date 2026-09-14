import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
]

const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

// "2h ago" instead of a raw date, matching SaveStatus.
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""

  const seconds = (Date.now() - then) / 1000
  if (seconds < 45) return "just now"

  for (const [unit, secondsInUnit] of RELATIVE_UNITS) {
    const value = Math.floor(seconds / secondsInUnit)
    if (value >= 1) return relativeFormatter.format(-value, unit)
  }
  return relativeFormatter.format(-Math.floor(seconds), "second")
}
