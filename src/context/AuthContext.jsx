// src/context/AuthContext.jsx
// This is like the app's memory of WHO is logged in
// Every part of the app can check: "Is someone logged in? Who?"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Create a "box" that holds login info
const AuthContext = createContext({})

// This wraps your whole app so every page can see who's logged in
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // The logged-in user
  const [profile, setProfile] = useState(null) // Their profile (name, photo, etc.)
  const [loading, setLoading] = useState(true)  // Are we still checking?

  useEffect(() => {
    // Check if someone is already logged in when app starts
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      try {
        if (error) throw error
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id, session)
        }
      } catch (err) {
        console.error('Session error:', err)
      } finally {
        setLoading(false)
      }
    })

    // Listen for login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          setUser(session?.user ?? null)
          if (session?.user) {
            await fetchProfile(session.user.id, session)
            // Mark user as online
            await supabase.from('profiles').update({
              is_online: true,
              last_seen: new Date().toISOString(),
            }).eq('id', session.user.id)
          } else {
            setProfile(null)
          }
        } catch (err) {
          console.error('Auth state change error:', err)
        } finally {
          setLoading(false)
        }
      }
    )

    // When tab closes, mark user as offline
    const handleOffline = async () => {
      if (user) {
        await supabase.from('profiles').update({
          is_online: false,
          last_seen: new Date().toISOString(),
        }).eq('id', user.id)
      }
    }

    window.addEventListener('beforeunload', handleOffline)
    return () => {
      subscription.unsubscribe()
      window.removeEventListener('beforeunload', handleOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchProfile = async (userId, session) => {
    try {
      let { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
        
      if (!data && session?.user) {
        // Auto-recover missing profile
        const newProfile = {
          id: userId,
          username: session.user.email.split('@')[0] + Math.floor(Math.random() * 1000),
          full_name: 'HeyChat User',
          is_online: true
        }
        await supabase.from('profiles').insert(newProfile)
        data = newProfile
      }
      setProfile(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfile(null)
    }
  }

  const signUp = async (email, password, username, fullName) => {
    // Step 1: Create the login account
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error

    // Step 2: Create their profile (name, username, etc.)
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        username: username.toLowerCase(),
        full_name: fullName,
        is_online: false,
      })
    }

    return data
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    if (user) {
      await supabase.from('profiles').update({
        is_online: false,
        last_seen: new Date().toISOString(),
      }).eq('id', user.id)
    }
    await supabase.auth.signOut()
  }

  const updateProfile = async (updates) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()
    if (error) throw error
    setProfile(data)
    return data
  }

  // Share all this info with the whole app
  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    fetchProfile: () => fetchProfile(user?.id, { user }),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Easy way for any component to get the login info
export const useAuth = () => useContext(AuthContext)
