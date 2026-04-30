// src/components/profile/ProfileModal.jsx
// Edit your name, bio, profile picture, and privacy settings

import React, { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

export default function ProfileModal({ onClose }) {
  const { profile, updateProfile, user } = useAuth()
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [showLastSeen, setShowLastSeen] = useState(profile?.show_last_seen ?? true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`

      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)

      await updateProfile({ avatar_url: data.publicUrl })
      toast.success('Profile picture updated! 📸')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile({
        full_name: fullName,
        bio,
        show_last_seen: showLastSeen,
      })
      toast.success('Profile saved! ✅')
      onClose()
    } catch {
      toast.error('Failed to save. Try again!')
    } finally {
      setSaving(false)
    }
  }

  const initials = (profile?.full_name || profile?.username || '?')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <Modal title="👤 My Profile" onClose={onClose}>
      {/* Avatar */}
      <div style={styles.avatarSection}>
        <label style={styles.avatarWrapper} title="Click to change photo">
          <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" style={styles.avatarImg} />
          ) : (
            <div style={styles.avatarFallback}>{initials}</div>
          )}
          <div style={styles.avatarOverlay}>
            {uploading ? '⏳' : '📷'}
          </div>
        </label>
        <div>
          <div style={styles.username}>@{profile?.username}</div>
          <div style={{ fontSize: '13px', color: '#999' }}>Click photo to change</div>
        </div>
      </div>

      {/* Form */}
      <div style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={styles.input}
            placeholder="Your full name"
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{ ...styles.input, height: '80px', resize: 'vertical' }}
            placeholder="Tell people about yourself..."
            maxLength={150}
          />
          <span style={{ fontSize: '11px', color: '#999' }}>{bio.length}/150</span>
        </div>

        {/* Privacy toggle */}
        <div style={styles.toggle}>
          <div>
            <div style={styles.toggleLabel}>Show Last Seen</div>
            <div style={styles.toggleHint}>Others can see when you were last active</div>
          </div>
          <label style={styles.switch}>
            <input
              type="checkbox"
              checked={showLastSeen}
              onChange={(e) => setShowLastSeen(e.target.checked)}
              style={{ display: 'none' }}
            />
            <div style={{
              ...styles.switchTrack,
              background: showLastSeen ? '#25d366' : '#ccc',
            }}>
              <div style={{
                ...styles.switchThumb,
                transform: showLastSeen ? 'translateX(20px)' : 'translateX(0)',
              }} />
            </div>
          </label>
        </div>

        <button
          style={{ ...styles.saveBtn, opacity: saving ? 0.7 : 1 }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : '💾 Save Profile'}
        </button>
      </div>
    </Modal>
  )
}

const styles = {
  avatarSection: {
    display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px',
  },
  avatarWrapper: {
    position: 'relative', cursor: 'pointer', flexShrink: 0,
    width: '72px', height: '72px', borderRadius: '50%', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: {
    width: '100%', height: '100%', background: '#667eea',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: '700', fontSize: '24px',
  },
  avatarOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontSize: '22px', opacity: 0,
    transition: 'opacity 0.2s',
  },
  username: { fontWeight: '700', fontSize: '16px', color: '#1a1a2e' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#333' },
  input: {
    padding: '11px 14px', border: '2px solid #e0e0e0',
    borderRadius: '10px', fontSize: '14px', outline: 'none',
    fontFamily: 'inherit', width: '100%', boxSizing: 'border-box',
  },
  toggle: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px', background: '#f8f9fa', borderRadius: '12px',
  },
  toggleLabel: { fontWeight: '600', fontSize: '14px', color: '#333' },
  toggleHint: { fontSize: '12px', color: '#999', marginTop: '2px' },
  switch: { cursor: 'pointer' },
  switchTrack: {
    width: '44px', height: '24px', borderRadius: '12px',
    position: 'relative', transition: 'background 0.2s',
  },
  switchThumb: {
    position: 'absolute', top: '2px', left: '2px',
    width: '20px', height: '20px', borderRadius: '50%',
    background: 'white', transition: 'transform 0.2s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  saveBtn: {
    padding: '13px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white', border: 'none', borderRadius: '12px',
    fontSize: '15px', fontWeight: '700', cursor: 'pointer',
  },
}
