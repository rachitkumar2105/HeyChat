// src/App.jsx
// This is the MAIN file that organizes all pages
// Like a table of contents for your app

import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Auth from './pages/Auth'
import Home from './pages/Home'
import './index.css'

// This component checks if you're logged in
// If yes → show the app. If no → send to login page
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
        fontFamily: 'Segoe UI, sans-serif',
        color: '#666',
        fontSize: '18px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>💬</div>
          <p>Loading HeyChat...</p>
        </div>
      </div>
    )
  }

  return user ? children : <Navigate to="/auth" replace />
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Login/Signup page */}
      <Route
        path="/auth"
        element={user ? <Navigate to="/" replace /> : <Auth />}
      />

      {/* Main chat page - only for logged in users */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* Redirect any unknown URL to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        {/* Toast notifications (popup messages) */}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '12px',
              fontFamily: 'Segoe UI, sans-serif',
            },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  )
}
