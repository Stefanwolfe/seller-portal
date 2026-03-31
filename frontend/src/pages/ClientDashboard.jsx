import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../utils/AuthContext'
import api from '../utils/api'
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Home, Calendar, Users, Clock, Eye, TrendingUp, Camera, ChevronLeft, ChevronRight, X, LogOut, Image, Megaphone } from 'lucide-react'

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

export default function ClientDashboard() {
  const { user, logout, refreshUser } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedProperty, setSelectedProperty] = useState(null)
  const [breakdownPeriod, setBreakdownPeriod] = useState('this_week')
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
                <div className="client-hero__image-placeholder">
                  <Home size={48} strokeWidth={1} />
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
                    {data.property.status}
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

                  {/* Weekly Trend */}
                  <div className="chart-card">
                    <div className="chart-card__title">Weekly Trend</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={data.weekly_trend}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#B8926A" stopOpacity={0.15} />
                            <stop offset="100%" stopColor="#B8926A" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0EC" />
                        <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9B9B9B', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9B9B9B', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="visitors" stroke="#B8926A" strokeWidth={2} fill="url(#areaGrad)" dot={{ fill: '#B8926A', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="section-header">
                  <h2 className="section-title">Recent Activity</h2>
                </div>
                <div className="activity-feed">
                  {data.recent_activity?.length > 0 ? (
                    data.recent_activity.slice(0, 5).map(act => {
                      const Icon = ACTIVITY_ICONS[act.type] || Eye
                      return (
                        <div key={act.id} className="activity-item">
                          <div className={`activity-item__icon activity-item__icon--${act.type}`}>
                            <Icon size={18} />
                          </div>
                          <div className="activity-item__content">
                            <div className="activity-item__header">
                              <span className="activity-item__type">{ACTIVITY_LABELS[act.type] || act.type}</span>
                              <span className="activity-item__date">{formatDate(act.date)}</span>
                            </div>
                            {act.brokerage && <div className="activity-item__brokerage">{act.brokerage}</div>}
                            {act.feedback && <div className="activity-item__feedback">{act.feedback}</div>}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="empty-state">
                      <Calendar size={32} strokeWidth={1} />
                      <div className="empty-state__text" style={{ marginTop: '0.75rem' }}>No activity to display yet</div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ─── Activity Tab ─────────────────────────────────────────────── */}
            {activeTab === 'activity' && (
              <div className="activity-feed">
                <div className="section-header">
                  <h2 className="section-title">All Activity</h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--client-text-muted)' }}>
                    {data.recent_activity?.length || 0} total entries
                  </div>
                </div>
                {data.recent_activity?.length > 0 ? (
                  data.recent_activity.map(act => {
                    const Icon = ACTIVITY_ICONS[act.type] || Eye
                    return (
                      <div key={act.id} className="activity-item">
                        <div className={`activity-item__icon activity-item__icon--${act.type}`}>
                          <Icon size={18} />
                        </div>
                        <div className="activity-item__content">
                          <div className="activity-item__header">
                            <span className="activity-item__type">{ACTIVITY_LABELS[act.type] || act.type}</span>
                            <span className="activity-item__date">{formatDate(act.date)}</span>
                          </div>
                          {act.brokerage && <div className="activity-item__brokerage">{act.brokerage}</div>}
                          {act.visitor_count > 1 && <div className="activity-item__brokerage">{act.visitor_count} visitors</div>}
                          {act.feedback && <div className="activity-item__feedback">{act.feedback}</div>}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="empty-state" style={{ paddingTop: '3rem' }}>
                    <Calendar size={40} strokeWidth={1} />
                    <div className="empty-state__text" style={{ marginTop: '1rem' }}>Activity updates will appear here as they're added</div>
                  </div>
                )}
              </div>
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

                {data.property.gallery_url ? (
                  <div style={{ background: 'var(--client-surface)', borderRadius: 'var(--client-radius)', padding: '2rem', boxShadow: 'var(--client-shadow)', border: '1px solid var(--client-border-light)', textAlign: 'center' }}>
                    <Camera size={32} strokeWidth={1} style={{ color: 'var(--client-gold)', marginBottom: '0.75rem' }} />
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.3rem', fontWeight: 500, marginBottom: '0.5rem', color: 'var(--client-text)' }}>View Full Photo Gallery</div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--client-text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>Browse all professional photos of your property</div>
                    <a href={data.property.gallery_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', background: 'var(--client-gold)', color: 'white', borderRadius: '10px', textDecoration: 'none', fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', fontWeight: 500 }}>Open Gallery \u2192</a>
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
