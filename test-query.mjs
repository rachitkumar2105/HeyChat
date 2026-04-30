import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gerciilefdfxlllbcmio.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlcmNpaWxlZmRmeGxsbGJjbWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODg2ODYsImV4cCI6MjA5MzA2NDY4Nn0.BOaEZuaaRa5Fm88D0PeC7nnTehFR0LvpL2xaK_QYS8M'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const userId = '11204859-968b-49fc-9a99-52e697d8c54c' // Use a hardcoded uuid or login
  const { data: auth } = await supabase.auth.signInWithPassword({
    email: 'rachitkumar2105@gmail.com',
    password: '#Rachit@2005'
  });
  
  if (auth.error) {
    console.error("Auth error:", auth.error)
    return;
  }
  
  const uid = auth.session.user.id;
  console.log("Logged in as:", uid);

  const res1 = await supabase
    .from('chat_members')
    .select('chat_id')
    .eq('user_id', uid)
  
  console.log("Bare query status:", res1.status, res1.error?.message);

  // New query
  const res2 = await supabase
    .from('chats')
    .select(`
      id, type, name, icon_url, last_message, last_message_at,
      chat_members!inner(user_id),
      all_members:chat_members(
        user_id,
        profiles(id, username, full_name, avatar_url, is_online, last_seen)
      )
    `)
    .eq('chat_members.user_id', uid)
    
  console.log("New query status:", res2.status, res2.error?.message);
}

test();
