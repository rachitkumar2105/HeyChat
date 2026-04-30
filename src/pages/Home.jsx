// src/pages/Home.jsx
// This is the MAIN page after login
// It has: Left sidebar (chat list) + Right panel (the actual chat)
// Exactly like WhatsApp Web!

import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/sidebar/Sidebar'
import ChatWindow from '../components/chat/ChatWindow'
import WelcomeScreen from '../components/chat/WelcomeScreen'

export default function Home() {
  const [selectedChat, setSelectedChat] = useState(null) // Which chat is open?
  const [chats, setChats] = useState([])                 // List of all chats
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [showChat, setShowChat] = useState(false)        // Mobile: show chat or sidebar?
  const { user, profile } = useAuth()

  useEffect(() => {
    let chatChannel = null

    if (user) {
      fetchChats()
      chatChannel = subscribeToChats()
    }

    // Handle window resize for mobile
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (chatChannel) {
        supabase.removeChannel(chatChannel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const fetchChats = async () => {
    // Get all chats where I am a member
    const { data, error } = await supabase
      .from('chat_members')
      .select(`
        chat_id,
        chats(
          id, type, name, icon_url, last_message, last_message_at,
          chat_members(
            user_id,
            profiles(id, username, full_name, avatar_url, is_online, last_seen)
          )
        )
      `)
      .eq('user_id', user.id)

    if (!error && data) {
      const chatList = data
        .map((item) => item.chats)
        .filter(Boolean)
        .sort((a, b) => {
          const dateA = new Date(a.last_message_at || 0)
          const dateB = new Date(b.last_message_at || 0)
          return dateB - dateA
        })
      setChats(chatList)
    }
  }

  const subscribeToChats = () => {
    // Listen for new chats in real-time
    const channel = supabase.channel('chat_updates')
    
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chats',
    }, () => fetchChats())
    
    channel.subscribe()
    return channel
  }

  const handleSelectChat = (chat) => {
    setSelectedChat(chat)
    if (isMobile) setShowChat(true)
  }

  const handleBackToSidebar = () => {
    setShowChat(false)
    setSelectedChat(null)
  }

  const startNewChat = async (otherUserId) => {
    // Check if a DM already exists between us
    const { data: existing } = await supabase.rpc('find_dm_chat', {
      user1: user.id,
      user2: otherUserId,
    })

    if (existing && existing.length > 0) {
      // Open the existing chat
      const chat = chats.find((c) => c.id === existing[0].chat_id)
      if (chat) handleSelectChat(chat)
      return
    }

    // Create a new DM chat
    const { data: newChat, error } = await supabase
      .from('chats')
      .insert({ type: 'dm', created_by: user.id })
      .select()
      .single()

    if (error || !newChat) return

    // Add both people as members
    await supabase.from('chat_members').insert([
      { chat_id: newChat.id, user_id: user.id, role: 'member' },
      { chat_id: newChat.id, user_id: otherUserId, role: 'member' },
    ])

    await fetchChats()
    handleSelectChat(newChat)
  }

  return (
    <div style={styles.container}>
      {/* ===== LEFT SIDEBAR ===== */}
      <div style={{
        ...styles.sidebar,
        display: isMobile ? (showChat ? 'none' : 'flex') : 'flex',
      }}>
        <Sidebar
          chats={chats}
          selectedChatId={selectedChat?.id}
          onSelectChat={handleSelectChat}
          onStartNewChat={startNewChat}
          onChatsRefresh={fetchChats}
        />
      </div>

      {/* ===== RIGHT CHAT PANEL ===== */}
      <div style={{
        ...styles.chatPanel,
        display: isMobile ? (showChat ? 'flex' : 'none') : 'flex',
      }}>
        {selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            onBack={handleBackToSidebar}
            isMobile={isMobile}
            onChatsRefresh={fetchChats}
          />
        ) : (
          <WelcomeScreen profile={profile} />
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
    background: '#f0f2f5',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  sidebar: {
    width: '380px',
    minWidth: '380px',
    flexDirection: 'column',
    background: 'white',
    borderRight: '1px solid #e0e0e0',
  },
  chatPanel: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
}
