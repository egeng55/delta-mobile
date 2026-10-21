import { conversationsApi, Conversation, ConversationMessage } from './api';
import { isCanonicalConversationId, newClientId } from './nativeId';

export interface SavedMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  imageUri?: string;
}

export interface SavedConversation {
  id: string;
  title: string;
  messages: SavedMessage[];
  createdAt: number;
  updatedAt: number;
}

function timestamp(value: string | number): number {
  const result = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(result)) throw new Error('Invalid conversation date');
  return result;
}

export function restoreConversationIndex(rows: Conversation[], cached: SavedConversation[]): SavedConversation[] {
  return rows.map(row => {
    if (!isCanonicalConversationId(row.id) || typeof row.title !== 'string') throw new Error('Invalid conversation');
    return {
      id: row.id, title: row.title,
      createdAt: timestamp(row.created_at), updatedAt: timestamp(row.updated_at),
      messages: cached.find(item => item.id === row.id)?.messages ?? [],
    };
  });
}

export function restoreMessages(rows: ConversationMessage[]): SavedMessage[] {
  return rows.map(row => {
    if (typeof row.id !== 'string' || typeof row.text !== 'string' || !['user', 'assistant'].includes(row.role)) {
      throw new Error('Invalid conversation message');
    }
    return { id: row.id, text: row.text, isUser: row.role === 'user', timestamp: timestamp(row.timestamp) };
  });
}

export async function ensureConversation(userId: string, currentId: string | null, title: string): Promise<string> {
  if (currentId && isCanonicalConversationId(currentId)) return currentId;
  const id = newClientId();
  const created = await conversationsApi.create(userId, id, title.trim().slice(0, 200) || 'New conversation');
  if (created.id !== id) throw new Error('Conversation identity mismatch');
  return id;
}
