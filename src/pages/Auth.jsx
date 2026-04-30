// src/pages/Auth.jsx
// This is the LOGIN and SIGNUP page
// Like the front door of your app - you need a key to get in!

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true) // Toggle between Login and Signup
  const [loading, setLoading] = useState(false)
  const [showVerifyMsg, setShowVerifyMsg] = useState(false)

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')

  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault() // Stop page from refreshing
    setLoading(true)

    try {
      if (isLogin) {
        // LOGGING IN
        await signIn(email, password)
        toast.success('Welcome back! 👋')
        navigate('/') // Go to main chat page
      } else {
        // SIGNING UP
        if (username.length < 3) {
          toast.error('Username must be at least 3 characters')
          return
        }
        if (password.length < 6) {
          toast.error('Password must be at least 6 characters')
          return
        }

        await signUp(email, password, username, fullName)
        setShowVerifyMsg(true) // Show "check your email" message
        toast.success('Account created! Check your email 📧')
      }
    } catch (error) {
      toast.error(error.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Show this if they just signed up (need to verify email)
  if (showVerifyMsg) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.emoji}>📧</div>
          <h2 style={styles.title}>Check Your Email!</h2>
          <p style={styles.subtitle}>
            We sent a verification link to <strong>{email}</strong>.
            <br />Click it to activate your account, then come back to login!
          </p>
          <button
            style={styles.button}
            onClick={() => { setShowVerifyMsg(false); setIsLogin(true) }}
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* App Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>💬</div>
          <h1 style={styles.appName}>HeyChat</h1>
          <p style={styles.tagline}>Talk to anyone, anywhere, free.</p>
        </div>

        {/* Toggle Login / Signup */}
        <div style={styles.toggle}>
          <button
            style={{ ...styles.toggleBtn, ...(isLogin ? styles.toggleActive : {}) }}
            onClick={() => setIsLogin(true)}
          >
            Login
          </button>
          <button
            style={{ ...styles.toggleBtn, ...(!isLogin ? styles.toggleActive : {}) }}
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Only show these fields on Signup */}
          {!isLogin && (
            <>
              <div style={styles.field}>
                <label style={styles.label}>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required={!isLogin}
                  style={styles.input}
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  placeholder="johndoe123"
                  required={!isLogin}
                  style={styles.input}
                />
              </div>
            </>
          )}

          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '⏳ Please wait...' : isLogin ? '🚀 Login' : '✨ Create Account'}
          </button>
        </form>

        <p style={styles.switchText}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span
            style={styles.switchLink}
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Sign Up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  )
}

// Styles (CSS in JavaScript)
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  logo: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoIcon: {
    fontSize: '48px',
    marginBottom: '8px',
  },
  appName: {
    fontSize: '28px',
    fontWeight: '800',
    color: '#1a1a2e',
    margin: '0 0 4px',
  },
  tagline: {
    color: '#666',
    fontSize: '14px',
    margin: 0,
  },
  toggle: {
    display: 'flex',
    background: '#f0f0f0',
    borderRadius: '12px',
    padding: '4px',
    marginBottom: '24px',
  },
  toggleBtn: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    background: 'transparent',
    color: '#666',
    transition: 'all 0.2s',
  },
  toggleActive: {
    background: 'white',
    color: '#667eea',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#333',
  },
  input: {
    padding: '12px 16px',
    borderRadius: '10px',
    border: '2px solid #e0e0e0',
    fontSize: '15px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'transform 0.1s',
  },
  switchText: {
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
    marginTop: '20px',
    marginBottom: 0,
  },
  switchLink: {
    color: '#667eea',
    fontWeight: '700',
    cursor: 'pointer',
  },
  emoji: {
    fontSize: '64px',
    textAlign: 'center',
    marginBottom: '16px',
  },
  title: {
    textAlign: 'center',
    color: '#1a1a2e',
    fontSize: '24px',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    lineHeight: '1.6',
  },
}
