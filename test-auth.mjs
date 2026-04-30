import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gerciilefdfxlllbcmio.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlcmNpaWxlZmRmeGxsbGJjbWlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODg2ODYsImV4cCI6MjA5MzA2NDY4Nn0.BOaEZuaaRa5Fm88D0PeC7nnTehFR0LvpL2xaK_QYS8M'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  let loading = true;
  const setLoading = (v) => { loading = v; console.log("Loading set to", v); }

  console.log("Starting getSession");
  supabase.auth.getSession().then(async ({ data: { session }, error }) => {
    try {
      console.log("getSession .then called. Error:", error);
    } catch (err) {
      console.error('Session error:', err)
    } finally {
      setLoading(false)
    }
  }).catch(e => {
    console.log("getSession catch block called:", e);
  });

  console.log("Setting up onAuthStateChange");
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      try {
        console.log("onAuthStateChange called with event:", event);
      } catch (err) {
        console.error('Auth state change error:', err)
      } finally {
        setLoading(false)
      }
    }
  )

  await new Promise(r => setTimeout(r, 2000));
}

test();
