export interface UserRow {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarPath: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  tokenVersion?: number;
  passwordHash?: string;
}

export interface ImageMedia {
  path: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  preview: string;
}

export interface VoiceMedia {
  path: string;
  mime: string;
  size: number;
  durationMs: number;
  waveform: number[];
}

export type MediaRow = ImageMedia | VoiceMedia;

export interface MessageRow {
  id: number;
  conversationId: string;
  senderId: string;
  clientId: string | null;
  kind: 'text' | 'image' | 'voice';
  body: string | null;
  media: MediaRow | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  replyTo: { id: number; senderId: string; kind: string; body: string | null; deleted: boolean } | null;
  reactions: Array<{ userId: string; emoji: string }>;
}

export interface ConversationRow {
  id: string;
  createdAt: string;
  lastMessageAt: string | null;
  peer: UserRow;
  lastMessage: MessageRow | null;
  unreadCount: number;
  myLastReadId: number;
  peerLastReadId: number;
  peerLastDeliveredId: number;
  blockedByMe: boolean;
}

export interface MessageMutation {
  message: MessageRow;
  peerId: string;
  duplicate?: boolean;
  oldPath?: string | null;
}

export interface Receipt {
  conversationId: string;
  userId: string;
  peerId: string;
  lastReadId: number;
  lastDeliveredId: number;
}
