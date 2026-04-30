// src/components/chat/MessageBubble.jsx
// Each individual message bubble
// Shows: text/image/voice, time, read ticks, reactions, delete option

import React, { useState } from 'react'
import { format } from 'date-fns'
import EmojiReactionPicker from '../common/EmojiReactionPicker'

export default function MessageBubble({ message, isMe, chatType, onDelete, onReact }) {
  const [showActions, setShowActions] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showDeleteMenu, setShowDeleteMenu] = useState(false)

  const isDeleted = message.deleted_for_everyone

  // Group reactions by emoji (e.g., {"❤️": 3, "😂": 1})
  const reactionGroups = (message.reactions || []).reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1
    return acc
  }, {})

  const handleReact = (emoji) => {
    onReact(message.id, emoji)
    setShowEmojiPicker(false)
  }

  return (
    <div
      style={{
        ...styles.wrapper,
        justifyContent: isMe ? 'flex-end' : 'flex-start',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false)
        setShowDeleteMenu(false)
      }}
    >
      {/* Action buttons (appear on hover) */}
      {showActions && !isDeleted && (
        <div style={{ ...styles.actions, order: isMe ? 1 : 3 }}>
          <button style={styles.actionBtn} onClick={() => setShowEmojiPicker(true)} title="React">
            😊
          </button>
          <button
            style={styles.actionBtn}
            onClick={() => setShowDeleteMenu(!showDeleteMenu)}
            title="Delete"
          >
            🗑️
          </button>

          {/* Delete menu */}
          {showDeleteMenu && (
            <div style={{ ...styles.deleteMenu, right: isMe ? 'auto' : undefined, left: isMe ? 0 : 'auto' }}>
              <div style={styles.deleteOption} onClick={() => onDelete(message.id, false)}>
                Delete for me
              </div>
              {isMe && (
                <div style={styles.deleteOption} onClick={() => onDelete(message.id, true)}>
                  Delete for everyone
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* THE BUBBLE */}
      <div
        style={{
          ...styles.bubble,
          background: isMe ? '#dcf8c6' : 'white',
          order: 2,
          maxWidth: '65%',
        }}
      >
        {/* Sender name (in group chats, show who sent it) */}
        {chatType === 'group' && !isMe && message.sender && (
          <div style={styles.senderName}>
            {message.sender.full_name || message.sender.username}
          </div>
        )}

        {/* Message content */}
        {isDeleted ? (
          <span style={styles.deletedText}>🚫 This message was deleted</span>
        ) : message.type === 'image' ? (
          <img
            src={message.file_url}
            alt="shared"
            style={styles.messageImage}
            onClick={() => window.open(message.file_url, '_blank')}
          />
        ) : message.type === 'voice' ? (
          <div style={styles.voiceMessage}>
            <span>🎤</span>
            <audio controls src={message.file_url} style={styles.audioPlayer} />
            {message.content && (
              <p style={styles.transcription}>"{message.content}"</p>
            )}
          </div>
        ) : message.type === 'file' ? (
          <div style={styles.fileMessage}>
            <span>📎</span>
            <a href={message.file_url} target="_blank" rel="noreferrer" style={styles.fileLink}>
              {message.content || 'Download File'}
            </a>
          </div>
        ) : (
          <span style={styles.messageText}>{message.content}</span>
        )}

        {/* Time + Tick status */}
        <div style={styles.messageMeta}>
          <span style={styles.messageTime}>
            {format(new Date(message.created_at), 'HH:mm')}
          </span>
          {isMe && (
            <span style={{ ...styles.ticks, color: message.status === 'seen' ? '#53bdeb' : '#999' }}>
              {message.status === 'sent' ? '✓' : message.status === 'delivered' ? '✓✓' : '✓✓'}
            </span>
          )}
        </div>

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div style={styles.reactionsRow}>
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <span
                key={emoji}
                style={styles.reaction}
                onClick={() => handleReact(emoji)}
              >
                {emoji} {count > 1 ? count : ''}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Emoji Reaction Picker */}
      {showEmojiPicker && (
        <EmojiReactionPicker
          onSelect={handleReact}
          onClose={() => setShowEmojiPicker(false)}
          isMe={isMe}
        />
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
    marginBottom: '4px',
    position: 'relative',
  },
  bubble: {
    padding: '8px 12px',
    borderRadius: '12px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
    position: 'relative',
  },
  senderName: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#667eea',
    marginBottom: '4px',
  },
  messageText: {
    fontSize: '15px',
    lineHeight: '1.4',
    color: '#1a1a1a',
    wordBreak: 'break-word',
    display: 'block',
  },
  deletedText: {
    fontSize: '14px',
    color: '#999',
    fontStyle: 'italic',
  },
  messageImage: {
    maxWidth: '240px',
    maxHeight: '300px',
    borderRadius: '8px',
    display: 'block',
    cursor: 'pointer',
    objectFit: 'cover',
  },
  voiceMessage: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'flex-start',
  },
  audioPlayer: {
    width: '200px',
    height: '36px',
  },
  transcription: {
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
    margin: 0,
  },
  fileMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  fileLink: {
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '600',
  },
  messageMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '4px',
    marginTop: '4px',
  },
  messageTime: {
    fontSize: '11px',
    color: '#999',
  },
  ticks: {
    fontSize: '13px',
    fontWeight: '700',
  },
  reactionsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '6px',
  },
  reaction: {
    background: 'rgba(0,0,0,0.06)',
    borderRadius: '20px',
    padding: '2px 6px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    position: 'relative',
  },
  actionBtn: {
    background: 'white',
    border: 'none',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    cursor: 'pointer',
    fontSize: '14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteMenu: {
    position: 'absolute',
    top: '100%',
    background: 'white',
    borderRadius: '10px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    zIndex: 50,
    minWidth: '180px',
    overflow: 'hidden',
  },
  deleteOption: {
    padding: '10px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#e74c3c',
    transition: 'background 0.15s',
  },
}
