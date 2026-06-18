import {
  createCacheEnvelope,
  readCacheEnvelope,
  trimArrayToLimit,
  trimArrayToMostRecent,
} from './cachePolicy';

export const CHAT_TRANSCRIPT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_PERSISTED_CONVERSATIONS = 10;
export const MAX_MESSAGES_PER_CONVERSATION = 50;

export interface CachedChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  imageUri?: string;
}

export interface CachedConversation {
  id: string;
  title: string;
  messages: CachedChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatTranscriptReadResult<T extends CachedConversation> {
  conversations: T[];
  expired: boolean;
  invalid: boolean;
  fromLegacy: boolean;
}

export function minimizeSavedConversationsForCache<T extends CachedConversation>(
  conversations: readonly T[]
): T[] {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  return trimArrayToLimit(sorted, MAX_PERSISTED_CONVERSATIONS).map((conversation) => ({
    ...conversation,
    messages: trimArrayToMostRecent(conversation.messages ?? [], MAX_MESSAGES_PER_CONVERSATION),
  })) as T[];
}

export function createChatTranscriptCache<T extends CachedConversation>(
  conversations: readonly T[],
  now: number = Date.now()
): string {
  const minimized = minimizeSavedConversationsForCache(conversations);
  return JSON.stringify(createCacheEnvelope(minimized, CHAT_TRANSCRIPT_TTL_MS, {
    category: 'chat_transcripts',
    maxConversations: MAX_PERSISTED_CONVERSATIONS,
    maxMessagesPerConversation: MAX_MESSAGES_PER_CONVERSATION,
  }, now));
}

export function readChatTranscriptCache<T extends CachedConversation>(
  raw: string | null,
  now: number = Date.now()
): ChatTranscriptReadResult<T> {
  const envelope = readCacheEnvelope<T[]>(raw, now);

  if (envelope.status === 'hit' && envelope.value) {
    return {
      conversations: minimizeSavedConversationsForCache(envelope.value),
      expired: false,
      invalid: false,
      fromLegacy: false,
    };
  }

  if (envelope.status === 'expired') {
    return { conversations: [], expired: true, invalid: false, fromLegacy: false };
  }

  if (envelope.status === 'empty' || envelope.status === 'invalid') {
    return { conversations: [], expired: false, invalid: envelope.status === 'invalid', fromLegacy: false };
  }

  try {
    const legacy = JSON.parse(raw ?? '');
    if (!Array.isArray(legacy)) {
      return { conversations: [], expired: false, invalid: true, fromLegacy: false };
    }

    return {
      conversations: minimizeSavedConversationsForCache(legacy as T[]),
      expired: false,
      invalid: false,
      fromLegacy: true,
    };
  } catch {
    return { conversations: [], expired: false, invalid: true, fromLegacy: false };
  }
}
