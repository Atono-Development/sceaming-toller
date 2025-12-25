import * as React from "react"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value?: string
  onChange: (value: string) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  // Parse value or default to 12:00
  const parseTime = (val?: string) => {
    if (!val) return { h: 12, m: 0 }
    const [h, m] = val.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return { h: 12, m: 0 }
    return { h, m }
  }

  const { h, m } = parseTime(value)
  
  const displayHour = h % 12 || 12
  const displayMinute = m
  const displayPeriod = h >= 12 ? 'PM' : 'AM'

  const updateTime = (newH: number, newM: number) => {
    const timeString = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`
    onChange(timeString)
  }

  const handleHourChange = (val: string) => {
    const selectedHour = parseInt(val)
    let newH = selectedHour
    if (displayPeriod === 'PM') {
      if (selectedHour !== 12) newH = selectedHour + 12
    } else {
      if (selectedHour === 12) newH = 0
    }
    updateTime(newH, m)
  }

  const handleMinuteChange = (val: string) => {
    updateTime(h, parseInt(val))
  }

  const handlePeriodChange = (val: string) => {
    let newH = h
    if (val === 'AM' && h >= 12) {
      newH = h - 12
    } else if (val === 'PM' && h < 12) {
      newH = h + 12
    }
    updateTime(newH, m)
  }

  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = [0, 15, 30, 45]
  
  return (
    <div className={cn("flex gap-2 items-center", className)}>
      <select
        value={displayHour}
        onChange={(e) => handleHourChange(e.target.value)}
        className="flex h-10 w-[70px] rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
      >
        {hours.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-xl font-bold">:</span>
      <select
        value={displayMinute}
        onChange={(e) => handleMinuteChange(e.target.value)}
        className="flex h-10 w-[70px] rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
      >
        {minutes.map((min) => (
          <option key={min} value={min}>{min.toString().padStart(2, '0')}</option>
        ))}
      </select>
      <select
        value={displayPeriod}
        onChange={(e) => handlePeriodChange(e.target.value)}
        className="flex h-10 w-[70px] rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}
