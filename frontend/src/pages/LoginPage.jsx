import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../utils/AuthContext'

export default function LoginPage({ isSignup = false }) {
  const [mode, setMode] = useState(isSignup ? 'signup' : 'login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const user = await login(username.toLowerCase(), password)
        navigate(user.role === 'admin' ? '/admin' : '/dashboard')
      } else {
        const user = await signup({ username: username.toLowerCase(), password, full_name: fullName, email })
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
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
          {mode === 'signup' && (
            <>
              <input
                type="text"
                className="login-input"
                placeholder="Full Name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
              />
              <input
                type="email"
                className="login-input"
                placeholder="Email (optional)"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </>
          )}
          <input
            type="text"
            className="login-input"
            placeholder={mode === 'signup' ? 'Username (LastName + Street Number)' : 'Username'}
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="login-input"
            placeholder={mode === 'signup' ? 'Create a Password' : 'Password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="login-toggle">
          {mode === 'login' ? (
            <>First time here? <a href="#" onClick={(e) => { e.preventDefault(); setMode('signup'); setError(''); }}>Create your account</a></>
          ) : (
            <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(''); }}>Sign in</a></>
          )}
        </div>
      </div>
    </div>
  )
}
