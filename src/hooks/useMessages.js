// src/hooks/useMessages.js
// This hook handles EVERYTHING about messages:
// - Loading old messages
// - Sending new messages
// - Real-time updates (instant delivery!)
// - Read receipts (ticks)

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

export function useMessages(chatId) {
  const [messages, setMessages] = useState([])  // All messages in this chat
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const subscriptionRef = useRef(null)

  useEffect(() => {
    if (!chatId) return

    // Load old messages first
    fetchMessages()

    // Then subscribe to NEW messages in real-time
    // This is like subscribing to a TV channel - new messages arrive instantly!
    subscriptionRef.current = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            // New message arrived! Add it to the list
            setMessages((prev) => {
              // Don't add duplicates
              if (prev.find((m) => m.id === payload.new.id)) return prev
              return [...prev, payload.new]
            })
            // Mark as delivered if it's not from me
            if (payload.new.sender_id !== user?.id) {
              markDelivered(payload.new.id)
            }
          } else if (payload.eventType === 'UPDATE') {
            // Message was updated (e.g., status changed to "seen")
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            )
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Mark all unread messages as "seen" when I open this chat
    markAllSeen(chatId)

    return () => {
      // Unsubscribe when leaving this chat
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
      }
    }
  }, [chatId, user?.id])

  const fetchMessages = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, username, full_name, avatar_url),
        reactions(id, user_id, emoji, profiles(username, full_name))
      `)
      .eq('chat_id', chatId)
      .eq('deleted_for_everyone', false)
      .order('created_at', { ascending: true })

    if (!error && data) {
      // Filter out messages the current user deleted ("clear chat" feature)
      const filtered = data.filter((msg) => {
        const deletedFor = msg.deleted_for || []
        return !deletedFor.includes(user?.id)
      })
      setMessages(filtered)
    }
    setLoading(false)
  }

  const sendMessage = async (content, type = 'text', fileUrl = null) => {
    if (!chatId || !user) return

    const { error } = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: user.id,
      content,
      type,
      file_url: fileUrl,
      status: 'sent',
    })

    if (error) throw error

    // Update the chat's last activity
    await supabase
      .from('chats')
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq('id', chatId)
  }

  const markDelivered = async (messageId) => {
    await supabase
      .from('messages')
      .update({ status: 'delivered' })
      .eq('id', messageId)
      .eq('status', 'sent') // Only update if still "sent"
  }

  const markAllSeen = async (chatId) => {
    await supabase
      .from('messages')
      .update({ status: 'seen' })
      .eq('chat_id', chatId)
      .neq('sender_id', user?.id) // Don't update MY own messages
      .in('status', ['sent', 'delivered'])
  }

  const deleteMessage = async (messageId, forEveryone = false) => {
    if (forEveryone) {
      // Delete for everyone - actually removes the content
      await supabase
        .from('messages')
        .update({ deleted_for_everyone: true, content: 'This message was deleted' })
        .eq('id', messageId)
        .eq('sender_id', user.id) // Only sender can delete for everyone
    } else {
      // Delete only for me - adds my ID to the "deleted_for" list
      const message = messages.find((m) => m.id === messageId)
      const currentDeletedFor = message?.deleted_for || []
      await supabase
        .from('messages')
        .update({ deleted_for: [...currentDeletedFor, user.id] })
        .eq('id', messageId)
      // Remove from local state immediately
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
    }
  }

  const clearChat = async () => {
    // Mark all messages in this chat as deleted for me
    const { data } = await supabase
      .from('messages')
      .select('id, deleted_for')
      .eq('chat_id', chatId)

    if (data) {
      for (const msg of data) {
        const deletedFor = msg.deleted_for || []
        if (!deletedFor.includes(user.id)) {
          await supabase
            .from('messages')
            .update({ deleted_for: [...deletedFor, user.id] })
            .eq('id', msg.id)
        }
      }
      setMessages([]) // Clear locally immediately
    }
  }

  const addReaction = async (messageId, emoji) => {
    // Remove existing reaction from this user, then add new one
    await supabase
      .from('reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)

    await supabase.from('reactions').insert({
      message_id: messageId,
      user_id: user.id,
      emoji,
    })
  }

  return { messages, loading, sendMessage, deleteMessage, clearChat, addReaction }
}
