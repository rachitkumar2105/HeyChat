// src/components/common/Modal.jsx
// Reusable popup modal (used by NewChat, GroupCreate, Profile, etc.)

import React, { useEffect } from 'react'

export default function Modal({ title, onClose, children, width = '400px' }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...styles.modal, width }}>
        <div style={styles.header}>
          <h3 style={styles.title}>{title}</h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  modal: {
    background: 'white', borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    maxWidth: '90vw', maxHeight: '85vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 20px', borderBottom: '1px solid #eee',
  },
  title: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#1a1a2e' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '18px', color: '#999', padding: '4px 8px', borderRadius: '6px',
  },
  body: { padding: '20px', overflowY: 'auto', flex: 1 },
}
