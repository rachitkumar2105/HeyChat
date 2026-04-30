// src/components/chat/MessageInput.jsx
// The bottom input bar where you type and send messages
// Has: text, emoji, image/file upload, voice recording

import React, { useState, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { transcribeAudio } from '../../lib/huggingface'
import EmojiPickerPopup from '../common/EmojiPickerPopup'
import toast from 'react-hot-toast'

export default function MessageInput({ chatId, onSend }) {
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  const fileInputRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  // Send a text message
  const handleSendText = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    setShowEmoji(false)
    await onSend(trimmed, 'text')
  }

  // Press Enter to send
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  // Upload image or file
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    toast.loading('Uploading file...')

    try {
      const ext = file.name.split('.').pop()
      const path = `${chatId}/${Date.now()}.${ext}`
      const bucket = file.type.startsWith('image/') ? 'images' : 'files'

      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: false })

      if (error) throw error

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path)
      const type = file.type.startsWith('image/') ? 'image' : 'file'
      await onSend(file.name, type, urlData.publicUrl)
      toast.dismiss()
      toast.success('File sent!')
    } catch (err) {
      toast.dismiss()
      toast.error('Upload failed. Try again!')
    } finally {
      setIsUploading(false)
      e.target.value = '' // Reset file input
    }
  }

  // START recording voice
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Timer to show recording duration
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1)
      }, 1000)
    } catch {
      toast.error('Cannot access microphone. Allow microphone permission!')
    }
  }

  // STOP recording and send voice note
  const stopRecording = async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    setIsRecording(false)
    clearInterval(timerRef.current)

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })

      setIsUploading(true)
      toast.loading('Processing voice note...')

      try {
        // Upload the voice file
        const path = `${chatId}/voice-${Date.now()}.webm`
        const { error } = await supabase.storage
          .from('voice-notes')
          .upload(path, blob)

        if (error) throw error

        const { data: urlData } = supabase.storage
          .from('voice-notes')
          .getPublicUrl(path)

        // Try to transcribe (convert voice to text)
        let transcription = ''
        try {
          transcription = await transcribeAudio(blob)
        } catch {
          // It's OK if transcription fails - voice note still works
        }

        await onSend(transcription, 'voice', urlData.publicUrl)
        toast.dismiss()
        toast.success('Voice note sent! 🎤')
      } catch {
        toast.dismiss()
        toast.error('Failed to send voice note')
      } finally {
        setIsUploading(false)
      }

      // Stop all tracks
      recorder.stream.getTracks().forEach((t) => t.stop())
    }

    recorder.stop()
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div style={styles.container}>
      {/* EMOJI PICKER (pops up above) */}
      {showEmoji && (
        <EmojiPickerPopup
          onSelect={(emoji) => setText((t) => t + emoji)}
          onClose={() => setShowEmoji(false)}
        />
      )}

      {/* INPUT ROW */}
      <div style={styles.inputRow}>
        {/* Emoji button */}
        <button
          style={styles.iconBtn}
          onClick={() => setShowEmoji(!showEmoji)}
          title="Emoji"
        >
          😊
        </button>

        {/* File/Image upload */}
        <button
          style={styles.iconBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          title="Send File"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {/* Text input (or recording indicator) */}
        {isRecording ? (
          <div style={styles.recordingIndicator}>
            <span style={styles.recordingDot}>●</span>
            <span style={{ color: '#e74c3c', fontSize: '14px' }}>
              Recording {formatTime(recordingTime)}
            </span>
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            style={styles.textInput}
          />
        )}

        {/* Send button OR Voice record button */}
        {text.trim() ? (
          <button style={styles.sendBtn} onClick={handleSendText}>
            ➤
          </button>
        ) : (
          <button
            style={{
              ...styles.iconBtn,
              color: isRecording ? '#e74c3c' : '#333',
            }}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            title={isRecording ? 'Release to send' : 'Hold to record voice'}
          >
            🎤
          </button>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    position: 'relative',
    background: '#f0f2f5',
    borderTop: '1px solid #e0e0e0',
    padding: '8px 16px',
  },
  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'white',
    borderRadius: '24px',
    padding: '6px 12px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '20px',
    padding: '4px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontSize: '15px',
    lineHeight: '1.5',
    background: 'transparent',
    fontFamily: 'inherit',
    maxHeight: '120px',
    padding: '4px 0',
  },
  sendBtn: {
    background: '#25d366',
    border: 'none',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    color: 'white',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(37,211,102,0.4)',
  },
  recordingIndicator: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
  },
  recordingDot: {
    color: '#e74c3c',
    fontSize: '20px',
    animation: 'pulse 1s infinite',
  },
}
