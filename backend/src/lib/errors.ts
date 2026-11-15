export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

const MESSAGES: Record<string, string> = {
  username_taken: 'That username is already taken.',
  invalid_credentials: 'Incorrect username or password.',
  conversation_not_found: 'Conversation not found.',
  message_not_found: 'Message not found.',
  user_not_found: 'User not found.',
  blocked: "You can't message this person.",
  cannot_chat_with_self: "You can't start a chat with yourself.",
  cannot_block_self: "You can't block yourself.",
  invalid_reply: 'The message you replied to no longer exists.',
  message_deleted: 'This message was deleted.',
  only_text_editable: 'Only text messages can be edited.',
  edit_window_passed: 'Messages can only be edited within 15 minutes.',
};

/** Database functions raise 'HC<status>:<code>'. Convert those into AppErrors. */
export function fromDbMessage(message: string | undefined): AppError | null {
  const m = /^HC(\d{3}):([a-z_]+)$/.exec(message ?? '');
  if (!m) return null;
  const status = Number(m[1]);
  const code = m[2]!;
  return new AppError(status, code, MESSAGES[code] ?? code);
}

export const badRequest = (code: string, message?: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (code = 'unauthorized', message = 'Please sign in again.') =>
  new AppError(401, code, message);
export const forbidden = (code = 'forbidden', message = 'Not allowed.') => new AppError(403, code, message);
export const notFound = (code = 'not_found', message = 'Not found.') => new AppError(404, code, message);
