// src/components/sidebar/NewChatModal.jsx
// Modal to find a user and start a new chat

import React, { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Modal from '../common/Modal'

export default function NewChatModal({ onClose, onStartChat }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const { user } = useAuth()

  const handleSearch = async (value) => {
    setSearch(value)
    if (value.length < 2) { setResults([]); return }
    setSearching(true)

    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, is_online')
      .or(`username.ilike.%${value}%,full_name.ilike.%${value}%`)
      .neq('id', user.id) // Don't show yourself
      .limit(10)

    setResults(data || [])
    setSearching(false)
  }

  const handleSelect = (userId) => {
    onStartChat(userId)
    onClose()
  }

  return (
    <Modal title="New Conversation" onClose={onClose}>
      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by name or username..."
        autoFocus
        style={styles.searchInput}
      />

      <div style={styles.results}>
        {searching && <div style={styles.hint}>Searching...</div>}
        {!searching && search.length > 1 && results.length === 0 && (
          <div style={styles.hint}>No users found for "{search}"</div>
        )}
        {results.map((u) => (
          <div key={u.id} style={styles.userItem} onClick={() => handleSelect(u.id)}>
            <div style={styles.avatar}>
              {u.avatar_url
                ? <img src={u.avatar_url} alt={u.full_name} style={styles.avatarImg} />
                : <div style={styles.avatarFallback}>{u.full_name?.charAt(0) || '?'}</div>
              }
              {u.is_online && <div style={styles.onlineDot} />}
            </div>
            <div>
              <div style={styles.name}>{u.full_name}</div>
              <div style={styles.username}>@{u.username}</div>
            </div>
          </div>
        ))}
        {search.length < 2 && (
          <div style={styles.hint}>Type at least 2 characters to search users</div>
        )}
      </div>
    </Modal>
  )
}

const styles = {
  searchInput: {
    width: '100%',
    padding: '12px 16px',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '16px',
  },
  results: { display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto' },
  hint: { color: '#999', fontSize: '14px', padding: '12px', textAlign: 'center' },
  userItem: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', borderRadius: '10px',
    cursor: 'pointer', transition: 'background 0.15s',
  },
  avatar: { position: 'relative', flexShrink: 0 },
  avatarImg: { width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' },
  avatarFallback: {
    width: '44px', height: '44px', borderRadius: '50%',
    background: '#667eea', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: '700', fontSize: '18px',
  },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: '11px', height: '11px', borderRadius: '50%',
    background: '#25d366', border: '2px solid white',
  },
  name: { fontWeight: '600', fontSize: '15px', color: '#111' },
  username: { fontSize: '12px', color: '#999' },
}
