const conversations = new Map();

export const setConversation = (chatId, data) => {
  conversations.set(chatId, data);
};

export const getConversation = (chatId) => conversations.get(chatId);

export const clearConversation = (chatId) => {
  conversations.delete(chatId);
};

export const hasConversation = (chatId) => conversations.has(chatId);