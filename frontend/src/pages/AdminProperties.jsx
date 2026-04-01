import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AdminNav } from './AdminDashboard'
import api from '../utils/api'
import DatePicker from '../components/DatePicker'
import { Plus, Search, X } from 'lucide-react'

export default function AdminProperties() {
  const [properties, setProperties] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ address: '', street_number: '', city: '', state: 'WA', zip_code: '', mls_number: '', list_price: '', list_date: '', status: 'Active', bedrooms: '', bathrooms: '', sqft: '', gallery_url: '' })
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const load = () => {
    const params = statusFilter || undefined
    // If filtering for archived, we need to pass include_archived
    if (statusFilter === 'Archived') {
      return api.request(`/properties?status=Archived&include_archived=true`).then(setProperties)
    }
    return api.getProperties(params).then(setProperties)
  }
  useEffect(() => { load() }, [statusFilter])

  const filtered = properties.filter(p =>
    p.address.toLowerCase().includes(search.toLowerCase()) ||
    p.mls_number?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { ...form }
      if (data.list_price) data.list_price = parseFloat(data.list_price)
      if (data.bedrooms) data.bedrooms = parseInt(data.bedrooms)
      if (data.bathrooms) data.bathrooms = parseFloat(data.bathrooms)
      if (data.sqft) data.sqft = parseInt(data.sqft)
      // Clean empty strings
      Object.keys(data).forEach(k => { if (data[k] === '') delete data[k] })
      const result = await api.createProperty(data)
      setShowModal(false)
      setForm({ address: '', street_number: '', city: '', state: 'WA', zip_code: '', mls_number: '', list_price: '', list_date: '', status: 'Active', bedrooms: '', bathrooms: '', sqft: '', gallery_url: '' })
      navigate(`/admin/properties/${result.id}`)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-portal">
      <AdminNav />
      <div className="admin-page">
        <div className="admin-page__header">
          <h1 className="admin-page__title">Properties</h1>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Property</button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search by address or MLS..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Coming Soon">Coming Soon</option>
            <option value="Sold">Sold</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        {/* Properties Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filtered.map(p => (
            <Link key={p.id} to={`/admin/properties/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="admin-card" style={{ cursor: 'pointer', transition: 'border-color 0.15s', opacity: p.is_archived ? 0.6 : 1 }}
                onMouseOver={e => e.currentTarget.style.borderColor = 'var(--admin-gold)'}
                onMouseOut={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
              >
                {p.hero_photo_url ? (
                  <img src={p.hero_photo_url} alt="" style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6, marginBottom: '0.75rem' }} />
                ) : (
                  <div style={{ width: '100%', height: 140, background: 'var(--admin-surface-hover)', borderRadius: 6, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-muted)' }}>No photos</div>
                )}
                <div style={{ fontWeight: 500, marginBottom: 4 }}>{p.address}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${p.is_archived ? 'badge--archived' : p.status === 'Active' ? 'badge--approved' : p.status === 'Pending' ? 'badge--pending' : 'badge--pushed'}`}>{p.is_archived ? 'Archived' : p.status}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontSize: '0.85rem', color: 'var(--admin-gold)' }}>
                    {p.list_price ? `$${Number(p.list_price).toLocaleString()}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
                  <span>{p.total_showings} showings</span>
                  <span>{p.photo_count} photos</span>
                  {p.pending_approval > 0 && <span style={{ color: 'var(--admin-warning)' }}>{p.pending_approval} pending</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h3 className="modal__title">Add New Property</h3>
                <button className="modal__close" onClick={() => setShowModal(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal__body">
                  <div className="form-group">
                    <label className="form-label">Address *</label>
                    <input className="form-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">Street #</label>
                      <input className="form-input" value={form.street_number} onChange={e => setForm({...form, street_number: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <input className="form-input" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Zip</label>
                      <input className="form-input" value={form.zip_code} onChange={e => setForm({...form, zip_code: e.target.value})} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">MLS Number</label>
                      <input className="form-input" value={form.mls_number} onChange={e => setForm({...form, mls_number: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">List Price</label>
                      <input className="form-input" type="number" value={form.list_price} onChange={e => setForm({...form, list_price: e.target.value})} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">List Date</label>
                      <DatePicker value={form.list_date} onChange={v => setForm({...form, list_date: v})} placeholder="Select list date" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select className="form-select" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                        <option>Coming Soon</option>
                        <option>Active</option>
                        <option>Pending</option>
                        <option>Sold</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">Beds</label>
                      <input className="form-input" type="number" value={form.bedrooms} onChange={e => setForm({...form, bedrooms: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Baths</label>
                      <input className="form-input" type="number" step="0.5" value={form.bathrooms} onChange={e => setForm({...form, bathrooms: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sqft</label>
                      <input className="form-input" type="number" value={form.sqft} onChange={e => setForm({...form, sqft: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Photo Gallery URL (Autofocus, etc.)</label>
                    <input className="form-input" value={form.gallery_url} onChange={e => setForm({...form, gallery_url: e.target.value})} placeholder="https://autofocus.io/galleries/..." />
                  </div>
                </div>
                <div className="modal__footer">
                  <button type="button" className="btn btn--ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn--primary" disabled={saving}>{saving ? 'Creating...' : 'Create Property'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
