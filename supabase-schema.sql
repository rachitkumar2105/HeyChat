-- ============================================================
-- CHATWAVE - COMPLETE SUPABASE DATABASE SETUP
-- Copy ALL of this and paste it into Supabase → SQL Editor → Run
-- ============================================================

-- ── 1. PROFILES TABLE ──────────────────────────────────────
-- Stores every user's public info (name, photo, bio, etc.)
create table if not exists profiles (
  id            uuid references auth.users on delete cascade primary key,
  username      text unique not null,
  full_name     text,
  avatar_url    text,
  bio           text default '',
  last_seen     timestamptz default now(),
  show_last_seen boolean default true,
  is_online     boolean default false,
  created_at    timestamptz default now()
);

-- ── 2. CHATS TABLE ─────────────────────────────────────────
-- One row per conversation (DM or Group)
create table if not exists chats (
  id              uuid primary key default gen_random_uuid(),
  type            text check (type in ('dm','group')) not null,
  name            text,           -- Only for groups
  icon_url        text,           -- Only for groups
  created_by      uuid references profiles(id) on delete set null,
  last_message    text,
  last_message_at timestamptz default now(),
  created_at      timestamptz default now()
);

-- ── 3. CHAT MEMBERS TABLE ──────────────────────────────────
-- Who is in each chat
create table if not exists chat_members (
  chat_id    uuid references chats(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  role       text check (role in ('admin','member')) default 'member',
  joined_at  timestamptz default now(),
  primary key (chat_id, user_id)
);

-- ── 4. MESSAGES TABLE ──────────────────────────────────────
-- Every message ever sent
create table if not exists messages (
  id                   uuid primary key default gen_random_uuid(),
  chat_id              uuid references chats(id) on delete cascade,
  sender_id            uuid references profiles(id) on delete set null,
  content              text,
  type                 text check (type in ('text','image','file','voice')) default 'text',
  file_url             text,
  status               text check (status in ('sent','delivered','seen')) default 'sent',
  deleted_for          uuid[] default '{}',   -- Array of user IDs who deleted this for themselves
  deleted_for_everyone boolean default false,
  created_at           timestamptz default now()
);

-- ── 5. REACTIONS TABLE ─────────────────────────────────────
-- Emoji reactions on messages
create table if not exists reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid references messages(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id)   -- One reaction per user per message
);

-- ── 6. STATUSES TABLE ──────────────────────────────────────
-- WhatsApp-style stories/statuses (auto-delete after 24h)
create table if not exists statuses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  content    text,
  media_url  text,
  visibility text check (visibility in ('everyone','close_friends')) default 'everyone',
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

-- ── 7. STATUS VIEWS TABLE ──────────────────────────────────
-- Track who viewed each status
create table if not exists status_views (
  status_id  uuid references statuses(id) on delete cascade,
  viewer_id  uuid references profiles(id) on delete cascade,
  viewed_at  timestamptz default now(),
  primary key (status_id, viewer_id)
);

-- ── 8. FRIENDSHIPS TABLE ───────────────────────────────────
-- Friend requests and close friends
create table if not exists friendships (
  id              uuid primary key default gen_random_uuid(),
  requester_id    uuid references profiles(id) on delete cascade,
  addressee_id    uuid references profiles(id) on delete cascade,
  status          text check (status in ('pending','accepted','rejected')) default 'pending',
  is_close_friend boolean default false,
  created_at      timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- ── 9. BLOCKS TABLE ────────────────────────────────────────
-- Blocked users
create table if not exists blocks (
  blocker_id uuid references profiles(id) on delete cascade,
  blocked_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);

-- ── 10. REPORTS TABLE ──────────────────────────────────────
-- User/message reports for moderation
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete cascade,
  reported_id uuid references profiles(id) on delete set null,
  message_id  uuid references messages(id) on delete set null,
  reason      text,
  created_at  timestamptz default now()
);

-- ── 11. NOTIFICATIONS TABLE ────────────────────────────────
-- In-app notifications
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade,
  type       text,      -- 'message', 'friend_request', 'status', etc.
  data       jsonb,     -- Extra data (sender name, message preview, etc.)
  is_read    boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ENABLE REALTIME (so messages appear instantly!)
-- ============================================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table chats;
alter publication supabase_realtime add table chat_members;
alter publication supabase_realtime add table reactions;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table statuses;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Who can see/edit what
-- Think of this as a bouncer for your data
-- ============================================================

-- Enable RLS on all tables
alter table profiles       enable row level security;
alter table chats          enable row level security;
alter table chat_members   enable row level security;
alter table messages       enable row level security;
alter table reactions      enable row level security;
alter table statuses       enable row level security;
alter table status_views   enable row level security;
alter table friendships    enable row level security;
alter table blocks         enable row level security;
alter table reports        enable row level security;
alter table notifications  enable row level security;

-- ── PROFILES POLICIES ──────────────────────────────────────
-- Anyone logged in can read profiles
create policy "profiles_select" on profiles for select
  using (auth.uid() is not null);

-- You can only update YOUR OWN profile
create policy "profiles_update" on profiles for update
  using (auth.uid() = id);

-- You can insert your own profile (happens on signup)
create policy "profiles_insert" on profiles for insert
  with check (auth.uid() = id);

-- ── CHATS POLICIES ─────────────────────────────────────────
-- You can only see chats you are a member of
create policy "chats_select" on chats for select
  using (
    exists (
      select 1 from chat_members
      where chat_id = chats.id and user_id = auth.uid()
    )
  );

-- Anyone logged in can create a chat
create policy "chats_insert" on chats for insert
  with check (auth.uid() is not null);

-- Only chat admins can update group info
create policy "chats_update" on chats for update
  using (
    exists (
      select 1 from chat_members
      where chat_id = chats.id
        and user_id = auth.uid()
        and role = 'admin'
    )
    or created_by = auth.uid()
  );

-- ── CHAT MEMBERS POLICIES ──────────────────────────────────
create policy "chat_members_select" on chat_members for select
  using (
    exists (
      select 1 from chat_members cm2
      where cm2.chat_id = chat_members.chat_id and cm2.user_id = auth.uid()
    )
  );

create policy "chat_members_insert" on chat_members for insert
  with check (auth.uid() is not null);

create policy "chat_members_delete" on chat_members for delete
  using (user_id = auth.uid() or
    exists (
      select 1 from chat_members cm
      where cm.chat_id = chat_members.chat_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );

-- ── MESSAGES POLICIES ──────────────────────────────────────
-- Only chat members can read messages
create policy "messages_select" on messages for select
  using (
    exists (
      select 1 from chat_members
      where chat_id = messages.chat_id and user_id = auth.uid()
    )
    -- Block: you cannot see messages from someone who blocked you
    and not exists (
      select 1 from blocks
      where blocker_id = messages.sender_id and blocked_id = auth.uid()
    )
  );

-- Only chat members can send messages
create policy "messages_insert" on messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from chat_members
      where chat_id = messages.chat_id and user_id = auth.uid()
    )
  );

-- Members can update messages (for status, delete, etc.)
create policy "messages_update" on messages for update
  using (
    exists (
      select 1 from chat_members
      where chat_id = messages.chat_id and user_id = auth.uid()
    )
  );

-- ── REACTIONS POLICIES ─────────────────────────────────────
create policy "reactions_select" on reactions for select
  using (auth.uid() is not null);

create policy "reactions_insert" on reactions for insert
  with check (auth.uid() = user_id);

create policy "reactions_delete" on reactions for delete
  using (auth.uid() = user_id);

-- ── STATUSES POLICIES ──────────────────────────────────────
create policy "statuses_select" on statuses for select
  using (
    auth.uid() = user_id  -- You can always see your own
    or (
      visibility = 'everyone'
      and not exists (
        select 1 from blocks
        where blocker_id = statuses.user_id and blocked_id = auth.uid()
      )
    )
    or (
      visibility = 'close_friends'
      and exists (
        select 1 from friendships
        where (
          (requester_id = statuses.user_id and addressee_id = auth.uid())
          or (requester_id = auth.uid() and addressee_id = statuses.user_id)
        )
        and status = 'accepted'
        and is_close_friend = true
      )
    )
  );

create policy "statuses_insert" on statuses for insert
  with check (auth.uid() = user_id);

create policy "statuses_delete" on statuses for delete
  using (auth.uid() = user_id);

-- ── STATUS VIEWS POLICIES ──────────────────────────────────
create policy "status_views_select" on status_views for select
  using (auth.uid() is not null);

create policy "status_views_insert" on status_views for insert
  with check (auth.uid() = viewer_id);

-- ── FRIENDSHIPS POLICIES ───────────────────────────────────
create policy "friendships_select" on friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships_insert" on friendships for insert
  with check (auth.uid() = requester_id);

create policy "friendships_update" on friendships for update
  using (auth.uid() = addressee_id or auth.uid() = requester_id);

create policy "friendships_delete" on friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ── BLOCKS POLICIES ────────────────────────────────────────
create policy "blocks_select" on blocks for select
  using (auth.uid() = blocker_id);

create policy "blocks_insert" on blocks for insert
  with check (auth.uid() = blocker_id);

create policy "blocks_delete" on blocks for delete
  using (auth.uid() = blocker_id);

-- ── REPORTS POLICIES ───────────────────────────────────────
create policy "reports_insert" on reports for insert
  with check (auth.uid() = reporter_id);

-- ── NOTIFICATIONS POLICIES ─────────────────────────────────
create policy "notifications_select" on notifications for select
  using (auth.uid() = user_id);

create policy "notifications_update" on notifications for update
  using (auth.uid() = user_id);

-- ============================================================
-- HELPER FUNCTION: Find existing DM chat between 2 users
-- Called from your React app to avoid duplicate DMs
-- ============================================================
create or replace function find_dm_chat(user1 uuid, user2 uuid)
returns table(chat_id uuid) as $$
  select cm1.chat_id
  from chat_members cm1
  join chat_members cm2 on cm1.chat_id = cm2.chat_id
  join chats c on c.id = cm1.chat_id
  where cm1.user_id = user1
    and cm2.user_id = user2
    and c.type = 'dm'
  limit 1;
$$ language sql security definer;

-- ============================================================
-- AUTO-DELETE EXPIRED STATUSES (run this as a cron job or manually)
-- You can schedule this in Supabase → Database → Cron Jobs
-- ============================================================
-- delete from statuses where expires_at < now();

-- ============================================================
-- STORAGE BUCKETS SETUP
-- Go to Supabase → Storage → Create these 4 buckets:
-- 1. avatars     (public: true)
-- 2. images      (public: true)
-- 3. files       (public: true)
-- 4. voice-notes (public: true)
-- ============================================================
-- Run this to create them via SQL:
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('images', 'images', true),
  ('files', 'files', true),
  ('voice-notes', 'voice-notes', true)
on conflict (id) do nothing;

-- Storage policies (anyone logged in can upload/read)
create policy "storage_avatars_select" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "storage_avatars_insert" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);

create policy "storage_avatars_update" on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid() is not null);

create policy "storage_images_all" on storage.objects for all
  using (bucket_id = 'images' and auth.uid() is not null);

create policy "storage_images_select" on storage.objects for select
  using (bucket_id = 'images');

create policy "storage_files_all" on storage.objects for all
  using (bucket_id = 'files' and auth.uid() is not null);

create policy "storage_files_select" on storage.objects for select
  using (bucket_id = 'files');

create policy "storage_voice_all" on storage.objects for all
  using (bucket_id = 'voice-notes' and auth.uid() is not null);

create policy "storage_voice_select" on storage.objects for select
  using (bucket_id = 'voice-notes');
