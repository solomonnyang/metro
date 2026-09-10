export const formatCurrency = (amount, currency = 'NGN') => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatDateTime = (date) => {
  return new Date(date).toLocaleString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const escapeMarkdown = (text) => {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
};

export const createInlineKeyboard = (buttons, columns = 2) => {
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += columns) {
    const row = buttons.slice(i, i + columns).map(btn => ({
      text: btn.text,
      callback_data: btn.data
    }));
    keyboard.push(row);
  }
  return keyboard;
};

export const buttonRow = (buttons) => {
  return buttons.map(btn => ({
    text: btn.text,
    callback_data: btn.data
  }));
};

export const getStatusEmoji = (status) => {
  const emojis = {
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
