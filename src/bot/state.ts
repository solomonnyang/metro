import { Conversation } from '../models/index.js';

// Conversations expire so abandoned flows don't linger forever.
const TTL_MS = 15 * 60 * 1000; // 15 minutes

const key = (chatId: number | string): string => String(chatId);

/** Conversation payloads are stored as JSONB, so extra keys come back as `unknown`. */
export type ConversationData = Record<string, unknown> & {
  type?: string | null;
  step?: string | null;
  userId?: string;
  meterNumber?: string;
  accountType?: AccountType;
  distributionCompany?: string;
  /** Cleared when the user opts to check a different meter. */
  customerName?: string;
};

export const ACCOUNT_TYPES = ['prepaid', 'postpaid'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const isAccountType = (value: unknown): value is AccountType =>
  typeof value === 'string' && (ACCOUNT_TYPES as readonly string[]).includes(value);

export const setConversation = async (
  chatId: number | string,
  data: ConversationData
): Promise<ConversationData> => {
  const expiresAt = new Date(Date.now() + TTL_MS);
  await Conversation.upsert({
    chatId: key(chatId),
    type: data?.type || null,
    step: data?.step || null,
    data: data || {},
    expiresAt
  });
  return data;
};

export const getConversation = async (
  chatId: number | string
): Promise<ConversationData | null> => {
  const conv = await Conversation.findByPk(key(chatId));
  if (!conv) return null;

  if (conv.expiresAt && new Date(conv.expiresAt).getTime() < Date.now()) {
    await conv.destroy().catch(() => {});
    return null;
  }

  return conv.data || null;
};

export const clearConversation = async (chatId: number | string): Promise<void> => {
  await Conversation.destroy({ where: { chatId: key(chatId) } }).catch(() => {});
};

export const hasConversation = async (chatId: number | string): Promise<boolean> => {
  const conv = await getConversation(chatId);
  return !!conv;
};
