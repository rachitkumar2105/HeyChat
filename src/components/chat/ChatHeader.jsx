// src/components/chat/ChatHeader.jsx
// The TOP bar of the chat showing name, online status, and options menu

import React, { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import toast from 'react-hot-toast'

export default function ChatHeader({
  displayName, chat, otherProfile,
  isOnline, lastSeen,
  onBack, isMobile, onClearChat, onChatsRefresh,
}) {
  const [showMenu, setShowMenu] = useState(false)
  const { user } = useAuth()

  const getSubtitle = () => {
    if (chat.type === 'group') {
      const count = chat.chat_members?.length || 0
      return `${count} members`
    }
    if (!otherProfile) return ''
    if (isOnline) return '🟢 Online'
    if (lastSeen) {
      return `Last seen ${formatDistanceToNow(new Date(lastSeen), { addSuffix: true })}`
    }
    return ''
  }

  const handleBlock = async () => {
    if (!otherProfile) return
    await supabase.from('blocks').insert({
      blocker_id: user.id,
      blocked_id: otherProfile.id,
    })
    toast.success(`${displayName} has been blocked`)
    setShowMenu(false)
  }

  const handleReport = async () => {
    const reason = prompt('Why are you reporting this user?')
    if (!reason) return
    await supabase.from('reports').insert({
      reporter_id: user.id,
      reported_id: otherProfile?.id,
      reason,
    })
    toast.success('Report submitted. Thank you!')
    setShowMenu(false)
  }

  const getAvatar = () => {
    const src = chat.type === 'group' ? chat.icon_url : otherProfile?.avatar_url
    const name = displayName
    const bg = chat.type === 'group' ? '#764ba2' : '#667eea'

    return src ? (
      <img src={src} alt={name} style={styles.headerAvatarImg} />
    ) : (
      <div style={{ ...styles.headerAvatarFallback, background: bg }}>
        {chat.type === 'group' ? '👥' : name?.charAt(0)?.toUpperCase() || '?'}
      </div>
    )
  }

  return (
    <div style={styles.header}>
      {/* Back button (mobile only) */}
      {isMobile && (
        <button style={styles.backBtn} onClick={onBack}>
          ←
        </button>
      )}

      {/* Avatar */}
      <div style={styles.headerAvatar}>{getAvatar()}</div>

      {/* Name + status */}
      <div style={styles.headerInfo}>
        <div style={styles.headerName}>{displayName}</div>
        <div style={styles.headerStatus}>{getSubtitle()}</div>
      </div>

      {/* Menu */}
      <div style={{ position: 'relative' }}>
        <button style={styles.menuBtn} onClick={() => setShowMenu(!showMenu)}>
          ⋮
        </button>
        {showMenu && (
          <div style={styles.menu}>
            <div style={styles.menuItem} onClick={() => { onClearChat(); setShowMenu(false) }}>
              🧹 Clear Chat
            </div>
            {chat.type === 'dm' && (
              <>
                <div style={styles.menuItem} onClick={handleBlock}>
                  🚫 Block User
                </div>
                <div style={{ ...styles.menuItem, color: '#e74c3c' }} onClick={handleReport}>
                  ⚠️ Report User
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    background: '#f0f2f5',
    borderBottom: '1px solid #e0e0e0',
    gap: '12px',
    zIndex: 10,
  },
  backBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: '#333',
    padding: '4px 8px',
  },
  headerAvatar: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
  },
  headerAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  headerAvatarFallback: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '700',
    fontSize: '18px',
  },
  headerInfo: { flex: 1 },
  headerName: { fontWeight: '700', fontSize: '16px', color: '#111' },
  headerStatus: { fontSize: '12px', color: '#666' },
  menuBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '4px 8px',
    color: '#555',
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    zIndex: 100,
    minWidth: '180px',
    overflow: 'hidden',
  },
  menuItem: {
    padding: '12px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background 0.15s',
    color: '#333',
  },
}
