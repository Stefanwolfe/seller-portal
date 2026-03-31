import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../utils/AuthContext'
import api from '../utils/api'
import { Home, Users, FileText, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'

function AdminNav() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const links = [
    { path: '/admin', label: 'Dashboard' },
    { path: '/admin/properties', label: 'Properties' },
    { path: '/admin/activities', label: 'Activities' },
    { path: '/admin/clients', label: 'Clients' },
  ]

  return (
    <nav className="admin-nav">
      <div className="admin-nav__brand">DC Concierge Admin</div>
      <div className="admin-nav__links">
        {links.map(l => (
          <Link
            key={l.path}
            to={l.path}
            className={`admin-nav__link ${location.pathname === l.path ? 'admin-nav__link--active' : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div className="admin-nav__right">
        <span className="admin-nav__user">{user?.full_name}</span>
        <button className="admin-nav__logout" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
      </div>
    </nav>
  )
}

export { AdminNav }

export default function AdminDashboard() {
  const [properties, setProperties] = useState([])
  const [pendingActivities, setPending] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getProperties(),
      api.getActivities(null, true),
    ]).then(([props, acts]) => {
      setProperties(props)
      setPending(acts)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const activeCount = properties.filter(p => p.status === 'Active').length
  const pendingCount = properties.filter(p => p.status === 'Pending').length

  return (
    <div className="admin-portal">
      <AdminNav />
      <div className="admin-page">
        <div className="admin-page__header">
          <h1 className="admin-page__title">Dashboard</h1>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Listings', value: properties.length, icon: Home, color: 'var(--admin-gold)' },
            { label: 'Active', value: activeCount, icon: CheckCircle, color: 'var(--admin-success)' },
            { label: 'Pending', value: pendingCount, icon: AlertCircle, color: 'var(--admin-warning)' },
            { label: 'Needs Approval', value: pendingActivities.length, icon: FileText, color: 'var(--admin-danger)' },
          ].map((s, i) => (
            <div key={i} className="admin-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: `${s.color}15`, borderRadius: 8, padding: 10 }}>
                <s.icon size={20} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--admin-text-muted)', fontFamily: 'Outfit', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: '1.5rem', fontFamily: 'JetBrains Mono', fontWeight: 500 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pending Approvals */}
        {pendingActivities.length > 0 && (
          <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1.1rem' }}>Pending Approval</h3>
              <Link to="/admin/activities" className="btn btn--ghost btn--small">View All <ArrowRight size={12} /></Link>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Brokerage</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {pendingActivities.slice(0, 5).map(act => {
                  const prop = properties.find(p => p.id === act.property_id)
                  return (
                    <tr key={act.id}>
                      <td style={{ color: 'var(--admin-gold)' }}>{prop?.address || `Property #${act.property_id}`}</td>
                      <td>{act.activity_type?.replace(/_/g, ' ')}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>{new Date(act.activity_date).toLocaleDateString()}</td>
                      <td>{act.brokerage || '—'}</td>
                      <td><span className="badge badge--pending">{act.source}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Properties List */}
        <div className="admin-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1.1rem' }}>Listings</h3>
            <Link to="/admin/properties" className="btn btn--primary btn--small">Manage Properties</Link>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>Status</th>
                <th>List Price</th>
                <th>Showings</th>
                <th>Pending</th>
                <th>Photos</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {properties.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.address}</td>
                  <td>
                    <span className={`badge ${p.status === 'Active' ? 'badge--approved' : p.status === 'Pending' ? 'badge--pending' : 'badge--pushed'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem' }}>
                    {p.list_price ? `$${Number(p.list_price).toLocaleString()}` : '—'}
                  </td>
                  <td>{p.total_showings}</td>
                  <td>
                    {p.pending_approval > 0 ? (
                      <span style={{ color: 'var(--admin-warning)', fontWeight: 500 }}>{p.pending_approval}</span>
                    ) : '—'}
                  </td>
                  <td>{p.photo_count}</td>
                  <td>
                    <Link to={`/admin/properties/${p.id}`} className="btn btn--ghost btn--small">
                      Manage <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
              {properties.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>No properties yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
