import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function DatePicker({ value, onChange, placeholder = 'Select date', label }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value + 'T00:00:00')
    return new Date()
  })
  const ref = useRef()

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays = new Date(year, month, 0).getDate()

  const cells = []
  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevDays - i, current: false })
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ day: i, current: true })
  }
  // Next month leading days
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, current: false })
  }

  const selectedStr = value || ''

  const handleSelect = (day) => {
    const m = String(month + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    const dateStr = `${year}-${m}-${d}`
    onChange(dateStr)
    setOpen(false)
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1))
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1))

  const formatDisplay = (val) => {
    if (!val) return ''
    const d = new Date(val + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const isToday = (day) => {
    const now = new Date()
    return day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
  }

  const isSelected = (day) => {
    if (!value) return false
    const m = String(month + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${year}-${m}-${d}` === value
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--admin-bg)',
          border: '1px solid var(--admin-border)',
          borderRadius: 6,
          color: value ? 'var(--admin-text)' : 'var(--admin-text-muted)',
          fontFamily: 'Outfit, sans-serif',
          fontSize: '0.9rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'border-color 0.15s',
          borderColor: open ? 'var(--admin-gold)' : undefined
        }}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <Calendar size={15} style={{ opacity: 0.5 }} />
      </div>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 6,
          background: 'var(--admin-surface)',
          border: '1px solid var(--admin-border)',
          borderRadius: 10,
          padding: '14px',
          width: 280,
          zIndex: 300,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        }}>
          {/* Month/Year Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontFamily: 'Outfit', fontSize: '0.9rem', fontWeight: 500, color: 'var(--admin-text)' }}>
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{
                textAlign: 'center',
                fontSize: '0.7rem',
                color: 'var(--admin-text-muted)',
                fontFamily: 'Outfit',
                fontWeight: 500,
                padding: '4px 0',
                letterSpacing: '0.04em'
              }}>{d}</div>
            ))}
          </div>

          {/* Day Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((cell, i) => {
              const selected = cell.current && isSelected(cell.day)
              const today = cell.current && isToday(cell.day)
              return (
                <button
                  key={i}
                  onClick={() => cell.current && handleSelect(cell.day)}
                  style={{
                    width: 34,
                    height: 34,
                    border: 'none',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    fontFamily: 'Outfit',
                    cursor: cell.current ? 'pointer' : 'default',
                    color: selected ? '#1A1A1A' : cell.current ? 'var(--admin-text)' : 'var(--admin-text-muted)',
                    background: selected ? 'var(--admin-gold)' : 'transparent',
                    fontWeight: selected || today ? 500 : 400,
                    outline: today && !selected ? '1px solid var(--admin-gold)' : 'none',
                    opacity: cell.current ? 1 : 0.3,
                    transition: 'all 0.1s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}
                  onMouseOver={e => { if (cell.current && !selected) e.currentTarget.style.background = 'var(--admin-surface-hover)' }}
                  onMouseOut={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>

          {/* Today Button */}
          <div style={{ marginTop: 10, borderTop: '1px solid var(--admin-border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => {
                const now = new Date()
                setViewDate(now)
                const m = String(now.getMonth() + 1).padStart(2, '0')
                const d = String(now.getDate()).padStart(2, '0')
                onChange(`${now.getFullYear()}-${m}-${d}`)
                setOpen(false)
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--admin-gold)',
                fontSize: '0.8rem',
                fontFamily: 'Outfit',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >Today</button>
            {value && (
              <button
                onClick={() => { onChange(''); setOpen(false) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--admin-text-muted)',
                  fontSize: '0.8rem',
                  fontFamily: 'Outfit',
                  cursor: 'pointer'
                }}
              >Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
