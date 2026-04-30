// src/components/groups/GroupCreateModal.jsx
// Create a new group chat

import React, { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

export default function GroupCreateModal({ onClose, onCreated }) {
  const [groupName, setGroupName] = useState('')
  const [searchUser, setSearchUser] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [creating, setCreating] = useState(false)
  const { user } = useAuth()

  const searchUsers = async (val) => {
    setSearchUser(val)
    if (val.length < 2) { setSearchResults([]); return }

    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .or(`username.ilike.%${val}%,full_name.ilike.%${val}%`)
      .neq('id', user.id)
      .limit(8)

    setSearchResults(data?.filter((u) => !selectedMembers.find((m) => m.id === u.id)) || [])
  }

  const addMember = (u) => {
    setSelectedMembers((prev) => [...prev, u])
    setSearchResults((prev) => prev.filter((r) => r.id !== u.id))
    setSearchUser('')
  }

  const removeMember = (id) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== id))
  }

  const createGroup = async () => {
    if (!groupName.trim()) { toast.error('Enter a group name!'); return }
    if (selectedMembers.length < 1) { toast.error('Add at least 1 member!'); return }

    setCreating(true)
    try {
      // Create the group chat
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({ type: 'group', name: groupName.trim(), created_by: user.id })
        .select()
        .single()

      if (error) throw error

      // Add all members including creator (as admin)
      const members = [
        { chat_id: newChat.id, user_id: user.id, role: 'admin' },
        ...selectedMembers.map((m) => ({ chat_id: newChat.id, user_id: m.id, role: 'member' })),
      ]

      await supabase.from('chat_members').insert(members)

      toast.success(`Group "${groupName}" created! 🎉`)
      onCreated()
      onClose()
    } catch (err) {
      toast.error('Failed to create group. Try again!')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal title="👥 Create New Group" onClose={onClose}>
      {/* Group Name */}
      <div style={{ marginBottom: '16px' }}>
        <label style={styles.label}>Group Name *</label>
        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="e.g., Family, Work Team, Friends..."
          style={styles.input}
          maxLength={50}
        />
      </div>

      {/* Add Members */}
      <div style={{ marginBottom: '16px' }}>
        <label style={styles.label}>Add Members</label>
        <input
          type="text"
          value={searchUser}
          onChange={(e) => searchUsers(e.target.value)}
          placeholder="Search users to add..."
          style={styles.input}
        />

        {/* Search results */}
        {searchResults.length > 0 && (
          <div style={styles.searchResults}>
            {searchResults.map((u) => (
              <div key={u.id} style={styles.userRow} onClick={() => addMember(u)}>
                <span>{u.full_name} (@{u.username})</span>
                <span style={{ color: '#667eea' }}>+ Add</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected members chips */}
      {selectedMembers.length > 0 && (
        <div style={styles.chips}>
          {selectedMembers.map((m) => (
            <div key={m.id} style={styles.chip}>
              <span>{m.full_name || m.username}</span>
              <button style={styles.chipRemove} onClick={() => removeMember(m.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <button
        style={{ ...styles.createBtn, opacity: creating ? 0.7 : 1 }}
        onClick={createGroup}
        disabled={creating}
      >
        {creating ? 'Creating...' : `✨ Create Group (${selectedMembers.length + 1} members)`}
      </button>
    </Modal>
  )
}

const styles = {
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#333', marginBottom: '6px' },
  input: {
    width: '100%', padding: '11px 14px', border: '2px solid #e0e0e0',
    borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  },
  searchResults: {
    border: '1px solid #eee', borderRadius: '10px',
    marginTop: '6px', overflow: 'hidden',
  },
  userRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', cursor: 'pointer', fontSize: '14px',
    borderBottom: '1px solid #f5f5f5',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' },
  chip: {
    display: 'flex', alignItems: 'center', gap: '6px',
    background: '#e8f5e9', color: '#2e7d32',
    borderRadius: '20px', padding: '4px 12px', fontSize: '13px',
  },
  chipRemove: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#e74c3c', fontSize: '14px', padding: 0, lineHeight: 1,
  },
  createBtn: {
    width: '100%', padding: '13px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white', border: 'none', borderRadius: '12px',
    fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginTop: '8px',
  },
}
