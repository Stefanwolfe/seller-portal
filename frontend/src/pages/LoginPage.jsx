import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../utils/AuthContext'
import api from '../utils/api'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(username.trim(), password)
      navigate(user.role === 'admin' ? '/admin' : '/dashboard')
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.forgotPassword(forgotEmail.trim())
      setForgotSent(true)
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (showForgot) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-card__brand">
            <div className="login-card__logo">DC Concierge</div>
            <div className="login-card__tagline">Seller Portal</div>
          </div>

          {forgotSent ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '1.1rem', color: '#2C2C2C', marginBottom: '0.75rem', fontFamily: 'Cormorant Garamond, serif' }}>
                Check your email
              </div>
              <div style={{ fontSize: '0.9rem', color: '#7A7A7A', lineHeight: 1.5 }}>
                If an account exists with that email, we've sent a link to reset your password. The link expires in 1 hour.
              </div>
              <button 
                className="login-btn" 
                style={{ marginTop: '1.5rem' }}
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.9rem', color: '#7A7A7A', marginBottom: '1rem', lineHeight: 1.5 }}>
                Enter your email address and we'll send you a link to reset your password.
              </div>
              {error && <div className="login-error">{error}</div>}
              <form onSubmit={handleForgot}>
                <input
                  type="email"
                  className="login-input"
                  placeholder="Email address"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  required
                />
                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <div className="login-toggle">
                <a href="#" onClick={(e) => { e.preventDefault(); setShowForgot(false); setError(''); }}>Back to Sign In</a>
              </div>
            </>
          )}
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

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="login-input"
            placeholder="Email or username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="login-input"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Please wait...' : 'Sign In'}
          </button>
        </form>

        <div className="login-toggle">
          <a href="#" onClick={(e) => { e.preventDefault(); setShowForgot(true); setError(''); }}>Forgot your password?</a>
        </div>
      </div>
    </div>
  )
}
