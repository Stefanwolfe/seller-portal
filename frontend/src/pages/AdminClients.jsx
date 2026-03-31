import React, { useState, useEffect } from 'react'
import { AdminNav } from './AdminDashboard'
import api from '../utils/api'
import { Users, Home, Plus, X } from 'lucide-react'

export default function AdminClients() {
  const [clients, setClients] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGrantModal, setShowGrantModal] = useState(null) // client id

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

  return (
    <div className="admin-portal">
      <AdminNav />
      <div className="admin-page">
        <div className="admin-page__header">
          <h1 className="admin-page__title">Client Management</h1>
        </div>

        <div className="admin-card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', lineHeight: 1.6 }}>
            Clients sign up at <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--admin-gold)', fontSize: '0.82rem' }}>/signup</span> with their username (LastName + Street Number) and create a password.
            Once registered, grant them access to their property below.
          </div>
        </div>

        <div className="admin-card">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
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
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.82rem' }}>{c.username}</td>
                  <td>{c.email || '—'}</td>
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
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-text-muted)' }}>
                  No clients registered yet. Share the signup link with your sellers.
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
      </div>
    </div>
  )
}
