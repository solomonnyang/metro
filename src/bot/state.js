import { Conversation } from '../models/index.js';

// Conversations expire so abandoned flows don't linger forever.
const TTL_MS = 15 * 60 * 1000; // 15 minutes

const key = (chatId) => String(chatId);

export const setConversation = async (chatId, data) => {
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

export const getConversation = async (chatId) => {
  const conv = await Conversation.findByPk(key(chatId));
  if (!conv) return null;

  if (conv.expiresAt && new Date(conv.expiresAt).getTime() < Date.now()) {
    await conv.destroy().catch(() => {});
    return null;
  }

  return conv.data || null;
};

export const clearConversation = async (chatId) => {
  await Conversation.destroy({ where: { chatId: key(chatId) } }).catch(() => {});
};

export const hasConversation = async (chatId) => {
  const conv = await getConversation(chatId);
  return !!conv;
};