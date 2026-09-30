export type InlineButton = {
  text: string;
  data: string;
};

export type TelegramKeyboardButton = {
  text: string;
  callback_data: string;
};

export const formatCurrency = (amount: number | string, currency = 'NGN'): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(Number(amount));
};

export const formatDate = (date: Date | string | number): string => {
  return new Date(date).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatDateTime = (date: Date | string | number): string => {
  return new Date(date).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const escapeMarkdown = (text: string): string => {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
};

export const createInlineKeyboard = (
  buttons: InlineButton[],
  columns = 2
): TelegramKeyboardButton[][] => {
  const keyboard: TelegramKeyboardButton[][] = [];
  for (let i = 0; i < buttons.length; i += columns) {
    const row = buttons.slice(i, i + columns).map((btn) => ({
      text: btn.text,
      callback_data: btn.data
    }));
    keyboard.push(row);
  }
  return keyboard;
};

export const buttonRow = (buttons: InlineButton[]): TelegramKeyboardButton[] => {
  return buttons.map((btn) => ({
    text: btn.text,
    callback_data: btn.data
  }));
};

export const getStatusEmoji = (status: string): string => {
  const emojis: Record<string, string> = {
    pending: '⏳',
    paid: '✅',
    success: '✅',
    processing: '🔄',
    failed: '❌',
    overdue: '⚠️',
    cancelled: '🚫',
    refunded: '↩️'
  };
  return emojis[status] || '❓';
};
