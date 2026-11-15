-- HeyChat database schema
-- Run once in the Supabase SQL editor (safe to re-run: every statement is idempotent).
--
-- Security model
--   * The browser NEVER talks to Supabase. Only the backend does, using the service-role key.
--   * Every table has RLS enabled with no policies, and anon/authenticated roles have no grants,
--     so the public anon key (if it ever leaks) can read or write nothing.
--   * All business logic lives in hc_* functions so each API call is a single atomic round trip.
--     Errors are raised as 'HC<http status>:<code>' and mapped to HTTP responses by the API.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists app_users (
  id             uuid primary key default gen_random_uuid(),
  username       text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name   text not null check (char_length(display_name) between 1 and 40),
  bio            text not null default '' check (char_length(bio) <= 160),
  password_hash  text not null,
  avatar_path    text,
  token_version  integer not null default 0,
  last_seen_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists auth_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references app_users(id) on delete cascade,
  family_id    uuid not null,
  token_hash   text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  replaced_by  uuid
);
create index if not exists auth_sessions_user_idx on auth_sessions(user_id);
create index if not exists auth_sessions_family_idx on auth_sessions(family_id);

create table if not exists conversations (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null default 'direct' check (kind = 'direct'),
  direct_key       text not null unique,
  last_message_id  bigint not null default 0,
  last_message_at  timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id    uuid not null references conversations(id) on delete cascade,
  user_id            uuid not null references app_users(id) on delete cascade,
  last_read_id       bigint not null default 0,
  last_delivered_id  bigint not null default 0,
  cleared_before_id  bigint not null default 0,
  joined_at          timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on conversation_members(user_id);

create table if not exists chat_messages (
  id               bigint generated always as identity primary key,
  conversation_id  uuid not null references conversations(id) on delete cascade,
  sender_id        uuid not null references app_users(id) on delete cascade,
  client_id        text check (client_id is null or char_length(client_id) <= 64),
  kind             text not null check (kind in ('text', 'image', 'voice')),
  body             text check (body is null or char_length(body) <= 4000),
  media            jsonb,
  reply_to_id      bigint references chat_messages(id) on delete set null,
  edited_at        timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  unique (sender_id, client_id)
);
create index if not exists chat_messages_conv_idx on chat_messages(conversation_id, id desc);

create table if not exists message_reactions (
  message_id  bigint not null references chat_messages(id) on delete cascade,
  user_id     uuid not null references app_users(id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists user_blocks (
  blocker_id  uuid not null references app_users(id) on delete cascade,
  blocked_id  uuid not null references app_users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- Lock everything down: RLS on, no policies, no grants for public API roles.
do $$
declare t text;
begin
  foreach t in array array['app_users','auth_sessions','conversations','conversation_members',
                           'chat_messages','message_reactions','user_blocks']
  loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table %I from anon, authenticated', t);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant all on table %I to service_role', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- JSON shapes
-- ---------------------------------------------------------------------------

create or replace function hc_user_json(u app_users) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', u.id, 'username', u.username, 'displayName', u.display_name, 'bio', u.bio,
    'avatarPath', u.avatar_path, 'lastSeenAt', u.last_seen_at, 'createdAt', u.created_at)
$$;

create or replace function hc_message_json(m chat_messages) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', m.id,
    'conversationId', m.conversation_id,
    'senderId', m.sender_id,
    'clientId', m.client_id,
    'kind', m.kind,
    'body', case when m.deleted_at is null then m.body end,
    'media', case when m.deleted_at is null then m.media end,
    'editedAt', m.edited_at,
    'deletedAt', m.deleted_at,
    'createdAt', m.created_at,
    'replyTo', (
      select jsonb_build_object('id', r.id, 'senderId', r.sender_id, 'kind', r.kind,
        'body', case when r.deleted_at is null then left(r.body, 200) end,
        'deleted', r.deleted_at is not null)
      from chat_messages r where r.id = m.reply_to_id),
    'reactions', coalesce((
      select jsonb_agg(jsonb_build_object('userId', x.user_id, 'emoji', x.emoji) order by x.created_at)
      from message_reactions x where x.message_id = m.id), '[]'::jsonb))
$$;

create or replace function hc_conversation_json(p_user uuid, p_conv uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id,
    'createdAt', c.created_at,
    'lastMessageAt', c.last_message_at,
    'peer', hc_user_json(u),
    'lastMessage', (select hc_message_json(m) from chat_messages m
                    where m.id = c.last_message_id and m.id > me.cleared_before_id),
    'unreadCount', (select count(*) from chat_messages m
                    where m.conversation_id = c.id
                      and m.id > greatest(me.last_read_id, me.cleared_before_id)
                      and m.sender_id <> p_user and m.deleted_at is null),
    'myLastReadId', me.last_read_id,
    'peerLastReadId', peer.last_read_id,
    'peerLastDeliveredId', peer.last_delivered_id,
    'blockedByMe', exists (select 1 from user_blocks b where b.blocker_id = p_user and b.blocked_id = u.id))
  from conversations c
  join conversation_members me on me.conversation_id = c.id and me.user_id = p_user
  join conversation_members peer on peer.conversation_id = c.id and peer.user_id <> p_user
  join app_users u on u.id = peer.user_id
  where c.id = p_conv
$$;

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------

create or replace function hc_require_member(p_user uuid, p_conv uuid) returns conversation_members
language plpgsql stable set search_path = public as $$
declare r conversation_members;
begin
  select * into r from conversation_members where conversation_id = p_conv and user_id = p_user;
  if not found then raise exception 'HC404:conversation_not_found'; end if;
  return r;
end $$;

create or replace function hc_peer_id(p_user uuid, p_conv uuid) returns uuid
language sql stable set search_path = public as $$
  select user_id from conversation_members where conversation_id = p_conv and user_id <> p_user limit 1
$$;

create or replace function hc_is_blocked(p_a uuid, p_b uuid) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from user_blocks
                 where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a))
$$;

-- ---------------------------------------------------------------------------
-- Users and auth
-- ---------------------------------------------------------------------------

create or replace function hc_register(p_username text, p_display_name text, p_password_hash text)
returns jsonb language plpgsql set search_path = public as $$
declare u app_users;
begin
  insert into app_users(username, display_name, password_hash)
  values (lower(p_username), p_display_name, p_password_hash)
  returning * into u;
  return hc_user_json(u) || jsonb_build_object('tokenVersion', u.token_version);
exception when unique_violation then
  raise exception 'HC409:username_taken';
end $$;

create or replace function hc_get_user_auth(p_username text) returns jsonb
language sql stable set search_path = public as $$
  select hc_user_json(u) || jsonb_build_object('passwordHash', u.password_hash, 'tokenVersion', u.token_version)
  from app_users u where u.username = lower(p_username)
$$;

create or replace function hc_get_user_auth_by_id(p_user uuid) returns jsonb
language sql stable set search_path = public as $$
  select hc_user_json(u) || jsonb_build_object('passwordHash', u.password_hash, 'tokenVersion', u.token_version)
  from app_users u where u.id = p_user
$$;

create or replace function hc_get_user(p_user uuid) returns jsonb
language sql stable set search_path = public as $$
  select hc_user_json(u) || jsonb_build_object('tokenVersion', u.token_version) from app_users u where u.id = p_user
$$;

create or replace function hc_create_session(p_user uuid, p_family uuid, p_token_hash text,
                                             p_user_agent text, p_ttl_seconds integer)
returns uuid language sql set search_path = public as $$
  insert into auth_sessions(user_id, family_id, token_hash, user_agent, expires_at)
  values (p_user, coalesce(p_family, gen_random_uuid()), p_token_hash, left(p_user_agent, 300),
          now() + make_interval(secs => p_ttl_seconds))
  returning id
$$;

-- Refresh-token rotation with reuse detection. Returns {error} instead of raising so the
-- family revocation is committed even when a stolen token is replayed.
create or replace function hc_rotate_session(p_session uuid, p_token_hash text, p_new_hash text,
                                             p_user_agent text, p_ttl_seconds integer)
returns jsonb language plpgsql set search_path = public as $$
declare s auth_sessions; new_id uuid; u app_users;
begin
  select * into s from auth_sessions where id = p_session for update;
  if not found or s.token_hash <> p_token_hash then
    return jsonb_build_object('error', 'invalid');
  end if;
  if s.revoked_at is not null then
    update auth_sessions set revoked_at = coalesce(revoked_at, now()) where family_id = s.family_id;
    return jsonb_build_object('error', 'reused');
  end if;
  if s.expires_at < now() then
    update auth_sessions set revoked_at = now() where id = s.id;
    return jsonb_build_object('error', 'expired');
  end if;
  insert into auth_sessions(user_id, family_id, token_hash, user_agent, expires_at)
  values (s.user_id, s.family_id, p_new_hash, left(p_user_agent, 300), now() + make_interval(secs => p_ttl_seconds))
  returning id into new_id;
  update auth_sessions set revoked_at = now(), replaced_by = new_id where id = s.id;
  select * into u from app_users where id = s.user_id;
  return jsonb_build_object('sessionId', new_id,
                            'user', hc_user_json(u) || jsonb_build_object('tokenVersion', u.token_version));
end $$;

create or replace function hc_revoke_session(p_session uuid, p_token_hash text) returns void
language sql set search_path = public as $$
  update auth_sessions set revoked_at = now()
  where id = p_session and token_hash = p_token_hash and revoked_at is null
$$;

create or replace function hc_revoke_all_sessions(p_user uuid) returns jsonb
language plpgsql set search_path = public as $$
declare v integer;
begin
  update auth_sessions set revoked_at = now() where user_id = p_user and revoked_at is null;
  update app_users set token_version = token_version + 1, updated_at = now()
  where id = p_user returning token_version into v;
  return jsonb_build_object('tokenVersion', v);
end $$;

create or replace function hc_change_password(p_user uuid, p_new_hash text) returns jsonb
language plpgsql set search_path = public as $$
begin
  update app_users set password_hash = p_new_hash, updated_at = now() where id = p_user;
  return hc_revoke_all_sessions(p_user);
end $$;

create or replace function hc_update_profile(p_user uuid, p_display_name text, p_bio text) returns jsonb
language plpgsql set search_path = public as $$
declare u app_users;
begin
  update app_users set display_name = coalesce(p_display_name, display_name),
                       bio = coalesce(p_bio, bio), updated_at = now()
  where id = p_user returning * into u;
  if not found then raise exception 'HC404:user_not_found'; end if;
  return hc_user_json(u);
end $$;

-- Returns the new profile plus the previous avatar path so the API can delete the old file.
create or replace function hc_set_avatar(p_user uuid, p_path text) returns jsonb
language plpgsql set search_path = public as $$
declare old_path text; u app_users;
begin
  select avatar_path into old_path from app_users where id = p_user for update;
  update app_users set avatar_path = p_path, updated_at = now() where id = p_user returning * into u;
  return jsonb_build_object('user', hc_user_json(u), 'oldPath', old_path);
end $$;

create or replace function hc_search_users(p_user uuid, p_query text, p_limit integer) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(hc_user_json(u) order by (u.username = lower(p_query)) desc, u.username), '[]'::jsonb)
  from (
    select * from app_users u
    where u.id <> p_user
      and (u.username like replace(replace(lower(p_query), '\', ''), '%', '') || '%'
           or u.display_name ilike '%' || replace(replace(p_query, '\', ''), '%', '') || '%')
    order by u.username
    limit least(greatest(p_limit, 1), 25)
  ) u
$$;

create or replace function hc_set_last_seen(p_user uuid) returns timestamptz
language sql set search_path = public as $$
  update app_users set last_seen_at = now() where id = p_user returning last_seen_at
$$;

create or replace function hc_partner_ids(p_user uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(distinct o.user_id), '[]'::jsonb)
  from conversation_members me
  join conversation_members o on o.conversation_id = me.conversation_id and o.user_id <> me.user_id
  where me.user_id = p_user
$$;

create or replace function hc_set_block(p_user uuid, p_other uuid, p_block boolean) returns jsonb
language plpgsql set search_path = public as $$
begin
  if p_user = p_other then raise exception 'HC400:cannot_block_self'; end if;
  if not exists (select 1 from app_users where id = p_other) then raise exception 'HC404:user_not_found'; end if;
  if p_block then
    insert into user_blocks(blocker_id, blocked_id) values (p_user, p_other) on conflict do nothing;
  else
    delete from user_blocks where blocker_id = p_user and blocked_id = p_other;
  end if;
  return jsonb_build_object('blocked', p_block);
end $$;

-- Deletes the account. Returns every storage path owned by the user so the API can remove files.
create or replace function hc_delete_account(p_user uuid) returns jsonb
language plpgsql set search_path = public as $$
declare paths jsonb;
begin
  select coalesce(jsonb_agg(p), '[]'::jsonb) into paths from (
    select media->>'path' as p from chat_messages where sender_id = p_user and media ? 'path'
    union all select avatar_path from app_users where id = p_user and avatar_path is not null
  ) x;
  -- Direct conversations are meaningless with one member left: remove them entirely.
  select paths || coalesce(jsonb_agg(m.media->>'path'), '[]'::jsonb) into paths
  from chat_messages m
  where m.media ? 'path' and m.sender_id <> p_user
    and m.conversation_id in (select conversation_id from conversation_members where user_id = p_user);
  delete from conversations where id in (select conversation_id from conversation_members where user_id = p_user);
  delete from app_users where id = p_user;
  return jsonb_build_object('paths', paths);
end $$;

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------

create or replace function hc_open_direct(p_user uuid, p_other uuid) returns jsonb
language plpgsql set search_path = public as $$
declare k text; cid uuid;
begin
  if p_user = p_other then raise exception 'HC400:cannot_chat_with_self'; end if;
  if not exists (select 1 from app_users where id = p_other) then raise exception 'HC404:user_not_found'; end if;
  k := least(p_user::text, p_other::text) || ':' || greatest(p_user::text, p_other::text);
  select id into cid from conversations where direct_key = k;
  if cid is null then
    if hc_is_blocked(p_user, p_other) then raise exception 'HC403:blocked'; end if;
    insert into conversations(direct_key) values (k) on conflict (direct_key) do nothing returning id into cid;
    if cid is null then select id into cid from conversations where direct_key = k; end if;
    insert into conversation_members(conversation_id, user_id)
    values (cid, p_user), (cid, p_other) on conflict do nothing;
  end if;
  return hc_conversation_json(p_user, cid);
end $$;

create or replace function hc_list_conversations(p_user uuid) returns jsonb
language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(hc_conversation_json(p_user, c.id)
                            order by coalesce(c.last_message_at, c.created_at) desc), '[]'::jsonb)
  from conversations c
  join conversation_members me on me.conversation_id = c.id and me.user_id = p_user
  where c.last_message_id > 0
$$;

create or replace function hc_get_conversation(p_user uuid, p_conv uuid) returns jsonb
language plpgsql stable set search_path = public as $$
begin
  perform hc_require_member(p_user, p_conv);
  return hc_conversation_json(p_user, p_conv);
end $$;

create or replace function hc_clear_conversation(p_user uuid, p_conv uuid) returns jsonb
language plpgsql set search_path = public as $$
declare last_id bigint;
begin
  perform hc_require_member(p_user, p_conv);
  select last_message_id into last_id from conversations where id = p_conv;
  update conversation_members
  set cleared_before_id = last_id, last_read_id = greatest(last_read_id, last_id)
  where conversation_id = p_conv and user_id = p_user;
  return hc_conversation_json(p_user, p_conv);
end $$;

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------

create or replace function hc_get_messages(p_user uuid, p_conv uuid, p_before bigint, p_limit integer)
returns jsonb language plpgsql stable set search_path = public as $$
declare me conversation_members; result jsonb;
begin
  me := hc_require_member(p_user, p_conv);
  select coalesce(jsonb_agg(hc_message_json(m) order by m.id asc), '[]'::jsonb) into result
  from (
    select * from chat_messages
    where conversation_id = p_conv and id > me.cleared_before_id
      and (p_before is null or id < p_before)
    order by id desc
    limit least(greatest(p_limit, 1), 100)
  ) m;
  return result;
end $$;

create or replace function hc_send_message(p_user uuid, p_conv uuid, p_kind text, p_body text,
                                           p_media jsonb, p_reply_to bigint, p_client_id text)
returns jsonb language plpgsql set search_path = public as $$
declare m chat_messages; peer uuid;
begin
  perform hc_require_member(p_user, p_conv);
  peer := hc_peer_id(p_user, p_conv);
  if hc_is_blocked(p_user, peer) then raise exception 'HC403:blocked'; end if;

  if p_client_id is not null then
    select * into m from chat_messages where sender_id = p_user and client_id = p_client_id;
    if found then
      return jsonb_build_object('message', hc_message_json(m), 'peerId', peer, 'duplicate', true);
    end if;
  end if;

  if p_reply_to is not null and not exists (
    select 1 from chat_messages where id = p_reply_to and conversation_id = p_conv) then
    raise exception 'HC400:invalid_reply';
  end if;

  insert into chat_messages(conversation_id, sender_id, client_id, kind, body, media, reply_to_id)
  values (p_conv, p_user, p_client_id, p_kind, nullif(p_body, ''), p_media, p_reply_to)
  returning * into m;

  update conversations set last_message_id = m.id, last_message_at = m.created_at where id = p_conv;
  update conversation_members set last_read_id = m.id, last_delivered_id = m.id
  where conversation_id = p_conv and user_id = p_user;

  return jsonb_build_object('message', hc_message_json(m), 'peerId', peer, 'duplicate', false);
end $$;

create or replace function hc_edit_message(p_user uuid, p_message bigint, p_body text) returns jsonb
language plpgsql set search_path = public as $$
declare m chat_messages;
begin
  select * into m from chat_messages where id = p_message for update;
  if not found or m.sender_id <> p_user then raise exception 'HC404:message_not_found'; end if;
  if m.deleted_at is not null then raise exception 'HC409:message_deleted'; end if;
  if m.kind <> 'text' then raise exception 'HC400:only_text_editable'; end if;
  if m.created_at < now() - interval '15 minutes' then raise exception 'HC409:edit_window_passed'; end if;
  update chat_messages set body = p_body, edited_at = now() where id = p_message returning * into m;
  return jsonb_build_object('message', hc_message_json(m), 'peerId', hc_peer_id(p_user, m.conversation_id));
end $$;

create or replace function hc_delete_message(p_user uuid, p_message bigint) returns jsonb
language plpgsql set search_path = public as $$
declare m chat_messages; old_path text;
begin
  select * into m from chat_messages where id = p_message for update;
  if not found or m.sender_id <> p_user then raise exception 'HC404:message_not_found'; end if;
  if m.deleted_at is not null then
    return jsonb_build_object('message', hc_message_json(m), 'peerId', hc_peer_id(p_user, m.conversation_id),
                              'oldPath', null);
  end if;
  old_path := m.media->>'path';
  update chat_messages set deleted_at = now(), body = null, media = null where id = p_message returning * into m;
  delete from message_reactions where message_id = p_message;
  return jsonb_build_object('message', hc_message_json(m), 'peerId', hc_peer_id(p_user, m.conversation_id),
                            'oldPath', old_path);
end $$;

create or replace function hc_react(p_user uuid, p_message bigint, p_emoji text) returns jsonb
language plpgsql set search_path = public as $$
declare m chat_messages;
begin
  select * into m from chat_messages where id = p_message;
  if not found then raise exception 'HC404:message_not_found'; end if;
  perform hc_require_member(p_user, m.conversation_id);
  if m.deleted_at is not null then raise exception 'HC409:message_deleted'; end if;
  if p_emoji is null or p_emoji = '' then
    delete from message_reactions where message_id = p_message and user_id = p_user;
  else
    insert into message_reactions(message_id, user_id, emoji) values (p_message, p_user, p_emoji)
    on conflict (message_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
  return jsonb_build_object('message', hc_message_json(m), 'peerId', hc_peer_id(p_user, m.conversation_id));
end $$;

-- Receipts. Both return the caller's new pointers plus the peer to notify.
create or replace function hc_mark_read(p_user uuid, p_conv uuid, p_upto bigint) returns jsonb
language plpgsql set search_path = public as $$
declare me conversation_members; last_id bigint;
begin
  perform hc_require_member(p_user, p_conv);
  select last_message_id into last_id from conversations where id = p_conv;
  update conversation_members
  set last_read_id = greatest(last_read_id, least(coalesce(p_upto, last_id), last_id)),
      last_delivered_id = greatest(last_delivered_id, least(coalesce(p_upto, last_id), last_id))
  where conversation_id = p_conv and user_id = p_user
  returning * into me;
  return jsonb_build_object('conversationId', p_conv, 'userId', p_user, 'peerId', hc_peer_id(p_user, p_conv),
                            'lastReadId', me.last_read_id, 'lastDeliveredId', me.last_delivered_id);
end $$;

-- Marks everything delivered for a user (called when their socket connects).
-- Returns only conversations whose pointer actually moved, so we notify the minimum.
create or replace function hc_mark_all_delivered(p_user uuid) returns jsonb
language sql set search_path = public as $$
  with moved as (
    update conversation_members cm
    set last_delivered_id = c.last_message_id
    from conversations c
    where cm.conversation_id = c.id and cm.user_id = p_user and cm.last_delivered_id < c.last_message_id
    returning cm.conversation_id, cm.last_read_id, cm.last_delivered_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'conversationId', moved.conversation_id, 'userId', p_user,
    'peerId', hc_peer_id(p_user, moved.conversation_id),
    'lastReadId', moved.last_read_id, 'lastDeliveredId', moved.last_delivered_id)), '[]'::jsonb)
  from moved
$$;

create or replace function hc_mark_delivered(p_user uuid, p_conv uuid, p_upto bigint) returns jsonb
language plpgsql set search_path = public as $$
declare me conversation_members; last_id bigint;
begin
  perform hc_require_member(p_user, p_conv);
  select last_message_id into last_id from conversations where id = p_conv;
  update conversation_members
  set last_delivered_id = greatest(last_delivered_id, least(p_upto, last_id))
  where conversation_id = p_conv and user_id = p_user
  returning * into me;
  return jsonb_build_object('conversationId', p_conv, 'userId', p_user, 'peerId', hc_peer_id(p_user, p_conv),
                            'lastReadId', me.last_read_id, 'lastDeliveredId', me.last_delivered_id);
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges: only the backend (service_role) may call anything.
-- ---------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'hc\_%'
  loop
    execute format('revoke all on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', f.sig);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f.sig);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: one private bucket. Files are only reachable through short-lived
-- signed URLs that the API issues to conversation members.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('heychat-media', 'heychat-media', false, 15728640)
    on conflict (id) do update set public = false, file_size_limit = 15728640;
  end if;
end $$;

notify pgrst, 'reload schema';
