-- ============================================================
-- HEYCHAT RLS INFINITE RECURSION FIX
-- Copy ALL of this and paste it into Supabase → SQL Editor → Run
-- ============================================================

-- 1. Create a security definer function to check chat membership safely
-- This bypasses RLS internally, preventing the infinite recursion loop!
create or replace function get_my_chat_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select chat_id from chat_members where user_id = auth.uid();
$$;

-- 2. Drop the broken policies that cause infinite recursion
drop policy if exists "chat_members_select" on chat_members;
drop policy if exists "chats_select" on chats;
drop policy if exists "messages_select" on messages;

-- 3. Create the corrected policies using the new helper function

-- For chat_members: You can see all members of any chat you belong to
create policy "chat_members_select" on chat_members for select
  using (
    chat_id in (select get_my_chat_ids())
  );

-- For chats: You can see any chat you belong to
create policy "chats_select" on chats for select
  using (
    id in (select get_my_chat_ids())
  );

-- For messages: You can read messages in any chat you belong to, 
-- except from people who blocked you
create policy "messages_select" on messages for select
  using (
    chat_id in (select get_my_chat_ids())
    and not exists (
      select 1 from blocks
      where blocker_id = messages.sender_id and blocked_id = auth.uid()
    )
  );
