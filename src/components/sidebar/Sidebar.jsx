// src/components/sidebar/Sidebar.jsx
// The LEFT panel showing all your conversations
// Like the contacts list in WhatsApp

import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import ProfileModal from '../profile/ProfileModal'
import NewChatModal from './NewChatModal'
import GroupCreateModal from '../groups/GroupCreateModal'

export default function Sidebar({ chats, selectedChatId, onSelectChat, onStartNewChat, onChatsRefresh }) {
  const [search, setSearch] = useState('')
  const [showProfile, setShowProfile] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const { profile, signOut } = useAuth()

  // Filter chats based on search
  const filteredChats = chats.filter((chat) => {
    const chatName = getChatDisplayName(chat)
    return chatName.toLowerCase().includes(search.toLowerCase())
  })

  const handleSignOut = async () => {
    await signOut()
    toast.success('Logged out!')
  }

  return (
    <div style={styles.container}>
      {/* TOP BAR */}
      <div style={styles.topBar}>
        {/* My avatar */}
        <div
          style={styles.myAvatar}
          onClick={() => setShowProfile(true)}
          title="Edit Profile"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="me" style={styles.avatarImg} />
          ) : (
            <span style={styles.avatarInitials}>
              {getInitials(profile?.full_name || profile?.username)}
            </span>
          )}
        </div>

        {/* App title */}
        <span style={styles.appTitle}>💬 HeyChat</span>

        {/* Action buttons */}
        <div style={styles.actions}>
          <button style={styles.iconBtn} onClick={() => setShowNewChat(true)} title="New Chat">
            ✉️
          </button>
          <button style={styles.iconBtn} onClick={() => setShowNewGroup(true)} title="New Group">
            👥
          </button>
          <div style={{ position: 'relative' }}>
            <button style={styles.iconBtn} onClick={() => setShowMenu(!showMenu)} title="Menu">
              ⋮
            </button>
            {showMenu && (
              <div style={styles.dropMenu}>
                <div style={styles.dropItem} onClick={() => { setShowProfile(true); setShowMenu(false) }}>
                  👤 My Profile
                </div>
                <div style={styles.dropItem} onClick={handleSignOut}>
                  🚪 Logout
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div style={styles.searchBar}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations..."
          style={styles.searchInput}
        />
      </div>

      {/* CHAT LIST */}
      <div style={styles.chatList}>
        {filteredChats.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>💭</div>
            <p style={{ color: '#999', fontSize: '14px' }}>
              {search ? 'No chats found' : 'No conversations yet.\nClick ✉️ to start chatting!'}
            </p>
            {!search && (
              <button style={styles.startBtn} onClick={() => setShowNewChat(true)}>
                Start a Chat
              </button>
            )}
          </div>
        ) : (
          filteredChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isSelected={chat.id === selectedChatId}
              onClick={() => onSelectChat(chat)}
            />
          ))
        )}
      </div>

      {/* MODALS */}
      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)} />
      )}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onStartChat={onStartNewChat}
        />
      )}
      {showNewGroup && (
        <GroupCreateModal
          onClose={() => setShowNewGroup(false)}
          onCreated={onChatsRefresh}
        />
      )}
    </div>
  )
}

// Individual chat item in the list
function ChatItem({ chat, isSelected, onClick }) {
  const { user } = useAuth()

  // For DMs, get the OTHER person's info (not yours)
  const otherMember = chat.chat_members?.find((m) => m.user_id !== user?.id)
  const otherProfile = otherMember?.profiles

  const displayName = chat.type === 'group'
    ? chat.name
    : otherProfile?.full_name || otherProfile?.username || 'Unknown'

  const displayAvatar = chat.type === 'group' ? chat.icon_url : otherProfile?.avatar_url
  const isOnline = chat.type === 'dm' && otherProfile?.is_online

  const lastTime = chat.last_message_at
    ? formatDistanceToNow(new Date(chat.last_message_at), { addSuffix: false })
    : ''

  return (
    <div
      style={{
        ...styles.chatItem,
        background: isSelected ? '#e8f5e9' : 'transparent',
        borderLeft: isSelected ? '4px solid #25d366' : '4px solid transparent',
      }}
      onClick={onClick}
    >
      {/* Avatar */}
      <div style={styles.chatAvatar}>
        {displayAvatar ? (
          <img src={displayAvatar} alt={displayName} style={styles.chatAvatarImg} />
        ) : (
          <div style={{
            ...styles.chatAvatarFallback,
            background: chat.type === 'group' ? '#764ba2' : '#667eea',
          }}>
            {chat.type === 'group' ? '👥' : getInitials(displayName)}
          </div>
        )}
        {/* Online dot */}
        {isOnline && <div style={styles.onlineDot} />}
      </div>

      {/* Chat info */}
      <div style={styles.chatInfo}>
        <div style={styles.chatTop}>
          <span style={styles.chatName}>{displayName}</span>
          <span style={styles.chatTime}>{lastTime}</span>
        </div>
        <div style={styles.chatPreview}>
          {chat.last_message || 'Start a conversation!'}
        </div>
      </div>
    </div>
  )
}

// Helper: get initials from name (e.g., "John Doe" → "JD")
function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

// Helper: get display name for a chat
function getChatDisplayName(chat) {
  return chat.name || ''
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#f0f2f5',
    gap: '12px',
    borderBottom: '1px solid #e0e0e0',
  },
  myAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    overflow: 'hidden',
    cursor: 'pointer',
    background: '#667eea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitials: { color: 'white', fontWeight: '700', fontSize: '16px' },
  appTitle: { flex: 1, fontWeight: '700', fontSize: '18px', color: '#1a1a2e' },
  actions: { display: 'flex', gap: '4px' },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '20px',
    padding: '6px',
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  dropMenu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    zIndex: 100,
    minWidth: '160px',
    overflow: 'hidden',
  },
  dropItem: {
    padding: '12px 16px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background 0.15s',
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    margin: '8px 12px',
    background: '#f0f2f5',
    borderRadius: '20px',
    padding: '8px 12px',
    gap: '8px',
  },
  searchIcon: { fontSize: '16px' },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'none',
    outline: 'none',
    fontSize: '14px',
    color: '#333',
  },
  chatList: {
    flex: 1,
    overflowY: 'auto',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    padding: '20px',
    textAlign: 'center',
  },
  startBtn: {
    marginTop: '12px',
    padding: '10px 20px',
    background: '#25d366',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  chatItem: {
    display: 'flex',
    padding: '12px 16px',
    cursor: 'pointer',
    gap: '12px',
    alignItems: 'center',
    borderBottom: '1px solid #f5f5f5',
    transition: 'background 0.15s',
  },
  chatAvatar: { position: 'relative', flexShrink: 0 },
  chatAvatarImg: { width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' },
  chatAvatarFallback: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '700',
    fontSize: '18px',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#25d366',
    border: '2px solid white',
  },
  chatInfo: { flex: 1, minWidth: 0 },
  chatTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  chatName: { fontWeight: '600', fontSize: '15px', color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chatTime: { fontSize: '11px', color: '#999', flexShrink: 0, marginLeft: '8px' },
  chatPreview: { fontSize: '13px', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
}
