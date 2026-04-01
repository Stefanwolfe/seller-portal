import React, { useState, useEffect } from 'react'
import { AdminNav } from './AdminDashboard'
import api from '../utils/api'
import { Users, Home, Plus, X, Send, Mail, CheckCircle } from 'lucide-react'

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGrantModal, setShowGrantModal] = useState(null) // client id
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteFullName, setInviteFullName] = useState('')
  const [invitePropertyId, setInvitePropertyId] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteResult, setInviteResult] = useState(null) // { type: 'success'|'error', message, invite_url? }

  const load = async () => {
    const [cls, props] = await Promise.all([api.getClients(), api.getProperties()])
    setClients(cls)
    setProperties(props)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleGrant = async (userId, propertyId) => {
    try {
      await api.grantAccess(userId, propertyId)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleSendInvite = async (e) => {
    e.preventDefault()
    setInviteSending(true)
    setInviteResult(null)
    try {
      const result = await api.sendInvite({
        email: inviteEmail.trim(),
        full_name: inviteFullName.trim(),
        property_id: parseInt(invitePropertyId)
      })
      setInviteResult({ 
        type: 'success', 
        message: result.message,
        invite_url: result.invite_url 
      })
      // Refresh clients list
      load()
    } catch (err) {
      setInviteResult({ type: 'error', message: err.message })
    } finally {
      setInviteSending(false)
    }
  }

  const resetInviteModal = () => {
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteFullName('')
    setInvitePropertyId('')
    setInviteResult(null)
  }

  return (
    <div className="admin-portal">
      <AdminNav />
      <div className="admin-page">
        <div className="admin-page__header">
          <h1 className="admin-page__title">Client Management</h1>
          <button className="btn btn--primary" onClick={() => setShowInviteModal(true)}>
            <Send size={14} /> Send Invite
          </button>
        </div>

        <div className="admin-card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', lineHeight: 1.6 }}>
            <Mail size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Invite clients by clicking <strong>Send Invite</strong> — they'll receive an email with a secure link to set their password and access their dashboard instantly. No manual account setup needed.
          </div>
        </div>

        <div className="admin-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Registered</th>
                <th>Properties</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.full_name}</td>
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>{c.email || '—'}</td>
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
                    {c.properties.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {c.properties.map(p => (
                          <span key={p.id} style={{ fontSize: '0.82rem', color: 'var(--admin-gold)' }}>{p.address}</span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--admin-text-muted)', fontSize: '0.82rem' }}>No access</span>
                    )}
                  </td>
                  <td>
                    <button className="btn btn--primary btn--small" onClick={() => setShowGrantModal(c.id)}>
                      <Plus size={12} /> Grant Access
                    </button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>
                  No clients yet. Click "Send Invite" to onboard your first seller.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Grant Access Modal */}
        {showGrantModal && (
          <div className="modal-overlay" onClick={() => setShowGrantModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h3 className="modal__title">Grant Property Access</h3>
                <button className="modal__close" onClick={() => setShowGrantModal(null)}><X size={18} /></button>
              </div>
              <div className="modal__body">
                {(() => {
                  const client = clients.find(c => c.id === showGrantModal)
                  const clientPropIds = client?.properties.map(p => p.id) || []
                  const available = properties.filter(p => !clientPropIds.includes(p.id))

                  return (
                    <>
                      <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--admin-text-secondary)' }}>
                        Granting access for <strong style={{ color: 'var(--admin-text)' }}>{client?.full_name}</strong>
                      </div>
                      {available.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {available.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--admin-bg)', borderRadius: 6 }}>
                              <div>
                                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{p.address}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--admin-text-muted)' }}>{p.status}</div>
                              </div>
                              <button className="btn btn--primary btn--small" onClick={() => { handleGrant(showGrantModal, p.id); setShowGrantModal(null) }}>
                                Grant
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--admin-text-muted)', padding: '1rem 0' }}>
                          This client already has access to all properties.
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Send Invite Modal */}
        {showInviteModal && (
          <div className="modal-overlay" onClick={resetInviteModal}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h3 className="modal__title">Invite Client to Portal</h3>
                <button className="modal__close" onClick={resetInviteModal}><X size={18} /></button>
              </div>
              <div className="modal__body">
                {inviteResult?.type === 'success' ? (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <CheckCircle size={36} style={{ color: '#4CAF50', marginBottom: '0.75rem' }} />
                    <div style={{ fontSize: '0.95rem', color: 'var(--admin-text)', marginBottom: '0.75rem' }}>
                      {inviteResult.message}
                    </div>
                    {inviteResult.invite_url && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)', marginBottom: '0.5rem' }}>
                          Or share this link manually:
                        </div>
                        <div style={{ 
                          fontFamily: 'JetBrains Mono', fontSize: '0.75rem', 
                          background: 'var(--admin-bg)', padding: '8px 12px', borderRadius: 6,
                          wordBreak: 'break-all', color: 'var(--admin-gold)'
                        }}>
                          {inviteResult.invite_url}
                        </div>
                      </div>
                    )}
                    <button className="btn btn--primary" style={{ marginTop: '1.25rem' }} onClick={resetInviteModal}>
                      Done
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSendInvite}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                      The client will receive an email with a secure link to set their password. Once they do, they'll immediately see their property dashboard.
                    </div>

                    {inviteResult?.type === 'error' && (
                      <div style={{ background: '#fff3f3', color: '#d32f2f', padding: '10px 12px', borderRadius: 6, fontSize: '0.85rem', marginBottom: '1rem' }}>
                        {inviteResult.message}
                      </div>
                    )}

                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--admin-text-secondary)', marginBottom: 4 }}>Client's Full Name</label>
                      <input
                        type="text"
                        value={inviteFullName}
                        onChange={e => setInviteFullName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--admin-border)', borderRadius: 6, fontSize: '0.9rem', background: 'var(--admin-bg)', color: 'var(--admin-text)' }}
                        placeholder="e.g. Jane Smith"
                      />
                    </div>

                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--admin-text-secondary)', marginBottom: 4 }}>Client's Email</label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--admin-border)', borderRadius: 6, fontSize: '0.9rem', background: 'var(--admin-bg)', color: 'var(--admin-text)' }}
                        placeholder="jane@email.com"
                      />
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--admin-text-secondary)', marginBottom: 4 }}>Property</label>
                      <select
                        value={invitePropertyId}
                        onChange={e => setInvitePropertyId(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--admin-border)', borderRadius: 6, fontSize: '0.9rem', background: 'var(--admin-bg)', color: 'var(--admin-text)' }}
                      >
                        <option value="">Select a property...</option>
                        {properties.map(p => (
                          <option key={p.id} value={p.id}>{p.address}</option>
                        ))}
                      </select>
                    </div>

                    <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={inviteSending}>
                      <Send size={14} /> {inviteSending ? 'Sending Invite...' : 'Send Invite Email'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
