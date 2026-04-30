// src/components/common/EmojiReactionPicker.jsx
// Quick 6-emoji reaction picker that appears on hover

import React from 'react'

const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍']

export default function EmojiReactionPicker({ onSelect, onClose, isMe }) {
  return (
    <div
      style={{
        ...styles.picker,
        [isMe ? 'right' : 'left']: '0',
      }}
      onMouseLeave={onClose}
    >
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          style={styles.emojiBtn}
          onClick={() => onSelect(emoji)}
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

const styles = {
  picker: {
    position: 'absolute',
    bottom: '110%',
    display: 'flex',
    background: 'white',
    borderRadius: '24px',
    padding: '6px 8px',
    gap: '4px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    zIndex: 50,
    border: '1px solid #eee',
  },
  emojiBtn: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '50%',
    transition: 'transform 0.1s',
    lineHeight: 1,
  },
}
