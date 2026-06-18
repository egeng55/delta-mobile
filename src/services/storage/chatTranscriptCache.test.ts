import {
  CHAT_TRANSCRIPT_TTL_MS,
  MAX_MESSAGES_PER_CONVERSATION,
  MAX_PERSISTED_CONVERSATIONS,
  CachedConversation,
  createChatTranscriptCache,
  minimizeSavedConversationsForCache,
  readChatTranscriptCache,
} from './chatTranscriptCache';

function makeConversation(index: number, messageCount = 3): CachedConversation {
  return {
    id: `conversation-${index}`,
    title: `Conversation ${index}`,
    createdAt: index * 100,
    updatedAt: index * 100,
    messages: Array.from({ length: messageCount }, (_, messageIndex) => ({
      id: `message-${index}-${messageIndex}`,
      text: `message ${index}-${messageIndex}`,
      isUser: messageIndex % 2 === 0,
      timestamp: index * 100 + messageIndex,
    })),
  };
}

describe('chatTranscriptCache', () => {
  it('keeps the newest conversations and trims each transcript to the most recent messages', () => {
    const conversations = Array.from(
      { length: MAX_PERSISTED_CONVERSATIONS + 2 },
      (_, index) => makeConversation(index + 1, MAX_MESSAGES_PER_CONVERSATION + 2)
    );

    const minimized = minimizeSavedConversationsForCache(conversations);

    expect(minimized).toHaveLength(MAX_PERSISTED_CONVERSATIONS);
    expect(minimized[0].id).toBe(`conversation-${MAX_PERSISTED_CONVERSATIONS + 2}`);
    expect(minimized[minimized.length - 1].id).toBe('conversation-3');
    expect(minimized[0].messages).toHaveLength(MAX_MESSAGES_PER_CONVERSATION);
    expect(minimized[0].messages[0].id).toBe(
      `message-${MAX_PERSISTED_CONVERSATIONS + 2}-2`
    );
  });

  it('wraps transcripts in a TTL envelope and reads non-expired values', () => {
    const raw = createChatTranscriptCache([makeConversation(1)], 1000);
    const result = readChatTranscriptCache<CachedConversation>(raw, 1000 + CHAT_TRANSCRIPT_TTL_MS - 1);

    expect(result).toMatchObject({
      expired: false,
      invalid: false,
      fromLegacy: false,
    });
    expect(result.conversations).toHaveLength(1);
    expect(result.conversations[0].id).toBe('conversation-1');
  });

  it('marks expired transcript caches without returning transcript contents', () => {
    const raw = createChatTranscriptCache([makeConversation(1)], 1000);
    const result = readChatTranscriptCache<CachedConversation>(raw, 1000 + CHAT_TRANSCRIPT_TTL_MS);

    expect(result).toEqual({
      conversations: [],
      expired: true,
      invalid: false,
      fromLegacy: false,
    });
  });

  it('reads legacy raw transcript arrays so callers can rewrite them into TTL cache format', () => {
    const raw = JSON.stringify([makeConversation(1)]);
    const result = readChatTranscriptCache<CachedConversation>(raw);

    expect(result).toMatchObject({
      expired: false,
      invalid: false,
      fromLegacy: true,
    });
    expect(result.conversations[0].id).toBe('conversation-1');
  });

  it('handles malformed transcript cache values without throwing or logging payloads', () => {
    expect(readChatTranscriptCache('{bad json')).toEqual({
      conversations: [],
      expired: false,
      invalid: true,
      fromLegacy: false,
    });
  });
});
