import { Router } from 'express';
import { z } from 'zod';
import { presentConversation, presentMessage, type AppContext } from '../context.js';
import { badRequest } from '../lib/errors.js';
import { limiters, parse, requireAuth, upload } from '../lib/http.js';
import { processVoice } from '../media/audio.js';
import { processChatImage } from '../media/image.js';
import type { ConversationRow, MessageMutation, MessageRow, Receipt } from '../types.js';
import { newObjectId } from './users.js';

const ConvParam = z.object({ id: z.uuid() });
const MsgParam = z.object({ id: z.coerce.number().int().positive() });
const OpenBody = z.object({ userId: z.uuid() });
const HistoryQuery = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
});
const clientId = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/).optional();
const replyTo = z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().int().positive().optional());

/** Reject strings that are only whitespace or contain control characters other than newline/tab. */
const messageText = (max: number) =>
  z
    .string()
    .max(max, `must be at most ${max} characters`)
    .transform((s) => s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim());

const ReadBody = z.object({ upTo: z.number().int().positive().optional() });
const ReactBody = z.object({ emoji: z.string().max(16).nullable() });

export function conversationRoutes(ctx: AppContext) {
  const r = Router();
  const { db, storage, hub, config } = ctx;
  r.use(requireAuth(ctx));

  const TextBody = z.object({ body: messageText(config.limits.textMax), clientId, replyToId: replyTo });
  const MediaFields = z.object({
    kind: z.enum(['image', 'voice']),
    caption: messageText(config.limits.captionMax).optional(),
    clientId,
    replyToId: replyTo,
  });

  function fanOut(event: string, m: MessageMutation, senderId: string) {
    const payload = { message: presentMessage(ctx, m.message) };
    hub.toUser(m.peerId, event, payload);
    hub.toUser(senderId, event, payload);
    return payload;
  }

  r.get('/', async (req, res) => {
    const rows = await db.call<ConversationRow[]>('hc_list_conversations', { p_user: req.userId });
    res.json({ conversations: rows.map((c) => presentConversation(ctx, c)) });
  });

  r.post('/', async (req, res) => {
    const { userId } = parse(OpenBody, req.body);
    const conv = await db.call<ConversationRow>('hc_open_direct', { p_user: req.userId, p_other: userId });
    res.json({ conversation: presentConversation(ctx, conv) });
  });

  r.get('/:id', async (req, res) => {
    const { id } = parse(ConvParam, req.params);
    const conv = await db.call<ConversationRow>('hc_get_conversation', { p_user: req.userId, p_conv: id });
    res.json({ conversation: presentConversation(ctx, conv) });
  });

  r.post('/:id/clear', async (req, res) => {
    const { id } = parse(ConvParam, req.params);
    const conv = await db.call<ConversationRow>('hc_clear_conversation', { p_user: req.userId, p_conv: id });
    res.json({ conversation: presentConversation(ctx, conv) });
  });

  r.get('/:id/messages', async (req, res) => {
    const { id } = parse(ConvParam, req.params);
    const q = parse(HistoryQuery, req.query);
    const rows = await db.call<MessageRow[]>('hc_get_messages', {
      p_user: req.userId,
      p_conv: id,
      p_before: q.before ?? null,
      p_limit: q.limit,
    });
    res.json({ messages: rows.map((m) => presentMessage(ctx, m)), hasMore: rows.length === q.limit });
  });

  r.post('/:id/messages', limiters.send, async (req, res) => {
    const { id } = parse(ConvParam, req.params);
    const body = parse(TextBody, req.body);
    if (!body.body) throw badRequest('empty_message', 'Type a message first.');
    const result = await db.call<MessageMutation>('hc_send_message', {
      p_user: req.userId,
      p_conv: id,
      p_kind: 'text',
      p_body: body.body,
      p_media: null,
      p_reply_to: body.replyToId ?? null,
      p_client_id: body.clientId ?? null,
    });
    const payload = result.duplicate
      ? { message: presentMessage(ctx, result.message) }
      : fanOut('message:new', result, req.userId!);
    res.status(result.duplicate ? 200 : 201).json(payload);
  });

  r.post('/:id/media', limiters.upload, upload(Math.max(config.limits.imageBytes, config.limits.voiceBytes)), async (req, res) => {
    const { id } = parse(ConvParam, req.params);
    const fields = parse(MediaFields, req.body);
    if (!req.file) throw badRequest('file_required', 'Attach a file to send.');

    // Membership + block check before doing expensive media work.
    await db.call('hc_get_conversation', { p_user: req.userId, p_conv: id });

    let media: Record<string, unknown>;
    let key: string;
    if (fields.kind === 'image') {
      if (req.file.size > config.limits.imageBytes) throw badRequest('file_too_large', 'Images can be up to 10 MB.');
      const img = await processChatImage(req.file.buffer);
      key = `c/${id}/img/${newObjectId()}.webp`;
      await storage.put(key, img.data, img.mime);
      media = { path: key, mime: img.mime, size: img.data.length, width: img.width, height: img.height, preview: img.preview };
    } else {
      if (req.file.size > config.limits.voiceBytes) throw badRequest('file_too_large', 'Voice notes can be up to 10 MB.');
      const voice = await processVoice(req.file.buffer, config.limits.voiceMaxSeconds);
      key = `c/${id}/voice/${newObjectId()}.mp3`;
      await storage.put(key, voice.data, voice.mime);
      media = { path: key, mime: voice.mime, size: voice.data.length, durationMs: voice.durationMs, waveform: voice.waveform };
    }

    let result: MessageMutation;
    try {
      result = await db.call<MessageMutation>('hc_send_message', {
        p_user: req.userId,
        p_conv: id,
        p_kind: fields.kind,
        p_body: fields.kind === 'image' ? fields.caption || null : null,
        p_media: media,
        p_reply_to: fields.replyToId ?? null,
        p_client_id: fields.clientId ?? null,
      });
    } catch (e) {
      await storage.remove([key]).catch(() => undefined);
      throw e;
    }
    if (result.duplicate) {
      await storage.remove([key]).catch(() => undefined);
      return res.json({ message: presentMessage(ctx, result.message) });
    }
    res.status(201).json(fanOut('message:new', result, req.userId!));
  });

  r.post('/:id/read', async (req, res) => {
    const { id } = parse(ConvParam, req.params);
    const { upTo } = parse(ReadBody, req.body ?? {});
    const receipt = await db.call<Receipt>('hc_mark_read', { p_user: req.userId, p_conv: id, p_upto: upTo ?? null });
    hub.toUser(receipt.peerId, 'receipt', receipt);
    hub.toUser(req.userId!, 'receipt', receipt);
    res.json({ receipt });
  });

  return r;
}

export function messageRoutes(ctx: AppContext) {
  const r = Router();
  const { db, storage, hub, config } = ctx;
  r.use(requireAuth(ctx));

  const EditBody = z.object({ body: messageText(config.limits.textMax) });

  function fanOut(m: MessageMutation, userId: string) {
    const payload = { message: presentMessage(ctx, m.message) };
    hub.toUser(m.peerId, 'message:updated', payload);
    hub.toUser(userId, 'message:updated', payload);
    return payload;
  }

  r.patch('/:id', limiters.send, async (req, res) => {
    const { id } = parse(MsgParam, req.params);
    const { body } = parse(EditBody, req.body);
    if (!body) throw badRequest('empty_message', 'A message cannot be empty.');
    const m = await db.call<MessageMutation>('hc_edit_message', { p_user: req.userId, p_message: id, p_body: body });
    res.json(fanOut(m, req.userId!));
  });

  r.delete('/:id', async (req, res) => {
    const { id } = parse(MsgParam, req.params);
    const m = await db.call<MessageMutation>('hc_delete_message', { p_user: req.userId, p_message: id });
    if (m.oldPath) storage.remove([m.oldPath]).catch((err) => ctx.log.warn({ err }, 'media cleanup failed'));
    res.json(fanOut(m, req.userId!));
  });

  r.put('/:id/reaction', limiters.send, async (req, res) => {
    const { id } = parse(MsgParam, req.params);
    const { emoji } = parse(ReactBody, req.body);
    if (emoji && !/^\p{Extended_Pictographic}/u.test(emoji)) throw badRequest('invalid_emoji', 'Pick an emoji.');
    const m = await db.call<MessageMutation>('hc_react', { p_user: req.userId, p_message: id, p_emoji: emoji || null });
    res.json(fanOut(m, req.userId!));
  });

  return r;
}
