export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  lastSeenAt: string | null;
  online: boolean;
  createdAt: string;
}

export interface Media {
  url: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  preview?: string;
  durationMs?: number;
  waveform?: number[];
}

export interface Message {
  id: number;
  conversationId: string;
  senderId: string;
  clientId: string | null;
  kind: 'text' | 'image' | 'voice';
  body: string | null;
  media: Media | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  replyTo: { id: number; senderId: string; kind: string; body: string | null; deleted: boolean } | null;
  reactions: { userId: string; emoji: string }[];
}

/** A message as held in the client: may be optimistic (no server id yet). */
export interface LocalMessage extends Message {
  pending?: boolean;
  failed?: string;
  progress?: number;
  localFile?: Blob;
}

export interface Conversation {
  id: string;
  createdAt: string;
  lastMessageAt: string | null;
  peer: User;
  lastMessage: Message | null;
  unreadCount: number;
  myLastReadId: number;
  peerLastReadId: number;
  peerLastDeliveredId: number;
  blockedByMe: boolean;
}

export interface Receipt {
  conversationId: string;
  userId: string;
  lastReadId: number;
  lastDeliveredId: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}
