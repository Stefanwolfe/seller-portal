import React from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuth } from './utils/AuthContext'

// Pages
import LoginPage from './pages/LoginPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ClientDashboard from './pages/ClientDashboard'
import AdminDashboard from './pages/AdminDashboard'
import AdminProperties from './pages/AdminProperties'
import AdminPropertyDetail from './pages/AdminPropertyDetail'
import AdminActivities from './pages/AdminActivities'
import AdminClients from './pages/AdminClients'

function AdminPreview() {
  const { id } = useParams()
  return <ClientDashboard previewPropertyId={parseInt(id)} />
}

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        background: '#FAFAF8',
        fontFamily: 'Cormorant Garamond, serif',
        fontSize: '1.2rem',
        color: '#9B9B9B'
      }}>
        Loading...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/login" element={
        user ? <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace /> : <LoginPage />
      } />
      <Route path="/accept-invite" element={
        user ? <Navigate to="/dashboard" replace /> : <AcceptInvitePage />
      } />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Client Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute requiredRole="client">
          <ClientDashboard />
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/properties" element={
        <ProtectedRoute requiredRole="admin">
          <AdminProperties />
        </ProtectedRoute>
      } />
      <Route path="/admin/properties/:id" element={
        <ProtectedRoute requiredRole="admin">
          <AdminPropertyDetail />
        </ProtectedRoute>
      } />
      <Route path="/admin/activities" element={
        <ProtectedRoute requiredRole="admin">
          <AdminActivities />
        </ProtectedRoute>
      } />
      <Route path="/admin/clients" element={
        <ProtectedRoute requiredRole="admin">
          <AdminClients />
        </ProtectedRoute>
      } />
      <Route path="/admin/preview/:id" element={
        <ProtectedRoute requiredRole="admin">
          <AdminPreview />
        </ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="*" element={
        <Navigate to={user ? (user.role === 'admin' ? '/admin' : '/dashboard') : '/login'} replace />
      } />
    </Routes>
  )
}
