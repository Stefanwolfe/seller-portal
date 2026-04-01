import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AdminNav } from './AdminDashboard'
import api from '../utils/api'
import { Upload, Trash2, Plus, Check, Send, X, ArrowLeft, Edit3, Image, Calendar, Megaphone, Users, Archive, RotateCcw, ListChecks, Flag, FileText, Receipt, Clock, ChevronDown, Paperclip } from 'lucide-react'

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

  // Archive / Delete confirmation
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTyped, setDeleteTyped] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Phase management
  const [phaseLoading, setPhaseLoading] = useState(false)

  // Pre-market task form
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', task_type: 'custom', scheduled_date: '', notes: '' })
  const TASK_TYPES = [
    { value: 'photography', label: 'Professional Photography' },
    { value: 'staging', label: 'Staging Consultation' },
    { value: 'repairs', label: 'Repairs / Improvements' },
    { value: 'inspection', label: 'Pre-listing Inspection' },
    { value: 'signage', label: 'Signage / Lockbox' },
    { value: 'custom', label: 'Custom Task' },
  ]

  // Pending milestone form
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState({ title: '', milestone_type: 'custom', due_date: '', notes: '' })
  const MILESTONE_TYPES = [
    { value: 'inspection', label: 'Inspection Deadline' },
    { value: 'financing', label: 'Financing Contingency' },
    { value: 'closing', label: 'Closing Date' },
    { value: 'walkthrough', label: 'Final Walkthrough' },
    { value: 'custom', label: 'Custom Milestone' },
  ]

  // Custom sections
  const [showCustomSectionForm, setShowCustomSectionForm] = useState(false)
  const [customSectionForm, setCustomSectionForm] = useState({ title: '', section_type: 'checklist', phase: 'pre_market', date_value: '' })
  const [newItemText, setNewItemText] = useState({})

  // Receipt upload
  const receiptRef = useRef()
  const [uploadingReceipt, setUploadingReceipt] = useState(null)

  // Pending dates editing
  const [pendingDatesLocal, setPendingDatesLocal] = useState({})
  const [savingDates, setSavingDates] = useState(false)

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

  // Sync pending dates from property
  useEffect(() => {
    if (property) {
      setPendingDatesLocal({
        mutual_date: property.mutual_date || '',
        inspection_deadline: property.inspection_deadline || '',
        earnest_money_date: property.earnest_money_date || '',
        closing_date: property.closing_date || '',
      })
    }
  }, [property?.id, property?.mutual_date, property?.inspection_deadline, property?.earnest_money_date, property?.closing_date])

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

  const handleArchive = async () => {
    setActionLoading(true)
    try {
      await api.archiveProperty(id)
      navigate('/admin/properties')
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnarchive = async () => {
    setActionLoading(true)
    try {
      await api.unarchiveProperty(id)
      loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    setActionLoading(true)
    try {
      await api.deleteProperty(id)
      navigate('/admin/properties')
    } catch (err) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePhaseChange = async (newPhase) => {
    setPhaseLoading(true)
    try {
      await api.updatePhase(id, newPhase)
      loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setPhaseLoading(false)
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    const data = { ...taskForm }
    Object.keys(data).forEach(k => { if (data[k] === '') delete data[k] })
    if (data.task_type !== 'custom') data.title = data.title || TASK_TYPES.find(t => t.value === data.task_type)?.label || data.task_type
    await api.createTask(id, data)
    setShowTaskForm(false)
    setTaskForm({ title: '', task_type: 'custom', scheduled_date: '', notes: '' })
    loadData()
  }

  const handleUpdateTaskStatus = async (taskId, status) => {
    await api.updateTask(taskId, { status })
    loadData()
  }

  const handleDeleteTask = async (taskId) => {
    await api.deleteTask(taskId)
    loadData()
  }

  const handleCreateMilestone = async (e) => {
    e.preventDefault()
    const data = { ...milestoneForm }
    Object.keys(data).forEach(k => { if (data[k] === '') delete data[k] })
    if (data.milestone_type !== 'custom') data.title = data.title || MILESTONE_TYPES.find(t => t.value === data.milestone_type)?.label || data.milestone_type
    await api.createMilestone(id, data)
    setShowMilestoneForm(false)
    setMilestoneForm({ title: '', milestone_type: 'custom', due_date: '', notes: '' })
    loadData()
  }

  const handleUpdateMilestoneStatus = async (milestoneId, status) => {
    await api.updateMilestone(milestoneId, { status })
    loadData()
  }

  const handleDeleteMilestone = async (milestoneId) => {
    await api.deleteMilestone(milestoneId)
    loadData()
  }

  // ─── Pending Dates ────────────────────────────────────────────────────
  const handleSavePendingDates = async () => {
    setSavingDates(true)
    try {
      const payload = {}
      Object.keys(pendingDatesLocal).forEach(k => {
        payload[k] = pendingDatesLocal[k] || null
      })
      await api.updatePendingDates(id, payload)
      loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingDates(false)
    }
  }

  const handleToggleInspectionResponse = async (received) => {
    try {
      await api.toggleInspectionResponse(id, received, property.inspection_response_days || 3)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  // ─── Custom Sections ──────────────────────────────────────────────────
  const handleCreateCustomSection = async (e) => {
    e.preventDefault()
    const data = { ...customSectionForm }
    if (data.section_type !== 'date') delete data.date_value
    else if (data.date_value === '') delete data.date_value
    await api.createCustomSection(id, data)
    setShowCustomSectionForm(false)
    setCustomSectionForm({ title: '', section_type: 'checklist', phase: property.phase || 'pre_market', date_value: '' })
    loadData()
  }

  const handleDeleteCustomSection = async (sectionId) => {
    if (!confirm('Delete this section and all its items?')) return
    await api.deleteCustomSection(sectionId)
    loadData()
  }

  const handleCreateSectionItem = async (sectionId) => {
    const text = newItemText[sectionId]?.trim()
    if (!text) return
    await api.createSectionItem(sectionId, text)
    setNewItemText(prev => ({ ...prev, [sectionId]: '' }))
    loadData()
  }

  const handleToggleSectionItem = async (itemId, currentStatus) => {
    await api.updateSectionItem(itemId, currentStatus === 'complete' ? 'pending' : 'complete')
    loadData()
  }

  const handleDeleteSectionItem = async (itemId) => {
    await api.deleteSectionItem(itemId)
    loadData()
  }

  // ─── Receipt Upload ───────────────────────────────────────────────────
  const handleReceiptUpload = async (taskId, file) => {
    setUploadingReceipt(taskId)
    try {
      await api.uploadReceipt(taskId, file)
      loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setUploadingReceipt(null)
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
          <span className={`badge ${property.is_archived ? 'badge--archived' : property.status === 'Active' ? 'badge--approved' : 'badge--pending'}`} style={{ fontSize: '0.8rem', padding: '4px 12px' }}>{property.is_archived ? 'Archived' : property.status}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {property.is_archived ? (
              <>
                <button className="btn btn--ghost btn--small" onClick={handleUnarchive} disabled={actionLoading}>
                  <RotateCcw size={14} /> Restore
                </button>
                <button className="btn btn--small" style={{ background: '#d32f2f', color: 'white', border: 'none' }} onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={14} /> Delete Forever
                </button>
              </>
            ) : (
              <button className="btn btn--ghost btn--small" onClick={() => setShowArchiveConfirm(true)}>
                <Archive size={14} /> Archive
              </button>
            )}
          </div>
        </div>

        {/* Archived Banner */}
        {property.is_archived && (
          <div style={{ 
            background: 'rgba(155, 155, 155, 0.1)', 
            border: '1px solid rgba(155, 155, 155, 0.3)', 
            borderRadius: 8, 
            padding: '0.75rem 1rem', 
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            color: 'var(--admin-text-secondary)'
          }}>
            <Archive size={16} style={{ color: '#9B9B9B', flexShrink: 0 }} />
            <span>
              This property was archived{property.archived_at ? ` on ${new Date(property.archived_at).toLocaleDateString()}` : ''}. 
              Photos and gallery link have been removed. Activity data and history are preserved. Click <strong>Restore</strong> to bring it back.
            </span>
          </div>
        )}

        {/* Phase Selector */}
        {!property.is_archived && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            marginBottom: '1.25rem', padding: '0.75rem 1rem',
            background: 'var(--admin-surface)', border: '1px solid var(--admin-border)', borderRadius: 8
          }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--admin-text-secondary)', fontWeight: 500 }}>Phase:</span>
            {['pre_market', 'active', 'pending'].map(p => (
              <button
                key={p}
                onClick={() => handlePhaseChange(p)}
                disabled={phaseLoading}
                style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s', border: 'none',
                  background: (property.phase || 'active') === p ? 
                    (p === 'pre_market' ? 'rgba(212, 164, 74, 0.2)' : p === 'active' ? 'rgba(107, 175, 123, 0.2)' : 'rgba(127, 119, 221, 0.2)') : 
                    'var(--admin-surface-hover)',
                  color: (property.phase || 'active') === p ? 
                    (p === 'pre_market' ? 'var(--admin-warning)' : p === 'active' ? 'var(--admin-success)' : '#7F77DD') : 
                    'var(--admin-text-muted)'
                }}
              >
                {p === 'pre_market' ? 'Pre-Market' : p === 'active' ? 'Active' : 'Pending'}
              </button>
            ))}
            <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-muted)', marginLeft: 'auto' }}>
              Client sees a different dashboard for each phase
            </span>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1.5rem', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
          {[
            ...(property.phase === 'pre_market' ? [{ id: 'tasks', label: 'Tasks', icon: ListChecks, count: property.pre_market_tasks?.filter(t => t.status !== 'complete').length }] : []),
            { id: 'activities', label: 'Activities', icon: Calendar, count: pendingApproval },
            { id: 'photos', label: 'Photos', icon: Image, count: property.photos?.length },
            { id: 'marketing', label: 'Marketing', icon: Megaphone },
            ...(property.phase === 'pending' ? [{ id: 'milestones', label: 'Milestones', icon: Flag, count: property.pending_milestones?.filter(m => m.status !== 'complete').length }] : []),
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

        {/* ─── Pre-Market Tasks Tab ───────────────────────────────────────── */}
        {tab === 'tasks' && (
          <>
            <button className="btn btn--primary" style={{ marginBottom: '1rem' }} onClick={() => setShowTaskForm(true)}><Plus size={14} /> Add Task</button>

            {showTaskForm && (
              <div className="admin-card" style={{ marginBottom: '1rem', borderColor: 'var(--admin-gold)' }}>
                <form onSubmit={handleCreateTask}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Task Type</label>
                      <select className="form-select" value={taskForm.task_type} onChange={e => {
                        const type = e.target.value
                        const label = TASK_TYPES.find(t => t.value === type)?.label || ''
                        setTaskForm({...taskForm, task_type: type, title: type === 'custom' ? '' : label})
                      }}>
                        {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Scheduled Date</label>
                      <input className="form-input" type="date" value={taskForm.scheduled_date} onChange={e => setTaskForm({...taskForm, scheduled_date: e.target.value})} />
                    </div>
                  </div>
                  {taskForm.task_type === 'custom' && (
                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label">Task Name</label>
                      <input className="form-input" value={taskForm.title} onChange={e => setTaskForm({...taskForm, title: e.target.value})} required placeholder="e.g. Carpet cleaning" />
                    </div>
                  )}
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Notes (optional)</label>
                    <input className="form-input" value={taskForm.notes} onChange={e => setTaskForm({...taskForm, notes: e.target.value})} placeholder="e.g. Vendor confirmed for 2pm" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn--primary btn--small">Create Task</button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowTaskForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="admin-card">
              {property.pre_market_tasks?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {property.pre_market_tasks.map(t => (
                    <div key={t.id} style={{
                      padding: '10px 12px', background: 'var(--admin-bg)', borderRadius: 8,
                      opacity: t.status === 'complete' ? 0.6 : 1
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                          onClick={() => handleUpdateTaskStatus(t.id, t.status === 'complete' ? 'pending' : 'complete')}
                          style={{
                            width: 22, height: 22, borderRadius: 6, border: '2px solid',
                            borderColor: t.status === 'complete' ? 'var(--admin-success)' : 'var(--admin-border)',
                            background: t.status === 'complete' ? 'var(--admin-success)' : 'transparent',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}
                        >
                          {t.status === 'complete' && <Check size={14} color="#fff" />}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: '0.9rem', textDecoration: t.status === 'complete' ? 'line-through' : 'none' }}>{t.title}</div>
                          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                            {t.scheduled_date && <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', fontFamily: 'JetBrains Mono' }}>{new Date(t.scheduled_date + 'T00:00').toLocaleDateString()}</span>}
                            {t.notes && <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)' }}>{t.notes}</span>}
                          </div>
                        </div>
                        {/* Receipt upload */}
                        {(t.category === 'inspection_item' || t.task_type === 'inspection') && (
                          <button
                            onClick={() => {
                              const inp = document.createElement('input')
                              inp.type = 'file'
                              inp.accept = 'image/*,.pdf'
                              inp.onchange = (e) => {
                                if (e.target.files[0]) handleReceiptUpload(t.id, e.target.files[0])
                              }
                              inp.click()
                            }}
                            disabled={uploadingReceipt === t.id}
                            style={{
                              fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4,
                              border: '1px solid var(--admin-border)', background: t.receipt_url ? 'rgba(107,175,123,0.1)' : 'var(--admin-surface)',
                              color: t.receipt_url ? 'var(--admin-success)' : 'var(--admin-text-muted)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4
                            }}
                            title={t.receipt_url ? 'Replace receipt' : 'Upload receipt'}
                          >
                            <Paperclip size={11} /> {uploadingReceipt === t.id ? '...' : t.receipt_url ? 'Receipt' : 'Receipt'}
                          </button>
                        )}
                        {/* Any task can attach a receipt via right-click-style button */}
                        {t.category !== 'inspection_item' && t.task_type !== 'inspection' && (
                          <button
                            onClick={() => {
                              const inp = document.createElement('input')
                              inp.type = 'file'
                              inp.accept = 'image/*,.pdf'
                              inp.onchange = (e) => {
                                if (e.target.files[0]) handleReceiptUpload(t.id, e.target.files[0])
                              }
                              inp.click()
                            }}
                            disabled={uploadingReceipt === t.id}
                            style={{
                              fontSize: '0.72rem', padding: '3px 8px', borderRadius: 4,
                              border: '1px solid var(--admin-border)', background: t.receipt_url ? 'rgba(107,175,123,0.1)' : 'var(--admin-surface)',
                              color: t.receipt_url ? 'var(--admin-success)' : 'var(--admin-text-muted)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4, opacity: t.receipt_url ? 1 : 0.6
                            }}
                            title={t.receipt_url ? 'Replace receipt' : 'Attach receipt'}
                          >
                            <Paperclip size={11} /> {uploadingReceipt === t.id ? '...' : t.receipt_url ? 'Receipt' : 'Attach'}
                          </button>
                        )}
                        {t.status !== 'complete' && (
                          <select
                            value={t.status}
                            onChange={e => handleUpdateTaskStatus(t.id, e.target.value)}
                            style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--admin-border)', background: 'var(--admin-surface)', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}
                          >
                            <option value="pending">Pending</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="in_progress">In Progress</option>
                            <option value="complete">Complete</option>
                          </select>
                        )}
                        <button onClick={() => handleDeleteTask(t.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', padding: 4 }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {/* Receipt preview */}
                      {t.receipt_url && (
                        <div style={{ marginTop: 6, marginLeft: 34, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <a href={t.receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.78rem', color: 'var(--admin-gold)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileText size={12} /> View receipt →
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>
                  No tasks yet. Add tasks to show your clients what's being done to prepare their home.
                </div>
              )}
            </div>

            {/* Target go-live date */}
            <div className="admin-card" style={{ marginTop: '1rem' }}>
              <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem', marginBottom: '0.75rem' }}>Target Go-Live Date</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  className="form-input"
                  type="date"
                  value={property.target_live_date || ''}
                  onChange={async (e) => {
                    await api.updatePhase(id, 'pre_market', e.target.value || null)
                    loadData()
                  }}
                  style={{ maxWidth: 200 }}
                />
                <span style={{ fontSize: '0.82rem', color: 'var(--admin-text-muted)' }}>
                  {property.target_live_date ? `${Math.max(0, Math.ceil((new Date(property.target_live_date + 'T00:00') - new Date()) / 86400000))} days away` : 'Not set'}
                </span>
              </div>
            </div>

            {/* ─── Custom Sections (Pre-Market) ─────────────────────────────── */}
            <div className="admin-card" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem' }}>Custom Sections</h3>
                <button className="btn btn--ghost btn--small" onClick={() => { setCustomSectionForm({ title: '', section_type: 'checklist', phase: 'pre_market', date_value: '' }); setShowCustomSectionForm(!showCustomSectionForm) }}>
                  <Plus size={12} /> Add Section
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', marginBottom: '0.75rem' }}>
                Add custom checklists or key dates that your client will see on their pre-market dashboard.
              </p>

              {showCustomSectionForm && customSectionForm.phase === 'pre_market' && (
                <form onSubmit={handleCreateCustomSection} style={{ background: 'var(--admin-bg)', borderRadius: 8, padding: '12px', marginBottom: '0.75rem', border: '1px solid var(--admin-gold-dim)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input className="form-input" value={customSectionForm.title} onChange={e => setCustomSectionForm({...customSectionForm, title: e.target.value})} required placeholder="Section title" style={{ fontSize: '0.85rem' }} />
                    <select className="form-select" value={customSectionForm.section_type} onChange={e => setCustomSectionForm({...customSectionForm, section_type: e.target.value})} style={{ fontSize: '0.85rem', width: 'auto' }}>
                      <option value="checklist">Checklist</option>
                      <option value="date">Key Date</option>
                    </select>
                  </div>
                  {customSectionForm.section_type === 'date' && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <input className="form-input" type="date" value={customSectionForm.date_value} onChange={e => setCustomSectionForm({...customSectionForm, date_value: e.target.value})} style={{ fontSize: '0.85rem', maxWidth: 200 }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn--primary btn--small">Create</button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowCustomSectionForm(false)}>Cancel</button>
                  </div>
                </form>
              )}

              {(property.custom_sections || []).filter(s => s.phase === 'pre_market').map(section => (
                <div key={section.id} style={{ background: 'var(--admin-bg)', borderRadius: 8, padding: '12px', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{section.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{section.section_type}</span>
                      <button onClick={() => handleDeleteCustomSection(section.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', padding: 2 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {section.section_type === 'date' ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', fontFamily: 'JetBrains Mono' }}>
                      {section.date_value ? new Date(section.date_value + 'T00:00').toLocaleDateString() : 'No date set'}
                    </div>
                  ) : (
                    <>
                      {(section.items || []).map(item => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '4px 0' }}>
                          <button
                            onClick={() => handleToggleSectionItem(item.id, item.status)}
                            style={{
                              width: 18, height: 18, borderRadius: 4, border: '2px solid',
                              borderColor: item.status === 'complete' ? 'var(--admin-success)' : 'var(--admin-border)',
                              background: item.status === 'complete' ? 'var(--admin-success)' : 'transparent',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}
                          >
                            {item.status === 'complete' && <Check size={10} color="#fff" />}
                          </button>
                          <span style={{ flex: 1, fontSize: '0.85rem', textDecoration: item.status === 'complete' ? 'line-through' : 'none', opacity: item.status === 'complete' ? 0.5 : 1 }}>{item.title}</span>
                          <button onClick={() => handleDeleteSectionItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', padding: 2, opacity: 0.5 }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
                        <input
                          className="form-input"
                          value={newItemText[section.id] || ''}
                          onChange={e => setNewItemText(prev => ({ ...prev, [section.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateSectionItem(section.id) } }}
                          placeholder="Add item..."
                          style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                        />
                        <button className="btn btn--ghost btn--small" onClick={() => handleCreateSectionItem(section.id)} style={{ padding: '4px 8px' }}>
                          <Plus size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {(property.custom_sections || []).filter(s => s.phase === 'pre_market').length === 0 && !showCustomSectionForm && (
                <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-muted)', padding: '0.5rem 0' }}>
                  No custom sections yet.
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── Pending Milestones Tab ─────────────────────────────────────── */}
        {tab === 'milestones' && (
          <>
            {/* ─── Key Transaction Dates ──────────────────────────────────── */}
            <div className="admin-card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem', marginBottom: '0.75rem' }}>Key Transaction Dates</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', marginBottom: '1rem' }}>
                Structured contract dates — these power the client's closing countdown and timeline.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Mutual Acceptance</label>
                  <input className="form-input" type="date" value={pendingDatesLocal.mutual_date || ''} onChange={e => setPendingDatesLocal(prev => ({...prev, mutual_date: e.target.value}))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Inspection Deadline</label>
                  <input className="form-input" type="date" value={pendingDatesLocal.inspection_deadline || ''} onChange={e => setPendingDatesLocal(prev => ({...prev, inspection_deadline: e.target.value}))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Earnest Money Due</label>
                  <input className="form-input" type="date" value={pendingDatesLocal.earnest_money_date || ''} onChange={e => setPendingDatesLocal(prev => ({...prev, earnest_money_date: e.target.value}))} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Closing Date</label>
                  <input className="form-input" type="date" value={pendingDatesLocal.closing_date || ''} onChange={e => setPendingDatesLocal(prev => ({...prev, closing_date: e.target.value}))} />
                </div>
              </div>

              {/* Inspection Response Toggle */}
              <div style={{ background: 'var(--admin-bg)', borderRadius: 8, padding: '10px 12px', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>Inspection Response Received</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)', marginTop: 2 }}>
                      {property.inspection_response_received
                        ? `Response received — response deadline: ${property.inspection_response_date ? new Date(property.inspection_response_date + 'T00:00').toLocaleDateString() : 'calculating...'}`
                        : `Toggle when the inspection response has been received (${property.inspection_response_days || 3}-day response period)`
                      }
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleInspectionResponse(!property.inspection_response_received)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: property.inspection_response_received ? 'var(--admin-success)' : 'var(--admin-border)',
                      position: 'relative', transition: 'background 0.2s', flexShrink: 0
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', background: 'white',
                      position: 'absolute', top: 3,
                      left: property.inspection_response_received ? 23 : 3,
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </button>
                </div>
              </div>

              <button className="btn btn--primary btn--small" onClick={handleSavePendingDates} disabled={savingDates}>
                {savingDates ? 'Saving...' : 'Save Dates'}
              </button>
            </div>

            {/* ─── Milestone Checklist ────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem' }}>Milestone Checklist</h3>
              <button className="btn btn--primary btn--small" onClick={() => setShowMilestoneForm(true)}><Plus size={14} /> Add Milestone</button>
            </div>

            {showMilestoneForm && (
              <div className="admin-card" style={{ marginBottom: '1rem', borderColor: 'var(--admin-gold)' }}>
                <form onSubmit={handleCreateMilestone}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Milestone Type</label>
                      <select className="form-select" value={milestoneForm.milestone_type} onChange={e => {
                        const type = e.target.value
                        const label = MILESTONE_TYPES.find(t => t.value === type)?.label || ''
                        setMilestoneForm({...milestoneForm, milestone_type: type, title: type === 'custom' ? '' : label})
                      }}>
                        {MILESTONE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Due Date</label>
                      <input className="form-input" type="date" value={milestoneForm.due_date} onChange={e => setMilestoneForm({...milestoneForm, due_date: e.target.value})} />
                    </div>
                  </div>
                  {milestoneForm.milestone_type === 'custom' && (
                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label">Milestone Name</label>
                      <input className="form-input" value={milestoneForm.title} onChange={e => setMilestoneForm({...milestoneForm, title: e.target.value})} required placeholder="e.g. HOA document review" />
                    </div>
                  )}
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label">Notes (optional)</label>
                    <input className="form-input" value={milestoneForm.notes} onChange={e => setMilestoneForm({...milestoneForm, notes: e.target.value})} placeholder="e.g. Inspector: John Smith, 555-1234" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn--primary btn--small">Create Milestone</button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowMilestoneForm(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            <div className="admin-card">
              {property.pending_milestones?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {property.pending_milestones.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '10px 12px', background: 'var(--admin-bg)', borderRadius: 8,
                      opacity: m.status === 'complete' || m.status === 'waived' ? 0.6 : 1
                    }}>
                      <button
                        onClick={() => handleUpdateMilestoneStatus(m.id, m.status === 'complete' ? 'upcoming' : 'complete')}
                        style={{
                          width: 22, height: 22, borderRadius: 6, border: '2px solid',
                          borderColor: m.status === 'complete' ? 'var(--admin-success)' : 'var(--admin-border)',
                          background: m.status === 'complete' ? 'var(--admin-success)' : 'transparent',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}
                      >
                        {m.status === 'complete' && <Check size={14} color="#fff" />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem', textDecoration: m.status === 'complete' ? 'line-through' : 'none' }}>{m.title}</div>
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: 2 }}>
                          {m.due_date && (
                            <span style={{
                              fontSize: '0.78rem', fontFamily: 'JetBrains Mono',
                              color: m.status !== 'complete' && new Date(m.due_date + 'T00:00') < new Date() ? 'var(--admin-danger)' : 'var(--admin-text-muted)'
                            }}>
                              {new Date(m.due_date + 'T00:00').toLocaleDateString()}
                              {m.status !== 'complete' && m.due_date && (() => {
                                const days = Math.ceil((new Date(m.due_date + 'T00:00') - new Date()) / 86400000)
                                return days >= 0 ? ` (${days}d)` : ` (${Math.abs(days)}d overdue)`
                              })()}
                            </span>
                          )}
                          {m.notes && <span style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)' }}>{m.notes}</span>}
                        </div>
                      </div>
                      <select
                        value={m.status}
                        onChange={e => handleUpdateMilestoneStatus(m.id, e.target.value)}
                        style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: 4, border: '1px solid var(--admin-border)', background: 'var(--admin-surface)', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="in_progress">In Progress</option>
                        <option value="complete">Complete</option>
                        <option value="waived">Waived</option>
                      </select>
                      <button onClick={() => handleDeleteMilestone(m.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>
                  No milestones yet. Add contract dates so your clients can track their transaction progress.
                </div>
              )}
            </div>

            {/* ─── Custom Sections (Pending) ─────────────────────────────── */}
            <div className="admin-card" style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h3 style={{ fontFamily: 'Playfair Display', fontSize: '1rem' }}>Custom Sections</h3>
                <button className="btn btn--ghost btn--small" onClick={() => { setCustomSectionForm({ title: '', section_type: 'checklist', phase: 'pending', date_value: '' }); setShowCustomSectionForm(!showCustomSectionForm) }}>
                  <Plus size={12} /> Add Section
                </button>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', marginBottom: '0.75rem' }}>
                Add custom checklists or key dates that your client will see on their pending dashboard.
              </p>

              {showCustomSectionForm && customSectionForm.phase === 'pending' && (
                <form onSubmit={handleCreateCustomSection} style={{ background: 'var(--admin-bg)', borderRadius: 8, padding: '12px', marginBottom: '0.75rem', border: '1px solid var(--admin-gold-dim)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input className="form-input" value={customSectionForm.title} onChange={e => setCustomSectionForm({...customSectionForm, title: e.target.value})} required placeholder="Section title" style={{ fontSize: '0.85rem' }} />
                    <select className="form-select" value={customSectionForm.section_type} onChange={e => setCustomSectionForm({...customSectionForm, section_type: e.target.value})} style={{ fontSize: '0.85rem', width: 'auto' }}>
                      <option value="checklist">Checklist</option>
                      <option value="date">Key Date</option>
                    </select>
                  </div>
                  {customSectionForm.section_type === 'date' && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <input className="form-input" type="date" value={customSectionForm.date_value} onChange={e => setCustomSectionForm({...customSectionForm, date_value: e.target.value})} style={{ fontSize: '0.85rem', maxWidth: 200 }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn--primary btn--small">Create</button>
                    <button type="button" className="btn btn--ghost btn--small" onClick={() => setShowCustomSectionForm(false)}>Cancel</button>
                  </div>
                </form>
              )}

              {(property.custom_sections || []).filter(s => s.phase === 'pending').map(section => (
                <div key={section.id} style={{ background: 'var(--admin-bg)', borderRadius: 8, padding: '12px', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{section.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{section.section_type}</span>
                      <button onClick={() => handleDeleteCustomSection(section.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', padding: 2 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  {section.section_type === 'date' ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', fontFamily: 'JetBrains Mono' }}>
                      {section.date_value ? new Date(section.date_value + 'T00:00').toLocaleDateString() : 'No date set'}
                    </div>
                  ) : (
                    <>
                      {(section.items || []).map(item => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '4px 0' }}>
                          <button
                            onClick={() => handleToggleSectionItem(item.id, item.status)}
                            style={{
                              width: 18, height: 18, borderRadius: 4, border: '2px solid',
                              borderColor: item.status === 'complete' ? 'var(--admin-success)' : 'var(--admin-border)',
                              background: item.status === 'complete' ? 'var(--admin-success)' : 'transparent',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}
                          >
                            {item.status === 'complete' && <Check size={10} color="#fff" />}
                          </button>
                          <span style={{ flex: 1, fontSize: '0.85rem', textDecoration: item.status === 'complete' ? 'line-through' : 'none', opacity: item.status === 'complete' ? 0.5 : 1 }}>{item.title}</span>
                          <button onClick={() => handleDeleteSectionItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-muted)', cursor: 'pointer', padding: 2, opacity: 0.5 }}>
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4 }}>
                        <input
                          className="form-input"
                          value={newItemText[section.id] || ''}
                          onChange={e => setNewItemText(prev => ({ ...prev, [section.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateSectionItem(section.id) } }}
                          placeholder="Add item..."
                          style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                        />
                        <button className="btn btn--ghost btn--small" onClick={() => handleCreateSectionItem(section.id)} style={{ padding: '4px 8px' }}>
                          <Plus size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {(property.custom_sections || []).filter(s => s.phase === 'pending').length === 0 && !showCustomSectionForm && (
                <div style={{ fontSize: '0.82rem', color: 'var(--admin-text-muted)', padding: '0.5rem 0' }}>
                  No custom sections yet.
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── Archive Confirmation Modal ─────────────────────────────────── */}
        {showArchiveConfirm && (
          <div className="modal-overlay" onClick={() => setShowArchiveConfirm(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h3 className="modal__title">Archive Property</h3>
                <button className="modal__close" onClick={() => setShowArchiveConfirm(false)}><X size={18} /></button>
              </div>
              <div className="modal__body">
                <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--admin-text-secondary)', lineHeight: 1.6 }}>
                  Archiving <strong style={{ color: 'var(--admin-text)' }}>{property.address}</strong> will:
                </div>
                <div style={{ background: 'var(--admin-bg)', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--admin-text-secondary)' }}>
                  • Remove the hero photo and gallery link (to save space)<br/>
                  • Hide the property from the client portal<br/>
                  • Keep all activity data, marketing, and history<br/>
                  • You can restore it anytime
                </div>
              </div>
              <div className="modal__footer">
                <button className="btn btn--ghost" onClick={() => setShowArchiveConfirm(false)}>Cancel</button>
                <button className="btn btn--primary" onClick={handleArchive} disabled={actionLoading}>
                  <Archive size={14} /> {actionLoading ? 'Archiving...' : 'Archive Property'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Delete Confirmation Modal ──────────────────────────────────── */}
        {showDeleteConfirm && (
          <div className="modal-overlay" onClick={() => { setShowDeleteConfirm(false); setDeleteTyped(''); }}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h3 className="modal__title" style={{ color: '#d32f2f' }}>Permanently Delete Property</h3>
                <button className="modal__close" onClick={() => { setShowDeleteConfirm(false); setDeleteTyped(''); }}><X size={18} /></button>
              </div>
              <div className="modal__body">
                <div style={{ background: '#fff3f3', border: '1px solid #ffcdd2', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: '0.85rem', lineHeight: 1.6, color: '#c62828' }}>
                  <strong>This action cannot be undone.</strong> Deleting this property will permanently remove all associated data including activities, marketing items, photos, and client access records.
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--admin-text-secondary)', marginBottom: '0.75rem' }}>
                  Type <strong style={{ fontFamily: 'JetBrains Mono', color: '#d32f2f' }}>DELETE</strong> to confirm:
                </div>
                <input
                  className="form-input"
                  value={deleteTyped}
                  onChange={e => setDeleteTyped(e.target.value)}
                  placeholder="Type DELETE"
                  style={{ fontFamily: 'JetBrains Mono', textAlign: 'center' }}
                  autoFocus
                />
              </div>
              <div className="modal__footer">
                <button className="btn btn--ghost" onClick={() => { setShowDeleteConfirm(false); setDeleteTyped(''); }}>Cancel</button>
                <button 
                  className="btn" 
                  style={{ background: deleteTyped === 'DELETE' ? '#d32f2f' : '#ccc', color: 'white', border: 'none', cursor: deleteTyped === 'DELETE' ? 'pointer' : 'not-allowed' }}
                  onClick={handleDelete} 
                  disabled={deleteTyped !== 'DELETE' || actionLoading}
                >
                  <Trash2 size={14} /> {actionLoading ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
