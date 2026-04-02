import React, { useState, useEffect, useRef } from 'react'
import { AdminNav } from './AdminDashboard'
import api from '../utils/api'
import { Check, Send, Trash2, Edit3, X, Filter, Upload } from 'lucide-react'

export default function AdminActivities() {
  const [activities, setActivities] = useState([])
  const [properties, setProperties] = useState([])
  const [filterProp, setFilterProp] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [editingActivity, setEditingActivity] = useState(null)
  const [editFeedback, setEditFeedback] = useState('')

  // ShowingTime import
  const stRef = useRef()
  const [stImporting, setStImporting] = useState(false)
  const [stResult, setStResult] = useState(null)

  const load = async () => {
    const [acts, props] = await Promise.all([
      api.getActivities(filterProp || undefined, filterStatus === 'pending'),
      api.getProperties()
    ])
    setActivities(acts)
    setProperties(props)
    setLoading(false)
  }

  useEffect(() => { load() }, [filterProp, filterStatus])

  const handleShowingTimeImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setStImporting(true)
    setStResult(null)
    try {
      const result = await api.importShowingTime(file)
      setStResult(result)
      load()
    } catch (err) {
      alert(err.message)
    } finally {
      setStImporting(false)
      if (stRef.current) stRef.current.value = ''
    }
  }

  const filtered = filterStatus === 'all' ? activities
    : filterStatus === 'pending' ? activities.filter(a => !a.is_approved)
    : filterStatus === 'approved' ? activities.filter(a => a.is_approved && !a.is_pushed)
    : activities.filter(a => a.is_pushed)

  const handleApprove = (act) => {
    setEditingActivity(act)
    setEditFeedback(act.feedback_draft || act.feedback_raw || '')
  }

  const handleSaveApproval = async () => {
    await api.updateActivity(editingActivity.id, { feedback_approved: editFeedback, is_approved: true })
    setEditingActivity(null)
    load()
  }

  const handlePush = async (id) => {
    await api.updateActivity(id, { is_pushed: true })
    load()
  }

  const getPropName = (propId) => properties.find(p => p.id === propId)?.address || `#${propId}`

  return (
    <div className="admin-portal">
      <AdminNav />
      <div className="admin-page">
        <div className="admin-page__header">
          <h1 className="admin-page__title">Activity Management</h1>
          <button className="btn btn--primary" onClick={() => stRef.current?.click()} disabled={stImporting} style={{ marginLeft: 'auto' }}>
            <Upload size={14} /> {stImporting ? 'Importing...' : 'Import ShowingTime PDF'}
          </button>
          <input ref={stRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleShowingTimeImport} />
        </div>

        {/* ShowingTime Import Results */}
        {stResult && (
          <div className="admin-card" style={{ marginBottom: '1rem', borderColor: stResult.created > 0 ? 'var(--admin-success)' : 'var(--admin-warning)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem' }}>ShowingTime Import Results</h3>
              <button onClick={() => setStResult(null)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <div><span style={{ fontWeight: 600, color: 'var(--admin-success)' }}>{stResult.created}</span> created</div>
              {stResult.skipped_cancelled > 0 && <div><span style={{ fontWeight: 600, color: 'var(--admin-text-muted)' }}>{stResult.skipped_cancelled}</span> cancelled (skipped)</div>}
              {stResult.skipped_duplicate > 0 && <div><span style={{ fontWeight: 600, color: 'var(--admin-text-muted)' }}>{stResult.skipped_duplicate}</span> duplicates (skipped)</div>}
              {stResult.updated > 0 && <div><span style={{ fontWeight: 600, color: '#5B7FA5' }}>{stResult.updated}</span> updated (added missing data)</div>}
              {stResult.skipped_no_match > 0 && <div><span style={{ fontWeight: 600, color: 'var(--admin-warning)' }}>{stResult.skipped_no_match}</span> no property match</div>}
            </div>
            {stResult.details?.length > 0 && (
              <div style={{ background: 'var(--admin-bg)', borderRadius: 6, padding: '8px 12px', fontSize: '0.78rem', color: 'var(--admin-text-secondary)', maxHeight: 200, overflow: 'auto', fontFamily: 'JetBrains Mono' }}>
                {stResult.details.map((d, i) => <div key={i}>{d}</div>)}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <select className="form-select" style={{ width: 250 }} value={filterProp} onChange={e => setFilterProp(e.target.value)}>
            <option value="">All Properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
          </select>
          <div style={{ display: 'flex', background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: 6, padding: 2 }}>
            {['pending', 'approved', 'pushed', 'all'].map(s => (
              <button
                key={s}
                className={`admin-nav__link ${filterStatus === s ? 'admin-nav__link--active' : ''}`}
                onClick={() => setFilterStatus(s)}
                style={{ border: 'none', cursor: 'pointer', background: filterStatus === s ? 'var(--admin-gold-dim)' : 'none', textTransform: 'capitalize' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Date</th>
                <th>Type</th>
                <th>Brokerage</th>
                <th>Source</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(act => (
                <tr key={act.id}>
                  <td style={{ color: 'var(--admin-gold)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getPropName(act.property_id)}</td>
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>{new Date(act.activity_date).toLocaleDateString()}</td>
                  <td>{act.activity_type?.replace(/_/g, ' ')}</td>
                  <td>{act.brokerage || '—'}</td>
                  <td><span className="badge badge--pending">{act.source}</span></td>
                  <td>
                    {act.is_pushed ? <span className="badge badge--pushed">Pushed</span>
                      : act.is_approved ? <span className="badge badge--approved">Approved</span>
                      : <span className="badge badge--pending">Pending</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!act.is_approved && (
                        <button className="btn btn--success btn--small" onClick={() => handleApprove(act)}><Edit3 size={12} /> Review</button>
                      )}
                      {act.is_approved && !act.is_pushed && (
                        <button className="btn btn--primary btn--small" onClick={() => handlePush(act.id)}><Send size={12} /> Push</button>
                      )}
                      <button className="btn btn--danger btn--small" onClick={async () => { if(confirm('Delete?')){ await api.deleteActivity(act.id); load(); } }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>
                  {filterStatus === 'pending' ? 'No pending activities' : 'No activities found'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Review Modal */}
        {editingActivity && (
          <div className="modal-overlay" onClick={() => setEditingActivity(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h3 className="modal__title">Review Feedback</h3>
                <button className="modal__close" onClick={() => setEditingActivity(null)}><X size={18} /></button>
              </div>
              <div className="modal__body">
                <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
                  {getPropName(editingActivity.property_id)} · {editingActivity.activity_type?.replace(/_/g, ' ')} · {editingActivity.brokerage}
                </div>
                {editingActivity.feedback_raw && (
                  <div className="form-group">
                    <label className="form-label">Raw Feedback</label>
                    <div style={{ background: 'var(--admin-bg)', borderRadius: 6, padding: '10px 12px', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', lineHeight: 1.5 }}>
                      {editingActivity.feedback_raw}
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Client-Facing Version</label>
                  <textarea className="form-textarea" value={editFeedback} onChange={e => setEditFeedback(e.target.value)} rows={5} style={{ minHeight: 120 }} />
                </div>
              </div>
              <div className="modal__footer">
                <button className="btn btn--ghost" onClick={() => setEditingActivity(null)}>Cancel</button>
                <button className="btn btn--success" onClick={handleSaveApproval}><Check size={14} /> Approve</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
