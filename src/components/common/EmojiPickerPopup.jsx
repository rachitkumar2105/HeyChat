// src/components/common/EmojiPickerPopup.jsx
// Full emoji picker (using emoji-mart library)
// Appears above the message input when you click 😊

import React, { useEffect, useRef } from 'react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'

export default function EmojiPickerPopup({ onSelect, onClose }) {
  const ref = useRef(null)

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: '8px',
        zIndex: 100,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}
    >
      <Picker
        data={data}
        onEmojiSelect={(e) => onSelect(e.native)}
        theme="light"
        previewPosition="none"
        skinTonePosition="none"
        searchPosition="sticky"
        navPosition="bottom"
        perLine={8}
        emojiSize={22}
      />
    </div>
  )
}
