import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../utils/AuthContext'
import api from '../utils/api'
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Home, Calendar, Users, Clock, Eye, TrendingUp, Camera, ChevronLeft, ChevronRight, X, LogOut, Image, Megaphone, CheckCircle, ListChecks, Flag } from 'lucide-react'

const ACTIVITY_LABELS = {
  showing: 'Private Showing',
  open_house: 'Open House',
  broker_open: 'Broker Open',
  agent_preview: 'Agent Preview'
}

const ACTIVITY_COLORS = {
  showing: '#5B7FA5',
  open_house: '#4A7C59',
  broker_open: '#B8926A',
  agent_preview: '#8B6F47'
}

const ACTIVITY_ICONS = {
  showing: Eye,
  open_house: Users,
  broker_open: TrendingUp,
  agent_preview: Home
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPrice(price) {
  if (!price) return ''
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price)
}

// Custom donut chart label
function renderDonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, value, percent }) {
  if (percent < 0.08) return null
  const RADIAN = Math.PI / 180
  const radius = outerRadius + 24
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#6B6B6B" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontFamily="DM Sans">
      {name} ({value})
    </text>
  )
}

// Custom tooltip for area chart
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'white',
      border: '1px solid #EAEAE6',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
      fontFamily: 'DM Sans'
    }}>
      <div style={{ fontSize: '0.78rem', color: '#9B9B9B', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1A1A1A' }}>{payload[0].value} visitors</div>
    </div>
  )
}

// ─── Activity Card Carousel ─────────────────────────────────────────────────

function ActivityCarousel({ title, activities, color = '#B8926A' }) {
  const [idx, setIdx] = useState(0)
  if (!activities || activities.length === 0) return null
  const act = activities[idx]
  const start = new Date(act.date)
  const hasEnd = act.end_date
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        <span style={{ fontSize: '0.78rem', color: '#9B9B9B' }}>{activities.length} total</span>
      </div>
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid #F0F0EC',
        overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {/* Card content */}
        <div style={{ padding: '20px 24px', borderLeft: `4px solid ${color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color, marginBottom: 4 }}>
                {ACTIVITY_LABELS[act.type] || act.type?.replace(/_/g, ' ')}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A1A1A' }}>
                {start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#6B6B6B', marginTop: 2 }}>
                {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                {hasEnd && ` – ${new Date(act.end_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
              </div>
            </div>
            {act.visitor_count > 1 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1A1A1A', fontFamily: 'Cormorant Garamond, serif' }}>{act.visitor_count}</div>
                <div style={{ fontSize: '0.72rem', color: '#9B9B9B' }}>visitors</div>
              </div>
            )}
          </div>
          {act.brokerage && (
            <div style={{ fontSize: '0.85rem', color: '#6B6B6B', marginBottom: 6 }}>{act.brokerage}</div>
          )}
          {act.feedback && (
            <div style={{
              fontSize: '0.88rem', color: '#4A4A4A', lineHeight: 1.5,
              padding: '10px 14px', background: '#FAFAF8', borderRadius: 8,
              borderLeft: '3px solid #E0DCD4', marginTop: 8
            }}>
              {act.feedback}
            </div>
          )}
        </div>
        {/* Navigation */}
        {activities.length > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderTop: '1px solid #F0F0EC', background: '#FAFAF8'
          }}>
            <button
              onClick={() => setIdx(Math.max(0, idx - 1))}
              disabled={idx === 0}
              style={{
                border: 'none', background: 'none', cursor: idx === 0 ? 'default' : 'pointer',
                color: idx === 0 ? '#E0DCD4' : '#9B9B9B', padding: 4, display: 'flex', alignItems: 'center', gap: 4,
                fontSize: '0.8rem'
              }}
            >
              <ChevronLeft size={16} /> Newer
            </button>
            <span style={{ fontSize: '0.75rem', color: '#9B9B9B', fontFamily: 'JetBrains Mono, monospace' }}>
              {idx + 1} / {activities.length}
            </span>
            <button
              onClick={() => setIdx(Math.min(activities.length - 1, idx + 1))}
              disabled={idx === activities.length - 1}
              style={{
                border: 'none', background: 'none', cursor: idx === activities.length - 1 ? 'default' : 'pointer',
                color: idx === activities.length - 1 ? '#E0DCD4' : '#9B9B9B', padding: 4, display: 'flex', alignItems: 'center', gap: 4,
                fontSize: '0.8rem'
              }}
            >
              Older <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Activity Detail Card (vertical scroll) ─────────────────────────────────

function ActivityDetailCard({ act, color = '#B8926A' }) {
  const start = new Date(act.date)
  const hasEnd = act.end_date
  return (
    <div style={{
      background: 'white', borderRadius: 10, border: '1px solid #F0F0EC',
      borderLeft: `4px solid ${color}`, padding: '16px 20px', marginBottom: '0.75rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1A1A1A', marginBottom: 2 }}>
            {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#6B6B6B' }}>
            {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            {hasEnd && ` – ${new Date(act.end_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
          </div>
        </div>
        {act.visitor_count > 1 && (
          <span style={{ fontSize: '0.78rem', color: '#9B9B9B', background: '#F5F5F2', padding: '2px 8px', borderRadius: 100 }}>
            {act.visitor_count} visitors
          </span>
        )}
      </div>
      {act.brokerage && (
        <div style={{ fontSize: '0.82rem', color: '#9B9B9B', marginTop: 6 }}>{act.brokerage}</div>
      )}
      {act.feedback && (
        <div style={{
          fontSize: '0.85rem', color: '#4A4A4A', lineHeight: 1.5, marginTop: 8,
          padding: '10px 14px', background: '#FAFAF8', borderRadius: 8, borderLeft: '3px solid #E0DCD4'
        }}>
          {act.feedback}
        </div>
      )}
    </div>
  )
}

// ─── Calendar View ──────────────────────────────────────────────────────────

function CalendarView({ activities }) {
  const [calView, setCalView] = useState('week')
  const now = new Date()
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthDate, setMonthDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))

  if (calView === 'week') {
    // Get the start of the current week + offset
    const today = new Date()
    const dayOfWeek = today.getDay()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - dayOfWeek + (weekOffset * 7))
    weekStart.setHours(0, 0, 0, 0)

    const days = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + i)
      const dayStr = day.toDateString()
      const dayActs = (activities || []).filter(a => new Date(a.date).toDateString() === dayStr)
      days.push({ date: day, activities: dayActs })
    }

    const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', padding: 4 }}><ChevronLeft size={18} /></button>
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1A1A1A', minWidth: 180, textAlign: 'center' }}>{weekLabel}</span>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', padding: 4 }}><ChevronRight size={18} /></button>
          </div>
          <div style={{ display: 'flex', background: '#F5F5F2', borderRadius: 6, padding: 2 }}>
            <button onClick={() => setCalView('week')} style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', background: calView === 'week' ? 'white' : 'none', color: '#1A1A1A', fontWeight: calView === 'week' ? 600 : 400, boxShadow: calView === 'week' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>Week</button>
            <button onClick={() => setCalView('month')} style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', background: calView === 'month' ? 'white' : 'none', color: '#1A1A1A', fontWeight: calView === 'month' ? 600 : 400, boxShadow: calView === 'month' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>Month</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: '#9B9B9B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>{d}</div>
          ))}
          {days.map((d, i) => {
            const isToday = d.date.toDateString() === now.toDateString()
            const hasActs = d.activities.length > 0
            return (
              <div key={i} style={{
                background: hasActs ? 'rgba(184,146,106,0.06)' : 'white',
                border: `1px solid ${isToday ? '#B8926A' : '#F0F0EC'}`,
                borderRadius: 8, padding: '8px 6px', minHeight: 72, position: 'relative'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: isToday ? 700 : 400, color: isToday ? '#B8926A' : '#1A1A1A', marginBottom: 4 }}>
                  {d.date.getDate()}
                </div>
                {d.activities.map((a, ai) => (
                  <div key={ai} style={{
                    fontSize: '0.65rem', padding: '2px 4px', borderRadius: 3, marginBottom: 2,
                    background: a.type === 'open_house' || a.type === 'broker_open' ? 'rgba(91,127,165,0.12)' : 'rgba(184,146,106,0.12)',
                    color: a.type === 'open_house' || a.type === 'broker_open' ? '#5B7FA5' : '#B8926A',
                    fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {new Date(a.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Month view
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month, d)
    const dayStr = day.toDateString()
    const dayActs = (activities || []).filter(a => new Date(a.date).toDateString() === dayStr)
    cells.push({ date: day, day: d, activities: dayActs })
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => setMonthDate(new Date(year, month - 1, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', padding: 4 }}><ChevronLeft size={18} /></button>
          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#1A1A1A', minWidth: 140, textAlign: 'center' }}>{monthLabel}</span>
          <button onClick={() => setMonthDate(new Date(year, month + 1, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', padding: 4 }}><ChevronRight size={18} /></button>
        </div>
        <div style={{ display: 'flex', background: '#F5F5F2', borderRadius: 6, padding: 2 }}>
          <button onClick={() => setCalView('week')} style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', background: calView === 'week' ? 'white' : 'none', color: '#1A1A1A', fontWeight: calView === 'week' ? 600 : 400, boxShadow: calView === 'week' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>Week</button>
          <button onClick={() => setCalView('month')} style={{ fontSize: '0.78rem', padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', background: calView === 'month' ? 'white' : 'none', color: '#1A1A1A', fontWeight: calView === 'month' ? 600 : 400, boxShadow: calView === 'month' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none' }}>Month</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: '#9B9B9B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 0' }}>{d}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} style={{ background: '#FAFAF8', borderRadius: 6, minHeight: 52 }} />
          const isToday = cell.date.toDateString() === now.toDateString()
          const hasActs = cell.activities.length > 0
          return (
            <div key={i} style={{
              background: hasActs ? 'rgba(184,146,106,0.06)' : 'white',
              border: `1px solid ${isToday ? '#B8926A' : '#F0F0EC'}`,
              borderRadius: 6, padding: '4px 4px', minHeight: 52
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: isToday ? 700 : 400, color: isToday ? '#B8926A' : '#1A1A1A', marginBottom: 2 }}>
                {cell.day}
              </div>
              {cell.activities.slice(0, 2).map((a, ai) => (
                <div key={ai} style={{
                  fontSize: '0.6rem', padding: '1px 3px', borderRadius: 2, marginBottom: 1,
                  background: a.type === 'open_house' || a.type === 'broker_open' ? 'rgba(91,127,165,0.12)' : 'rgba(184,146,106,0.12)',
                  color: a.type === 'open_house' || a.type === 'broker_open' ? '#5B7FA5' : '#B8926A',
                  fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {new Date(a.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              ))}
              {cell.activities.length > 2 && (
                <div style={{ fontSize: '0.58rem', color: '#9B9B9B' }}>+{cell.activities.length - 2} more</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ClientDashboard() {
  const { user, logout, refreshUser } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [breakdownPeriod, setBreakdownPeriod] = useState('this_week')
  const [trendPeriod, setTrendPeriod] = useState('month')
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Get properties from user object
  const properties = user?.properties || []

  useEffect(() => {
    if (properties.length > 0 && !selectedProperty) {
      setSelectedProperty(properties[0].id)
    }
  }, [properties])

  useEffect(() => {
    if (selectedProperty) {
      setLoading(true)
      api.getDashboard(selectedProperty)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [selectedProperty])

  // Build donut chart data (only categories with data)
  const donutData = useMemo(() => {
    if (!data?.breakdown?.[breakdownPeriod]) return []
    return Object.entries(data.breakdown[breakdownPeriod])
      .filter(([_, count]) => count > 0)
      .map(([type, count]) => ({
        name: ACTIVITY_LABELS[type] || type,
        value: count,
        color: ACTIVITY_COLORS[type] || '#999'
      }))
  }, [data, breakdownPeriod])

  const totalVisitors = donutData.reduce((sum, d) => sum + d.value, 0)

  if (!properties.length) {
    return (
      <div className="client-portal">
        <ClientNav user={user} onLogout={logout} />
        <div className="client-page">
          <div className="empty-state" style={{ paddingTop: '6rem' }}>
            <Home size={48} strokeWidth={1} />
            <div className="empty-state__text" style={{ marginTop: '1rem' }}>
              <p style={{ fontSize: '1.2rem', color: '#1A1A1A', marginBottom: '0.5rem' }}>Welcome, {user?.full_name?.split(' ')[0]}</p>
              <p>Your portal is being set up. You'll receive access to your property dashboard shortly.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="client-portal">
      <ClientNav
        user={user}
        properties={properties}
        selectedProperty={selectedProperty}
        onPropertyChange={setSelectedProperty}
        onLogout={logout}
      />

      <div className="client-page">
        {loading || !data ? (
          <div className="empty-state" style={{ paddingTop: '4rem' }}>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', color: '#9B9B9B' }}>Loading your dashboard...</div>
          </div>
        ) : (
          <>
            {/* Hero Card */}
            <div className="client-hero">
              {data.photos?.length > 0 ? (
                <img src={data.photos[0].url} alt={data.property.address} className="client-hero__image" />
              ) : (
                <div style={{ position: 'relative' }}>
                  <img src="/placeholder-hero.jpg" alt="DC Concierge" className="client-hero__image" style={{ filter: 'brightness(0.85)' }} />
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.25) 100%)'
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.14em', color: 'rgba(255,255,255,0.7)',
                      background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)',
                      padding: '6px 16px', borderRadius: 100
                    }}>
                      Property Photo Coming Soon
                    </span>
                  </div>
                </div>
              )}
              <div className="client-hero__content">
                <h1 className="client-hero__address">{data.property.address}</h1>
                <div className="client-hero__details">
                  {data.property.list_price && (
                    <span className="client-hero__price">{formatPrice(data.property.list_price)}</span>
                  )}
                  <span className={`client-hero__status client-hero__status--${data.property.status?.toLowerCase()}`}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    {data.property.phase === 'pre_market' ? 'Coming Soon' : data.property.phase === 'pending' ? 'Under Contract' : data.property.status}
                  </span>
                  {data.property.mls_number && (
                    <span className="client-hero__detail" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>
                      MLS #{data.property.mls_number}
                    </span>
                  )}
                  {data.property.bedrooms && (
                    <span className="client-hero__detail">{data.property.bedrooms} bed · {data.property.bathrooms} bath · {data.property.sqft?.toLocaleString()} sqft</span>
                  )}
                </div>
              </div>
            </div>

            {/* ─── PRE-MARKET PHASE ──────────────────────────────────────────── */}
            {(data.property.phase === 'pre_market') && (
              <>
                {/* Progress Summary — Compact */}
                {(() => {
                  const tasks = data.pre_market_tasks || []
                  const completed = tasks.filter(t => t.status === 'complete').length
                  const total = tasks.length
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
                  const targetDate = data.property.target_live_date
                  const daysUntil = targetDate ? Math.max(0, Math.ceil((new Date(targetDate + 'T00:00') - new Date()) / 86400000)) : null

                  return (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{
                          flex: 1, minWidth: 120, padding: '12px 16px', background: 'white', borderRadius: 10,
                          border: '1px solid #F0F0EC'
                        }}>
                          <div style={{ fontSize: '0.72rem', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>Progress</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1A1A1A', fontFamily: 'Cormorant Garamond, serif' }}>{pct}%</div>
                          <div style={{ fontSize: '0.75rem', color: '#9B9B9B' }}>{completed} of {total} complete</div>
                        </div>
                        <div style={{
                          flex: 1, minWidth: 120, padding: '12px 16px', background: 'white', borderRadius: 10,
                          border: '1px solid #F0F0EC'
                        }}>
                          <div style={{ fontSize: '0.72rem', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>Remaining</div>
                          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1A1A1A', fontFamily: 'Cormorant Garamond, serif' }}>{total - completed}</div>
                          <div style={{ fontSize: '0.75rem', color: '#9B9B9B' }}>tasks left</div>
                        </div>
                        {daysUntil !== null && (
                          <div style={{
                            flex: 1, minWidth: 120, padding: '12px 16px', background: 'white', borderRadius: 10,
                            border: '1px solid #F0F0EC'
                          }}>
                            <div style={{ fontSize: '0.72rem', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>Go-Live</div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1A1A1A', fontFamily: 'Cormorant Garamond, serif' }}>{daysUntil}</div>
                            <div style={{ fontSize: '0.75rem', color: '#9B9B9B' }}>days until listing</div>
                          </div>
                        )}
                      </div>

                      {/* Progress bar */}
                      {total > 0 && (
                        <div style={{ marginTop: '1rem', padding: '0 2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.72rem', color: '#9B9B9B' }}>
                            <span>Getting ready</span>
                            <span>Ready to list</span>
                          </div>
                          <div style={{ height: 6, background: '#F0F0EC', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #B8926A, #D4A44A)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Two-Column: Vendors (left) + Checklist (right) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

                  {/* LEFT — Vendor Appointments */}
                  <div>
                    <div className="section-header">
                      <h2 className="section-title">Upcoming Appointments</h2>
                    </div>
                    {(data.vendor_appointments || []).filter(v => v.status !== 'cancelled' && v.status !== 'complete').length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {(data.vendor_appointments || []).filter(v => v.status !== 'cancelled' && v.status !== 'complete').map(v => (
                          <div key={v.id} style={{
                            padding: '16px 18px', background: 'white', borderRadius: 10,
                            border: '1px solid #F0F0EC',
                            borderLeft: `4px solid ${v.status === 'confirmed' ? '#4A7C59' : '#B8926A'}`
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 3 }}>
                                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1A1A1A' }}>{v.vendor_name}</span>
                                  {v.company && <span style={{ fontSize: '0.82rem', color: '#9B9B9B' }}>· {v.company}</span>}
                                </div>
                                <div style={{
                                  fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                                  padding: '2px 7px', borderRadius: 100, display: 'inline-block', marginBottom: 6,
                                  background: 'rgba(184, 146, 106, 0.08)', color: '#B8926A'
                                }}>
                                  {v.service_type?.replace(/_/g, ' ')}
                                </div>
                                {v.scheduled_date && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 3 }}>
                                    <Calendar size={13} color="#9B9B9B" />
                                    <span style={{ fontSize: '0.85rem', color: '#1A1A1A', fontWeight: 500 }}>
                                      {new Date(v.scheduled_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                    </span>
                                    <span style={{ fontSize: '0.82rem', color: '#6B6B6B' }}>
                                      at {new Date(v.scheduled_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: 3 }}>
                                  {v.phone && (
                                    <a href={`tel:${v.phone}`} style={{ fontSize: '0.78rem', color: '#5B7FA5', textDecoration: 'none' }}>
                                      📞 {v.phone}
                                    </a>
                                  )}
                                  {v.email && (
                                    <a href={`mailto:${v.email}`} style={{ fontSize: '0.78rem', color: '#5B7FA5', textDecoration: 'none' }}>
                                      ✉ {v.email}
                                    </a>
                                  )}
                                </div>
                              </div>
                              {v.status === 'confirmed' && (
                                <span style={{
                                  fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                                  padding: '2px 8px', borderRadius: 100,
                                  background: 'rgba(74, 124, 89, 0.1)', color: '#4A7C59', flexShrink: 0
                                }}>
                                  Confirmed
                                </span>
                              )}
                            </div>
                            {v.notes && (
                              <div style={{
                                marginTop: 8, padding: '8px 12px', background: '#FAFAF8',
                                borderRadius: 6, fontSize: '0.82rem', color: '#6B6B6B',
                                borderLeft: '3px solid #E0DCD4'
                              }}>
                                📋 {v.notes}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Completed visits inline */}
                        {(data.vendor_appointments || []).filter(v => v.status === 'complete').map(v => (
                          <div key={v.id} style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '10px 14px', background: 'white', borderRadius: 8,
                            border: '1px solid #F0F0EC', opacity: 0.55
                          }}>
                            <CheckCircle size={16} color="#4A7C59" />
                            <span style={{ flex: 1, fontWeight: 500, fontSize: '0.85rem', color: '#1A1A1A' }}>{v.vendor_name}</span>
                            <span style={{ fontSize: '0.75rem', color: '#9B9B9B' }}>
                              {v.scheduled_date && new Date(v.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        padding: '2rem', background: 'white', borderRadius: 10,
                        border: '1px solid #F0F0EC', textAlign: 'center',
                        color: '#9B9B9B', fontSize: '0.9rem', fontFamily: 'Cormorant Garamond, serif'
                      }}>
                        No upcoming appointments scheduled yet.
                      </div>
                    )}
                  </div>

                  {/* RIGHT — Preparation Checklist */}
                  <div>
                    <div className="section-header">
                      <h2 className="section-title">Preparation Checklist</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(data.pre_market_tasks || []).map(t => (
                        <div key={t.id} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '12px 14px', background: 'white', borderRadius: 10,
                          border: '1px solid #F0F0EC',
                          opacity: t.status === 'complete' ? 0.65 : 1
                        }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                            border: t.status === 'complete' ? 'none' : '2px solid #E0DCD4',
                            background: t.status === 'complete' ? '#4A7C59' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {t.status === 'complete' && <CheckCircle size={15} color="#fff" />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 500, fontSize: '0.9rem', color: '#1A1A1A',
                              textDecoration: t.status === 'complete' ? 'line-through' : 'none'
                            }}>{t.title}</div>
                            {(t.scheduled_date || t.notes) && (
                              <div style={{ fontSize: '0.75rem', color: '#9B9B9B', marginTop: 1 }}>
                                {t.scheduled_date && <span>{new Date(t.scheduled_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                {t.scheduled_date && t.notes && <span> · </span>}
                                {t.notes && <span>{t.notes}</span>}
                              </div>
                            )}
                          </div>
                          <span style={{
                            fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                            padding: '2px 8px', borderRadius: 100,
                            background: t.status === 'complete' ? 'rgba(74, 124, 89, 0.1)' : t.status === 'in_progress' ? 'rgba(184, 146, 106, 0.1)' : t.status === 'scheduled' ? 'rgba(91, 127, 165, 0.1)' : 'rgba(155, 155, 155, 0.1)',
                            color: t.status === 'complete' ? '#4A7C59' : t.status === 'in_progress' ? '#B8926A' : t.status === 'scheduled' ? '#5B7FA5' : '#9B9B9B'
                          }}>
                            {t.status === 'in_progress' ? 'In Progress' : t.status}
                          </span>
                        </div>
                      ))}
                      {(!data.pre_market_tasks || data.pre_market_tasks.length === 0) && (
                        <div style={{
                          padding: '2rem', background: 'white', borderRadius: 10,
                          border: '1px solid #F0F0EC', textAlign: 'center',
                          color: '#9B9B9B', fontSize: '0.9rem', fontFamily: 'Cormorant Garamond, serif'
                        }}>
                          Your preparation plan is being finalized. Check back soon.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Custom Sections for Pre-Market */}
                {(data.custom_sections || []).filter(s => s.phase === 'pre_market').length > 0 && (
                  <div style={{ marginTop: '2rem' }}>
                    {(data.custom_sections || []).filter(s => s.phase === 'pre_market').map(section => (
                      <div key={section.id} style={{ marginBottom: '1.5rem' }}>
                        <div className="section-header">
                          <h2 className="section-title">{section.title}</h2>
                        </div>
                        {section.section_type === 'date' ? (
                          <div style={{
                            padding: '18px 22px', background: 'white', borderRadius: 10,
                            border: '1px solid #F0F0EC', display: 'flex', alignItems: 'center', gap: '1rem'
                          }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 10, background: 'rgba(184, 146, 106, 0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              <Calendar size={20} color="#B8926A" />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#1A1A1A' }}>
                                {section.date_value
                                  ? new Date(section.date_value + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                                  : 'Date to be confirmed'
                                }
                              </div>
                              {section.date_value && (() => {
                                const days = Math.ceil((new Date(section.date_value + 'T00:00') - new Date()) / 86400000)
                                return days >= 0
                                  ? <div style={{ fontSize: '0.82rem', color: '#9B9B9B', marginTop: 2 }}>{days} days away</div>
                                  : <div style={{ fontSize: '0.82rem', color: '#C75B5B', marginTop: 2 }}>{Math.abs(days)} days ago</div>
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {(section.items || []).map(item => (
                              <div key={item.id} style={{
                                display: 'flex', alignItems: 'center', gap: '1rem',
                                padding: '14px 18px', background: 'white', borderRadius: 10,
                                border: '1px solid #F0F0EC',
                                opacity: item.status === 'complete' ? 0.65 : 1
                              }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                  border: item.status === 'complete' ? 'none' : '2px solid #E0DCD4',
                                  background: item.status === 'complete' ? '#4A7C59' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                  {item.status === 'complete' && <CheckCircle size={16} color="#fff" />}
                                </div>
                                <span style={{
                                  fontSize: '0.92rem', color: '#1A1A1A',
                                  textDecoration: item.status === 'complete' ? 'line-through' : 'none'
                                }}>{item.title}</span>
                              </div>
                            ))}
                            {(!section.items || section.items.length === 0) && (
                              <div style={{ padding: '1rem', color: '#9B9B9B', fontSize: '0.88rem' }}>Items coming soon.</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ─── ACTIVE PHASE ──────────────────────────────────────────────── */}
            {(data.property.phase === 'active' || !data.property.phase) && (
              <>
            {/* Tab Nav */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '2rem', background: 'var(--client-surface-hover)', padding: 4, borderRadius: 'var(--client-radius-sm)', border: '1px solid var(--client-border-light)', width: 'fit-content' }}>
              {[
                { id: 'overview', label: 'Overview', icon: TrendingUp },
                { id: 'activity', label: 'Activity', icon: Calendar },
                { id: 'marketing', label: 'Marketing', icon: Megaphone },
                { id: 'gallery', label: 'Gallery', icon: Image },
              ].map(tab => (
                <button
                  key={tab.id}
                  className={`section-toggle__btn ${activeTab === tab.id ? 'section-toggle__btn--active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <tab.icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ─── Overview Tab ─────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <>
                {/* Upcoming Events */}
                {(() => {
                  const now = new Date()
                  const upcoming = (data.recent_activity || []).filter(a => new Date(a.date) > now)
                  if (upcoming.length === 0) return null
                  return (
                    <div style={{ marginBottom: '2rem' }}>
                      <div className="section-header">
                        <h2 className="section-title">Upcoming Events</h2>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {upcoming.map(act => {
                          const start = new Date(act.date)
                          const hasEnd = act.end_date
                          const isOpen = act.type === 'open_house' || act.type === 'broker_open'
                          return (
                            <div key={act.id} style={{
                              padding: '16px 20px', background: 'white', borderRadius: 10,
                              border: '1px solid #F0F0EC',
                              borderLeft: `4px solid ${isOpen ? '#5B7FA5' : '#B8926A'}`
                            }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1A1A1A', marginBottom: 3 }}>
                                    {ACTIVITY_LABELS[act.type] || act.type?.replace(/_/g, ' ')}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', color: '#6B6B6B' }}>
                                    <Calendar size={14} color="#9B9B9B" />
                                    <span style={{ fontWeight: 500, color: '#1A1A1A' }}>
                                      {start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                    </span>
                                    <span>
                                      {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                      {hasEnd && ` – ${new Date(act.end_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                                    </span>
                                  </div>
                                  {act.brokerage && (
                                    <div style={{ fontSize: '0.82rem', color: '#9B9B9B', marginTop: 3 }}>Hosted by {act.brokerage}</div>
                                  )}
                                </div>
                                <span style={{
                                  fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                                  padding: '3px 10px', borderRadius: 100, flexShrink: 0,
                                  background: isOpen ? 'rgba(91, 127, 165, 0.1)' : 'rgba(184, 146, 106, 0.1)',
                                  color: isOpen ? '#5B7FA5' : '#B8926A'
                                }}>
                                  {isOpen ? (act.type === 'open_house' ? 'Open House' : 'Broker Open') : 'Showing'}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Stats Cards */}
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-card__label">Total Showings</div>
                    <div className="stat-card__value">{data.stats.total_showings}</div>
                    <div className="stat-card__sub">{data.stats.this_week_count} this week</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card__label">Open House Visitors</div>
                    <div className="stat-card__value">{data.stats.total_open_house_visitors}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card__label">Days on Market</div>
                    <div className="stat-card__value">{data.stats.days_on_market}</div>
                    <div className="stat-card__sub">Listed {data.property.list_date}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card__label">Total Activity</div>
                    <div className="stat-card__value">{data.stats.total_activities}</div>
                    <div className="stat-card__sub">{data.stats.this_month_count} this month</div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="chart-row">
                  {/* Donut Chart */}
                  <div className="chart-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div className="chart-card__title" style={{ margin: 0 }}>Activity by Source</div>
                      <div className="section-toggle" style={{ marginBottom: 0 }}>
                        {['this_week', 'this_month', 'all_time'].map(p => (
                          <button
                            key={p}
                            className={`section-toggle__btn ${breakdownPeriod === p ? 'section-toggle__btn--active' : ''}`}
                            onClick={() => setBreakdownPeriod(p)}
                          >
                            {p === 'this_week' ? 'Week' : p === 'this_month' ? 'Month' : 'All'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {donutData.length > 0 ? (
                      <div style={{ position: 'relative' }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={donutData}
                              cx="50%"
                              cy="50%"
                              innerRadius={65}
                              outerRadius={90}
                              paddingAngle={3}
                              dataKey="value"
                              label={renderDonutLabel}
                              labelLine={false}
                              stroke="none"
                            >
                              {donutData.map((entry, i) => (
                                <Cell key={i} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center',
                          pointerEvents: 'none'
                        }}>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '2rem', fontWeight: 600, lineHeight: 1 }}>{totalVisitors}</div>
                          <div style={{ fontSize: '0.72rem', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Visitors</div>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-state" style={{ padding: '2rem' }}>
                        <div className="empty-state__text">No activity for this period</div>
                      </div>
                    )}
                  </div>

                  {/* Activity Trend */}
                  <div className="chart-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div className="chart-card__title" style={{ margin: 0 }}>Activity Trend</div>
                      <div className="section-toggle" style={{ marginBottom: 0 }}>
                        {[
                          { id: 'week', label: 'Week' },
                          { id: 'month', label: 'Month' },
                          { id: 'all', label: 'All' },
                        ].map(p => (
                          <button
                            key={p.id}
                            className={`section-toggle__btn ${trendPeriod === p.id ? 'section-toggle__btn--active' : ''}`}
                            onClick={() => setTrendPeriod(p.id)}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(() => {
                      const trendData = trendPeriod === 'week' ? (data.daily_trend || [])
                        : trendPeriod === 'all' ? (data.monthly_trend || data.weekly_trend || [])
                        : (data.weekly_trend || [])
                      if (!trendData.length) return (
                        <div className="empty-state" style={{ padding: '2rem' }}>
                          <div className="empty-state__text">No trend data for this period</div>
                        </div>
                      )
                      return (
                        <ResponsiveContainer width="100%" height={240}>
                          <AreaChart data={trendData}>
                            <defs>
                              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#B8926A" stopOpacity={0.15} />
                                <stop offset="100%" stopColor="#B8926A" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F0F0EC" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9B9B9B', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#9B9B9B', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="visitors" stroke="#B8926A" strokeWidth={2} fill="url(#areaGrad)" dot={{ fill: '#B8926A', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      )
                    })()}
                  </div>
                </div>

                {/* Activity Carousels */}
                {(() => {
                  const past = (data.recent_activity || []).filter(a => new Date(a.date) <= new Date())
                  const showings = past.filter(a => a.type === 'showing' || a.type === 'agent_preview')
                  const openHouses = past.filter(a => a.type === 'open_house')
                  const brokerOpens = past.filter(a => a.type === 'broker_open')
                  return (
                    <>
                      <ActivityCarousel title="Showings & Previews" activities={showings} color="#B8926A" />
                      <ActivityCarousel title="Open Houses" activities={openHouses} color="#5B7FA5" />
                      <ActivityCarousel title="Broker Opens" activities={brokerOpens} color="#4A7C59" />
                      {past.length === 0 && (
                        <div className="empty-state">
                          <Calendar size={32} strokeWidth={1} />
                          <div className="empty-state__text" style={{ marginTop: '0.75rem' }}>No activity to display yet</div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </>
            )}

            {/* ─── Activity Tab ─────────────────────────────────────────────── */}
            {activeTab === 'activity' && (
              <>
                {/* Calendar View */}
                <CalendarView activities={data.recent_activity || []} />

                {/* Grouped Activity Cards */}
                {(() => {
                  const all = data.recent_activity || []
                  const showings = all.filter(a => a.type === 'showing')
                  const previews = all.filter(a => a.type === 'agent_preview')
                  const openHouses = all.filter(a => a.type === 'open_house')
                  const brokerOpens = all.filter(a => a.type === 'broker_open')

                  const renderGroup = (title, acts, color) => {
                    if (!acts.length) return null
                    return (
                      <div style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.15rem', fontWeight: 500, color: '#1A1A1A' }}>{title}</h3>
                          <span style={{ fontSize: '0.72rem', background: `${color}15`, color, padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>{acts.length}</span>
                        </div>
                        <div style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
                          {acts.map(act => <ActivityDetailCard key={act.id} act={act} color={color} />)}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <>
                      {renderGroup('Showings', showings, '#B8926A')}
                      {renderGroup('Open Houses', openHouses, '#5B7FA5')}
                      {renderGroup('Agent Previews', previews, '#8B6F47')}
                      {renderGroup('Broker Opens', brokerOpens, '#4A7C59')}
                      {all.length === 0 && (
                        <div className="empty-state" style={{ paddingTop: '3rem' }}>
                          <Calendar size={40} strokeWidth={1} />
                          <div className="empty-state__text" style={{ marginTop: '1rem' }}>Activity updates will appear here as they're added</div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </>
            )}

            {/* ─── Marketing Tab ────────────────────────────────────────────── */}
            {activeTab === 'marketing' && (
              <>
                <div className="section-header">
                  <h2 className="section-title">Marketing Efforts</h2>
                </div>
                {data.marketing?.length > 0 ? (
                  <div className="marketing-grid">
                    {data.marketing.map(item => (
                      <div key={item.id} className="marketing-card">
                        <div className="marketing-card__type">{item.type?.replace(/_/g, ' ')}</div>
                        <div className="marketing-card__title">{item.title}</div>
                        {item.description && <div className="marketing-card__desc">{item.description}</div>}
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--client-gold)', display: 'inline-block', marginTop: '0.75rem' }}>
                            View →
                          </a>
                        )}
                        {item.date && <div className="marketing-card__date">{formatDate(item.date)}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state" style={{ paddingTop: '3rem' }}>
                    <Megaphone size={40} strokeWidth={1} />
                    <div className="empty-state__text" style={{ marginTop: '1rem' }}>Marketing updates will be shared here</div>
                  </div>
                )}
              </>
            )}

            {/* ─── Gallery Tab ──────────────────────────────────────────────── */}
            {activeTab === 'gallery' && (
              <>
                <div className="section-header">
                  <h2 className="section-title">Photo Gallery</h2>
                </div>

                {data.photos?.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ borderRadius: 'var(--client-radius-lg)', overflow: 'hidden', boxShadow: 'var(--client-shadow-lg)' }}>
                      <img src={data.photos[0].url} alt={data.property.address} style={{ width: '100%', maxHeight: '500px', objectFit: 'cover', display: 'block' }} />
                    </div>
                  </div>
                )}

                {/* Multiple Gallery Links */}
                {(data.gallery_links || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(data.gallery_links || []).map(link => (
                      <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        padding: '20px 24px', background: 'var(--client-surface)',
                        borderRadius: 'var(--client-radius)', border: '1px solid var(--client-border-light)',
                        boxShadow: 'var(--client-shadow)', textDecoration: 'none',
                        transition: 'all 0.15s ease'
                      }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--client-gold-light)'; e.currentTarget.style.boxShadow = 'var(--client-shadow-lg)' }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--client-border-light)'; e.currentTarget.style.boxShadow = 'var(--client-shadow)' }}
                      >
                        <div style={{
                          width: 44, height: 44, borderRadius: 10,
                          background: 'var(--client-gold-subtle)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <Camera size={20} color="var(--client-gold)" strokeWidth={1.5} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.15rem', fontWeight: 500, color: 'var(--client-text)' }}>
                            {link.title}
                          </div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--client-text-muted)', marginTop: 1 }}>
                            View photos →
                          </div>
                        </div>
                        <div style={{
                          padding: '8px 18px', background: 'var(--client-gold)', color: 'white',
                          borderRadius: 8, fontSize: '0.85rem', fontWeight: 500, fontFamily: 'DM Sans, sans-serif',
                          flexShrink: 0
                        }}>
                          Open
                        </div>
                      </a>
                    ))}
                  </div>
                ) : data.property.gallery_url ? (
                  /* Fallback: legacy single gallery_url */
                  <div style={{ background: 'var(--client-surface)', borderRadius: 'var(--client-radius)', padding: '2rem', boxShadow: 'var(--client-shadow)', border: '1px solid var(--client-border-light)', textAlign: 'center' }}>
                    <Camera size={32} strokeWidth={1} style={{ color: 'var(--client-gold)', marginBottom: '0.75rem' }} />
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--client-text)' }}>View Full Photo Gallery</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--client-text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>Browse all professional photos of your property</div>
                    <a href={data.property.gallery_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', background: 'var(--client-gold)', color: 'white', borderRadius: '10px', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', fontWeight: 500 }}>Open Gallery →</a>
                  </div>
                ) : !data.photos?.length ? (
                  <div className="empty-state" style={{ paddingTop: '3rem' }}>
                    <Camera size={40} strokeWidth={1} />
                    <div className="empty-state__text" style={{ marginTop: '1rem' }}>Professional photos will be added here</div>
                  </div>
                ) : null}
              </>
            )}
          </>
            )}

            {/* ─── PENDING PHASE ─────────────────────────────────────────────── */}
            {data.property.phase === 'pending' && (
              <>
                {/* Closing Countdown */}
                {(() => {
                  const milestones = data.pending_milestones || []
                  const completed = milestones.filter(m => m.status === 'complete' || m.status === 'waived').length
                  const total = milestones.length
                  const closingMs = milestones.find(m => m.milestone_type === 'closing')
                  const closingDate = closingMs?.due_date
                  const daysUntilClose = closingDate ? Math.max(0, Math.ceil((new Date(closingDate + 'T00:00') - new Date()) / 86400000)) : null
                  const nextMs = milestones.find(m => m.status !== 'complete' && m.status !== 'waived' && m.due_date)
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                  return (
                    <div style={{ marginBottom: '2rem' }}>
                      <div className="stats-grid">
                        {daysUntilClose !== null && (
                          <div className="stat-card">
                            <div className="stat-card__label">Days to Closing</div>
                            <div className="stat-card__value" style={{ color: '#7F77DD' }}>{daysUntilClose}</div>
                            <div className="stat-card__sub">{closingDate && new Date(closingDate + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                          </div>
                        )}
                        <div className="stat-card">
                          <div className="stat-card__label">Transaction Progress</div>
                          <div className="stat-card__value">{pct}%</div>
                          <div className="stat-card__sub">{completed} of {total} milestones complete</div>
                        </div>
                        {nextMs && (
                          <div className="stat-card">
                            <div className="stat-card__label">Next Milestone</div>
                            <div className="stat-card__value" style={{ fontSize: '1.3rem' }}>{nextMs.title}</div>
                            <div className="stat-card__sub">{nextMs.due_date && new Date(nextMs.due_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          </div>
                        )}
                      </div>

                      {/* Closing progress bar */}
                      {total > 0 && (
                        <div style={{ marginTop: '1.5rem', padding: '0 2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', color: '#9B9B9B' }}>
                            <span>Under contract</span>
                            <span>Closing day</span>
                          </div>
                          <div style={{ height: 8, background: '#F0F0EC', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #7F77DD, #AFA9EC)', borderRadius: 4, transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Milestone Timeline */}
                <div className="section-header">
                  <h2 className="section-title">Transaction Timeline</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {(data.pending_milestones || []).map((m, idx, arr) => {
                    const isComplete = m.status === 'complete' || m.status === 'waived'
                    const isLast = idx === arr.length - 1
                    const isPast = m.due_date && new Date(m.due_date + 'T00:00') < new Date() && !isComplete
                    return (
                      <div key={m.id} style={{ display: 'flex', gap: '1rem' }}>
                        {/* Timeline line */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                            background: isComplete ? '#4A7C59' : isPast ? '#C75B5B' : '#E0DCD4',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {isComplete && <CheckCircle size={14} color="#fff" />}
                          </div>
                          {!isLast && (
                            <div style={{ width: 2, flex: 1, minHeight: 40, background: isComplete ? '#4A7C59' : '#E0DCD4' }} />
                          )}
                        </div>
                        {/* Content */}
                        <div style={{
                          flex: 1, paddingBottom: isLast ? 0 : '1.25rem',
                          padding: '0 0 1.25rem'
                        }}>
                          <div style={{
                            fontWeight: 500, fontSize: '0.95rem', color: '#1A1A1A',
                            textDecoration: isComplete ? 'line-through' : 'none',
                            opacity: isComplete ? 0.6 : 1,
                            marginTop: -2
                          }}>{m.title}</div>
                          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 3, flexWrap: 'wrap' }}>
                            {m.due_date && (
                              <span style={{
                                fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace',
                                color: isPast ? '#C75B5B' : '#9B9B9B'
                              }}>
                                {new Date(m.due_date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                            <span style={{
                              fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                              padding: '2px 8px', borderRadius: 100,
                              background: isComplete ? 'rgba(74, 124, 89, 0.1)' : m.status === 'waived' ? 'rgba(155, 155, 155, 0.1)' : m.status === 'in_progress' ? 'rgba(127, 119, 221, 0.1)' : 'rgba(155, 155, 155, 0.1)',
                              color: isComplete ? '#4A7C59' : m.status === 'waived' ? '#9B9B9B' : m.status === 'in_progress' ? '#7F77DD' : '#9B9B9B'
                            }}>
                              {m.status === 'in_progress' ? 'In Progress' : m.status}
                            </span>
                          </div>
                          {m.notes && (
                            <div style={{ fontSize: '0.82rem', color: '#9B9B9B', marginTop: 4 }}>{m.notes}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {(!data.pending_milestones || data.pending_milestones.length === 0) && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9B9B9B', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem' }}>
                      Your transaction timeline is being set up. Check back soon.
                    </div>
                  )}
                </div>

                {/* Key Transaction Dates */}
                {(data.property.mutual_date || data.property.inspection_deadline || data.property.earnest_money_date || data.property.closing_date) && (
                  <div style={{ marginTop: '2rem' }}>
                    <div className="section-header">
                      <h2 className="section-title">Key Dates</h2>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                      {[
                        { label: 'Mutual Acceptance', date: data.property.mutual_date },
                        { label: 'Inspection Deadline', date: data.property.inspection_deadline },
                        { label: 'Earnest Money Due', date: data.property.earnest_money_date },
                        { label: 'Closing Date', date: data.property.closing_date },
                      ].filter(d => d.date).map((d, i) => {
                        const days = Math.ceil((new Date(d.date + 'T00:00') - new Date()) / 86400000)
                        const isPast = days < 0
                        return (
                          <div key={i} style={{
                            padding: '16px 18px', background: 'white', borderRadius: 10,
                            border: '1px solid #F0F0EC'
                          }}>
                            <div style={{ fontSize: '0.78rem', color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: 4 }}>{d.label}</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A1A1A' }}>
                              {new Date(d.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: isPast ? '#C75B5B' : '#9B9B9B', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                              {isPast ? `${Math.abs(days)}d ago` : `${days}d away`}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Inspection Response Status */}
                {data.property.inspection_response_received && data.property.inspection_response_date && (
                  <div style={{
                    marginTop: '1rem', padding: '14px 18px', background: 'rgba(74, 124, 89, 0.06)',
                    borderRadius: 10, border: '1px solid rgba(74, 124, 89, 0.15)',
                    display: 'flex', alignItems: 'center', gap: '0.75rem'
                  }}>
                    <CheckCircle size={18} color="#4A7C59" />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#1A1A1A' }}>Inspection Response Received</div>
                      <div style={{ fontSize: '0.8rem', color: '#9B9B9B', marginTop: 2 }}>
                        Response deadline: {new Date(data.property.inspection_response_date + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Sections for Pending */}
                {(data.custom_sections || []).filter(s => s.phase === 'pending').length > 0 && (
                  <div style={{ marginTop: '2rem' }}>
                    {(data.custom_sections || []).filter(s => s.phase === 'pending').map(section => (
                      <div key={section.id} style={{ marginBottom: '1.5rem' }}>
                        <div className="section-header">
                          <h2 className="section-title">{section.title}</h2>
                        </div>
                        {section.section_type === 'date' ? (
                          <div style={{
                            padding: '18px 22px', background: 'white', borderRadius: 10,
                            border: '1px solid #F0F0EC', display: 'flex', alignItems: 'center', gap: '1rem'
                          }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 10, background: 'rgba(127, 119, 221, 0.08)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              <Calendar size={20} color="#7F77DD" />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#1A1A1A' }}>
                                {section.date_value
                                  ? new Date(section.date_value + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                                  : 'Date to be confirmed'
                                }
                              </div>
                              {section.date_value && (() => {
                                const days = Math.ceil((new Date(section.date_value + 'T00:00') - new Date()) / 86400000)
                                return days >= 0
                                  ? <div style={{ fontSize: '0.82rem', color: '#9B9B9B', marginTop: 2 }}>{days} days away</div>
                                  : <div style={{ fontSize: '0.82rem', color: '#C75B5B', marginTop: 2 }}>{Math.abs(days)} days ago</div>
                              })()}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {(section.items || []).map(item => (
                              <div key={item.id} style={{
                                display: 'flex', alignItems: 'center', gap: '1rem',
                                padding: '14px 18px', background: 'white', borderRadius: 10,
                                border: '1px solid #F0F0EC',
                                opacity: item.status === 'complete' ? 0.65 : 1
                              }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                                  border: item.status === 'complete' ? 'none' : '2px solid #E0DCD4',
                                  background: item.status === 'complete' ? '#4A7C59' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                  {item.status === 'complete' && <CheckCircle size={16} color="#fff" />}
                                </div>
                                <span style={{
                                  fontSize: '0.92rem', color: '#1A1A1A',
                                  textDecoration: item.status === 'complete' ? 'line-through' : 'none'
                                }}>{item.title}</span>
                              </div>
                            ))}
                            {(!section.items || section.items.length === 0) && (
                              <div style={{ padding: '1rem', color: '#9B9B9B', fontSize: '0.88rem' }}>Items coming soon.</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Client Navigation Component ────────────────────────────────────────────

function ClientNav({ user, properties = [], selectedProperty, onPropertyChange, onLogout }) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <nav className="client-nav">
      <div className="client-nav__brand">
        <span className="client-nav__logo">DC Concierge</span>
        <span className="client-nav__divider" />
        <span className="client-nav__subtitle">Seller Portal</span>
      </div>
      <div className="client-nav__actions">
        {properties.length > 1 && (
          <select
            className="client-nav__property-switch"
            value={selectedProperty || ''}
            onChange={e => onPropertyChange(Number(e.target.value))}
          >
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.address}</option>
            ))}
          </select>
        )}
        <div style={{ position: 'relative' }}>
          <button className="client-nav__user-btn" onClick={() => setShowMenu(!showMenu)}>
            {user?.full_name?.charAt(0) || '?'}
          </button>
          {showMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              background: 'white',
              border: '1px solid var(--client-border)',
              borderRadius: 'var(--client-radius-sm)',
              padding: '0.5rem',
              minWidth: 180,
              boxShadow: 'var(--client-shadow-lg)',
              zIndex: 200
            }}>
              <div style={{ padding: '8px 12px', fontSize: '0.85rem', color: 'var(--client-text-muted)', borderBottom: '1px solid var(--client-border-light)', marginBottom: '0.25rem' }}>
                {user?.full_name}
              </div>
              <button
                onClick={onLogout}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  border: 'none',
                  background: 'none',
                  color: 'var(--client-text)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  borderRadius: 6,
                  fontFamily: 'DM Sans'
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--client-surface-hover)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
