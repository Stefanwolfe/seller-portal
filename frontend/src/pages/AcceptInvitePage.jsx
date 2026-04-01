import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../utils/AuthContext'
import api from '../utils/api'

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [inviteInfo, setInviteInfo] = useState(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const { setUserFromResponse } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) {
      setInvalid(true)
      setLoading(false)
      return
    }
    api.validateToken(token, 'invite')
      .then(data => {
        setInviteInfo(data)
        setLoading(false)
      })
      .catch(() => {
        setInvalid(true)
        setLoading(false)
      })
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const data = await api.acceptInvite(token, password)
      setUserFromResponse(data)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-card__brand">
            <div className="login-card__logo">DC Concierge</div>
            <div className="login-card__tagline">Seller Portal</div>
          </div>
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9B9B9B' }}>
            Verifying your invite...
          </div>
        </div>
      </div>
    )
  }

  if (invalid) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-card__brand">
            <div className="login-card__logo">DC Concierge</div>
            <div className="login-card__tagline">Seller Portal</div>
          </div>
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '1.1rem', color: '#2C2C2C', marginBottom: '0.75rem', fontFamily: 'Cormorant Garamond, serif' }}>
              Invalid or Expired Link
            </div>
            <div style={{ fontSize: '0.9rem', color: '#7A7A7A', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              This invite link has expired or has already been used. Please contact your agent for a new invite.
            </div>
            <button className="login-btn" onClick={() => navigate('/login')}>
              Go to Sign In
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__brand">
          <div className="login-card__logo">DC Concierge</div>
          <div className="login-card__tagline">Seller Portal</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '1.05rem', color: '#2C2C2C', fontFamily: 'Cormorant Garamond, serif', marginBottom: '0.5rem' }}>
            Welcome, {inviteInfo?.full_name}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#7A7A7A', lineHeight: 1.5 }}>
            Your portal for <strong style={{ color: '#B8926A' }}>{inviteInfo?.property_address}</strong> is ready. Create a password to get started.
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            className="login-input"
            value={inviteInfo?.email || ''}
            disabled
            style={{ opacity: 0.6, cursor: 'not-allowed' }}
          />
          <input
            type="password"
            className="login-input"
            placeholder="Create a password (min. 6 characters)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <input
            type="password"
            className="login-input"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit" className="login-btn" disabled={submitting}>
            {submitting ? 'Setting up your account...' : 'Create Account & View Dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
