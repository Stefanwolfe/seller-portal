import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AdminNav } from './AdminDashboard'
import api from '../utils/api'
import { Upload, Trash2, Plus, Check, Send, X, ArrowLeft, Edit3, Image, Calendar, Megaphone, Users } from 'lucide-react'

export default function AdminPropertyDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef()

  const [property, setProperty] = useState(null)
  const [activities, setActivities] = useState([])
  const [marketing, setMarketing] = useState([])
  const [clients, setClients] = useState([])
  const [tab, setTab] = useState('activities')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  // Activity form
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [actForm, setActForm] = useState({ activity_type: 'showing', activity_date: '', brokerage: '', visitor_count: 1, feedback_raw: '' })

  // Marketing form
  const [showMarketingForm, setShowMarketingForm] = useState(false)
  const [mktForm, setMktForm] = useState({ item_type: 'professional_photos', title: '', description: '', url: '', completed_date: '' })

  // CSV import
  const csvRef = useRef()

  // Edit activity modal
  const [editingActivity, setEditingActivity] = useState(null)
  const [editFeedback, setEditFeedback] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [prop, acts, mkts, cls] = await Promise.all([
        api.getProperty(id),
        api.getActivities(id),
        api.getMarketing(id),
        api.getClients()
      ])
      setProperty(prop)
      setActivities(acts)
      setMarketing(mkts)
      setClients(cls)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      await api.uploadPhotos(id, files)
      await loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setUploading(false)
    }
  }

  const handleDeletePhoto = async (photoId) => {
    if (!confirm('Delete this photo?')) return
    await api.deletePhoto(photoId)
    loadData()
  }

  const handleCreateActivity = async (e) => {
    e.preventDefault()
    const data = { ...actForm, property_id: parseInt(id), visitor_count: parseInt(actForm.visitor_count) || 1 }
    if (!data.activity_date) { alert('Date is required'); return }
    data.activity_date = new Date(data.activity_date).toISOString()
    await api.createActivity(data)
    setShowActivityForm(false)
    setActForm({ activity_type: 'showing', activity_date: '', brokerage: '', visitor_count: 1, feedback_raw: '' })
    loadData()
  }

  const handleApproveActivity = async (act) => {
    const feedback = act.feedback_draft || act.feedback_raw || ''
    setEditingActivity(act)
    setEditFeedback(feedback)
  }

  const handleSaveApproval = async () => {
    await api.updateActivity(editingActivity.id, {
      feedback_approved: editFeedback,
      is_approved: true
    })
    setEditingActivity(null)
    loadData()
  }

  const handlePushActivity = async (actId) => {
    await api.updateActivity(actId, { is_pushed: true })
    loadData()
  }

  const handlePushAll = async () => {
    const approved = activities.filter(a => a.is_approved && !a.is_pushed)
    if (!approved.length) return
    await api.pushActivities(approved.map(a => a.id))
    loadData()
  }

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const result = await api.importCSV(id, file)
      alert(`Imported ${result.imported} activities`)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleCreateMarketing = async (e) => {
    e.preventDefault()
    const data = { ...mktForm, property_id: parseInt(id) }
    Object.keys(data).forEach(k => { if (data[k] === '') delete data[k] })
    await api.createMarketing(data)
    setShowMarketingForm(false)
    setMktForm({ item_type: 'professional_photos', title: '', description: '', url: '', completed_date: '' })
    loadData()
  }

  const handlePushMarketing = async (mktId) => {
    await api.pushMarketing(mktId)
    loadData()
  }

  const handleGrantAccess = async (userId) => {
    try {
      await api.grantAccess(userId, parseInt(id))
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading || !property) {
    return <div className="admin-portal"><AdminNav /><div className="admin-page" style={{ textAlign: 'center', paddingTop: '4rem', color: 'var(--admin-text-muted)' }}>Loading...</div></div>
  }

  const approvedNotPushed = activities.filter(a => a.is_approved && !a.is_pushed).length
  const pendingApproval = activities.filter(a => !a.is_approved).length

  return (
    <div className="admin-portal">
      <AdminNav />
      <div className="admin-page">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button className="btn btn--ghost btn--small" onClick={() => navigate('/admin/properties')}><ArrowLeft size={14} /> Back</button>
          <div style={{ flex: 1 }}>
            <h1 className="admin-page__title" style={{ marginBottom: 2 }}>{property.address}</h1>
            <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', fontFamily: 'JetBrains Mono' }}>
              {property.mls_number && `MLS #${property.mls_number} · `}
              {property.list_price && `$${Number(property.list_price).toLocaleString()} · `}
              {property.days_on_market} days on market
            </div>
          </div>
          <span className={`badge ${property.status === 'Active' ? 'badge--approved' : 'badge--pending'}`} style={{ fontSize: '0.8rem', padding: '4px 12px' }}>{property.status}</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.75rem' }}>
          {[
            { id: 'activities', label: 'Activities', icon: Calendar, count: pendingApproval },
            { id: 'photos', label: 'Photos', icon: Image, count: property.photos?.length },
            { id: 'marketing', label: 'Marketing', icon: Megaphone },
            { id: 'access', label: 'Client Access', icon: Users },
          ].map(t => (
            <button
              key={t.id}
              className={`admin-nav__link ${tab === t.id ? 'admin-nav__link--active' : ''}`}
              onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', border: 'none', background: tab === t.id ? 'var(--admin-gold-dim)' : 'none' }}
            >
              <t.icon size={14} /> {t.label}
              {t.count > 0 && <span style={{ background: 'var(--admin-gold)', color: '#1A1A1A', borderRadius: 100, padding: '1px 7px', fontSize: '0.7rem', fontWeight: 600 }}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* ─── Activities Tab ─────────────────────────────────────────────── */}
        {tab === 'activities' && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <button className="btn btn--primary" onClick={() => setShowActivityForm(true)}><Plus size={14} /> Add Activity</button>
              <button className="btn btn--ghost" onClick={() => csvRef.current?.click()}><Upload size={14} /> Import CSV</button>
              <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVImport} />
              {approvedNotPushed > 0 && (
                <button className="btn btn--success" onClick={handlePushAll}><Send size={14} /> Push {approvedNotPushed} to Client</button>
              )}
            </div>

            {/* Activity Form */}
            {showActivityForm && (
              <div className="admin-card" style={{ marginBottom: '1rem', borderColor: 'var(--admin-gold)' }}>
                <form onSubmit={handleCreateActivity}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Type</label>
                      <select className="form-select" value={actForm.activity_type} onChange={e => setActForm({...actForm, activity_type: e.target.value})}>
                        <option value="showing">Private Showing</option>
                        <option value="open_house">Open House</option>
                        <option value="broker_open">Broker Open</option>
                        <option value="agent_preview">Agent Preview</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Date</label>
                      <input className="form-input" type="datetime-local" value={actForm.activity_date} onChange={e => setActForm({...actForm, activity_date: e.target.value})} required />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Brokerage</label>
                      <input className="form-input" value={actForm.brokerage} onChange={e => setActForm({...actForm, brokerage: e.target.value})} placeholder="e.g. Windermere" />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Visitors</label>
                      <input className="form-input" type="number" min="1" value={actForm.visitor_count} onChange={e => setActForm({...actForm, visitor_count: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0, marginBottom: '0.75rem' }}>
                    <label className="form-label">Feedback (Alfred will draft a client-facing version)</label>
                    <textarea className="form-textarea" value={actForm.feedback_raw} onChange={e => setActForm({...actForm, feedback_raw: e.target.value})} placeholder="Raw feedback from the showing agent..." rows={3} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn--primary btn--small">Create</button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowActivityForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* Activities List */}
            <div className="admin-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Brokerage</th>
                    <th>Visitors</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map(act => (
                    <tr key={act.id}>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>{new Date(act.activity_date).toLocaleDateString()}</td>
                      <td>{act.activity_type?.replace(/_/g, ' ')}</td>
                      <td>{act.brokerage || '—'}</td>
                      <td>{act.visitor_count || 1}</td>
                      <td>
                        {act.is_pushed ? (
                          <span className="badge badge--pushed">Pushed</span>
                        ) : act.is_approved ? (
                          <span className="badge badge--approved">Approved</span>
                        ) : (
                          <span className="badge badge--pending">Pending</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {!act.is_approved && (
                            <button className="btn btn--success btn--small" onClick={() => handleApproveActivity(act)}>
                              <Edit3 size={12} /> Review
                            </button>
                          )}
                          {act.is_approved && !act.is_pushed && (
                            <button className="btn btn--primary btn--small" onClick={() => handlePushActivity(act.id)}>
                              <Send size={12} /> Push
                            </button>
                          )}
                          <button className="btn btn--danger btn--small" onClick={async () => { if(confirm('Delete?')){ await api.deleteActivity(act.id); loadData(); } }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {activities.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>No activities yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Edit/Approve Modal */}
            {editingActivity && (
              <div className="modal-overlay" onClick={() => setEditingActivity(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal__header">
                    <h3 className="modal__title">Review & Approve Feedback</h3>
                    <button className="modal__close" onClick={() => setEditingActivity(null)}><X size={18} /></button>
                  </div>
                  <div className="modal__body">
                    {editingActivity.feedback_raw && (
                      <div className="form-group">
                        <label className="form-label">Raw Feedback</label>
                        <div style={{ background: 'var(--admin-bg)', borderRadius: 6, padding: '10px 12px', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', lineHeight: 1.5 }}>
                          {editingActivity.feedback_raw}
                        </div>
                      </div>
                    )}
                    <div className="form-group">
                      <label className="form-label">Client-Facing Feedback (edit as needed)</label>
                      <textarea
                        className="form-textarea"
                        value={editFeedback}
                        onChange={e => setEditFeedback(e.target.value)}
                        rows={5}
                        style={{ minHeight: 120 }}
                      />
                    </div>
                  </div>
                  <div className="modal__footer">
                    <button className="btn btn--ghost" onClick={() => setEditingActivity(null)}>Cancel</button>
                    <button className="btn btn--success" onClick={handleSaveApproval}><Check size={14} /> Approve</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Photos Tab ─────────────────────────────────────────────────── */}
        {tab === 'photos' && (
          <>
            <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem', marginBottom: '1rem' }}>Photo Gallery Link</h3>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label className="form-label">Gallery URL (Autofocus, etc.)</label>
                  <input className="form-input" value={property.gallery_url || ''} onChange={e => setProperty({...property, gallery_url: e.target.value})} placeholder="https://autofocus.io/galleries/..." />
                </div>
                <button className="btn btn--primary" onClick={async () => { await api.updateProperty(id, { gallery_url: property.gallery_url || '' }); loadData(); }}>Save</button>
              </div>
              {property.gallery_url && (<div style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}><a href={property.gallery_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--admin-gold)' }}>View gallery \u2192</a></div>)}
            </div>
            <div className="admin-card">
              <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem', marginBottom: '1rem' }}>Hero Photo</h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>Upload one featured photo for the property card and client dashboard header.</div>
              {property.photos?.length > 0 ? (
                <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', maxWidth: 400, aspectRatio: '4/3' }}>
                  <img src={property.photos[0].url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => handleDeletePhoto(property.photos[0].id)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: 6, padding: 6, cursor: 'pointer' }}><Trash2 size={14} /></button>
                  <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--admin-gold)', color: '#1A1A1A', padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600 }}>HERO</div>
                </div>
              ) : (
                <>
                  <div className={`upload-zone ${uploading ? 'upload-zone--active' : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('upload-zone--active') }} onDragLeave={e => e.currentTarget.classList.remove('upload-zone--active')} onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('upload-zone--active'); const files = Array.from(e.dataTransfer.files).slice(0,1); if(files.length){ setUploading(true); api.uploadPhotos(id, files).then(() => loadData()).catch(err => alert(err.message)).finally(() => setUploading(false)); } }}>
                    <Upload size={24} style={{ marginBottom: 8 }} />
                    <div>{uploading ? 'Uploading...' : 'Drop hero photo here or click to upload'}</div>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const files = Array.from(e.target.files).slice(0,1); if(files.length){ setUploading(true); api.uploadPhotos(id, files).then(() => loadData()).catch(err => alert(err.message)).finally(() => setUploading(false)); } }} />
                </>
              )}
            </div>
          </>
        )}

        {/* ─── Marketing Tab ──────────────────────────────────────────────── */}
        {tab === 'marketing' && (
          <>
            <button className="btn btn--primary" style={{ marginBottom: '1rem' }} onClick={() => setShowMarketingForm(true)}><Plus size={14} /> Add Marketing Item</button>

            {showMarketingForm && (
              <div className="admin-card" style={{ marginBottom: '1rem', borderColor: 'var(--admin-gold)' }}>
                <form onSubmit={handleCreateMarketing}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Type</label>
                      <select className="form-select" value={mktForm.item_type} onChange={e => setMktForm({...mktForm, item_type: e.target.value})}>
                        <option value="professional_photos">Professional Photos</option>
                        <option value="virtual_tour">Virtual Tour</option>
                        <option value="3d_tour">3D Tour</option>
                        <option value="video">Video Tour</option>
                        <option value="flyer">Flyer</option>
                        <option value="social_media">Social Media</option>
                        <option value="email_blast">Email Blast</option>
                        <option value="print_ad">Print Ad</option>
                        <option value="signage">Signage</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Date</label>
                      <input className="form-input" type="date" value={mktForm.completed_date} onChange={e => setMktForm({...mktForm, completed_date: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Title</label>
                    <input className="form-input" value={mktForm.title} onChange={e => setMktForm({...mktForm, title: e.target.value})} required placeholder="e.g. Professional Photography Completed" />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Description</label>
                    <textarea className="form-textarea" value={mktForm.description} onChange={e => setMktForm({...mktForm, description: e.target.value})} rows={2} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">URL (optional)</label>
                    <input className="form-input" value={mktForm.url} onChange={e => setMktForm({...mktForm, url: e.target.value})} placeholder="https://..." />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn--primary btn--small">Create</button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowMarketingForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="admin-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {marketing.map(m => (
                    <tr key={m.id}>
                      <td>{m.item_type?.replace(/_/g, ' ')}</td>
                      <td>{m.title}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>{m.completed_date ? new Date(m.completed_date).toLocaleDateString() : '—'}</td>
                      <td>{m.is_pushed ? <span className="badge badge--pushed">Pushed</span> : <span className="badge badge--pending">Draft</span>}</td>
                      <td>
                        {!m.is_pushed && (
                          <button className="btn btn--primary btn--small" onClick={() => handlePushMarketing(m.id)}><Send size={12} /> Push</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {marketing.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>No marketing items yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── Client Access Tab ──────────────────────────────────────────── */}
        {tab === 'access' && (
          <>
            <div className="admin-card">
              <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem', marginBottom: '1rem' }}>Current Access</h3>
              {(() => {
                const withAccess = clients.filter(c => c.properties.some(p => p.id === parseInt(id)))
                if (withAccess.length === 0) return <div style={{ color: 'var(--admin-text-muted)', padding: '1rem 0' }}>No clients have access to this property yet</div>
                return (
                  <table className="admin-table">
                    <thead><tr><th>Name</th><th>Username</th><th>Email</th></tr></thead>
                    <tbody>
                      {withAccess.map(c => (
                        <tr key={c.id}>
                          <td>{c.full_name}</td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>{c.username}</td>
                          <td>{c.email || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>

            <div className="admin-card" style={{ marginTop: '1rem' }}>
              <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem', marginBottom: '1rem' }}>Grant Access</h3>
              {(() => {
                const withoutAccess = clients.filter(c => !c.properties.some(p => p.id === parseInt(id)))
                if (withoutAccess.length === 0) return <div style={{ color: 'var(--admin-text-muted)', padding: '1rem 0' }}>All registered clients already have access, or no clients registered yet</div>
                return (
                  <table className="admin-table">
                    <thead><tr><th>Name</th><th>Username</th><th></th></tr></thead>
                    <tbody>
                      {withoutAccess.map(c => (
                        <tr key={c.id}>
                          <td>{c.full_name}</td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>{c.username}</td>
                          <td><button className="btn btn--primary btn--small" onClick={() => handleGrantAccess(c.id)}>Grant Access</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
