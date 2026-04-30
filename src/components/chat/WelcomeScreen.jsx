// src/components/chat/WelcomeScreen.jsx
import React from 'react'

export default function WelcomeScreen({ profile }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8f9fa',
      gap: '16px',
      padding: '40px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '80px' }}>💬</div>
      <h2 style={{ color: '#1a1a2e', fontSize: '24px', margin: 0 }}>
        Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}! 👋
      </h2>
      <p style={{ color: '#666', fontSize: '16px', maxWidth: '360px', lineHeight: '1.6' }}>
        Select a conversation from the left, or click ✉️ to start a new one.
        Your messages are end-to-end private.
      </p>
      <div style={{
        display: 'flex',
        gap: '24px',
        marginTop: '12px',
        color: '#999',
        fontSize: '14px',
      }}>
        <span>✉️ New Chat</span>
        <span>👥 New Group</span>
        <span>🎤 Voice Notes</span>
      </div>
    </div>
  )
}
