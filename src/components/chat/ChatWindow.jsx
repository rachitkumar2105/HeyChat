// src/components/chat/ChatWindow.jsx
// The RIGHT panel - the actual conversation!
// Shows messages, input box, and all chat features

import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useMessages } from '../../hooks/useMessages'
import { supabase } from '../../lib/supabaseClient'
import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'
import ChatHeader from './ChatHeader'
import toast from 'react-hot-toast'

export default function ChatWindow({ chat, onBack, isMobile, onChatsRefresh }) {
  const { user, profile } = useAuth()
  const { messages, loading, sendMessage, deleteMessage, clearChat, addReaction } = useMessages(chat.id)
  const messagesEndRef = useRef(null) // Reference to bottom of messages

  // Get the other person's profile (for DM chats)
  const otherMember = chat.chat_members?.find((m) => m.user_id !== user?.id)
  const otherProfile = otherMember?.profiles

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (content, type = 'text', fileUrl = null) => {
    try {
      await sendMessage(content, type, fileUrl)
    } catch (err) {
      toast.error('Failed to send message. Try again!')
    }
  }

  const handleDeleteMessage = async (messageId, forEveryone) => {
    await deleteMessage(messageId, forEveryone)
    toast.success(forEveryone ? 'Deleted for everyone' : 'Message deleted')
  }

  const handleClearChat = async () => {
    if (window.confirm('Clear all messages? This cannot be undone.')) {
      await clearChat()
      toast.success('Chat cleared!')
    }
  }

  const displayName = chat.type === 'group'
    ? chat.name
    : otherProfile?.full_name || otherProfile?.username || 'Unknown'

  const isOnline = chat.type === 'dm' && otherProfile?.is_online
  const lastSeen = otherProfile?.last_seen

  return (
    <div style={styles.container}>
      {/* TOP HEADER */}
      <ChatHeader
        displayName={displayName}
        chat={chat}
        otherProfile={otherProfile}
        isOnline={isOnline}
        lastSeen={lastSeen}
        onBack={onBack}
        isMobile={isMobile}
        onClearChat={handleClearChat}
        onChatsRefresh={onChatsRefresh}
      />

      {/* MESSAGES AREA */}
      <div style={styles.messagesArea}>
        {/* Background pattern like WhatsApp */}
        <div style={styles.bgPattern} />

        <div style={styles.messagesList}>
          {loading ? (
            <div style={styles.loadingText}>Loading messages...</div>
          ) : messages.length === 0 ? (
            <div style={styles.emptyChat}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>👋</div>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Say hello to {displayName}!
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isMe = message.sender_id === user?.id
              const showDateSeparator = index === 0 ||
                new Date(message.created_at).toDateString() !==
                new Date(messages[index - 1]?.created_at).toDateString()

              return (
                <React.Fragment key={message.id}>
                  {/* Date separator (e.g., "Today", "Yesterday") */}
                  {showDateSeparator && (
                    <div style={styles.dateSeparator}>
                      <span style={styles.dateLabel}>
                        {formatDate(message.created_at)}
                      </span>
                    </div>
                  )}

                  <MessageBubble
                    message={message}
                    isMe={isMe}
                    chatType={chat.type}
                    onDelete={handleDeleteMessage}
                    onReact={addReaction}
                  />
                </React.Fragment>
              )
            })
          )}
          {/* Invisible div to scroll to */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* MESSAGE INPUT BAR */}
      <MessageInput
        chatId={chat.id}
        onSend={handleSendMessage}
      />
    </div>
  )
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: '#efeae2',
  },
  messagesArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  bgPattern: {
    position: 'absolute',
    inset: 0,
    background: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8c8c8' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    opacity: 0.5,
  },
  messagesList: {
    position: 'relative',
    zIndex: 1,
    height: '100%',
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  loadingText: {
    textAlign: 'center',
    color: '#999',
    padding: '40px',
    fontSize: '14px',
  },
  emptyChat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '40px',
    textAlign: 'center',
  },
  dateSeparator: {
    display: 'flex',
    justifyContent: 'center',
    margin: '12px 0',
  },
  dateLabel: {
    background: 'rgba(255,255,255,0.85)',
    color: '#666',
    fontSize: '12px',
    padding: '4px 12px',
    borderRadius: '12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
  },
}
