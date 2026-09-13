import UserService from '../services/userService.js';
import { setConversation, getConversation, clearConversation } from './state.js';
import { sendMainMenu } from './mainMenu.js';

const DISCO_LIST = [
  'Ikeja Electric',
  'Eko Electric',
  'Abuja Electric',
  'Enugu Electric',
  'Kano Electric',
  'Port Harcourt Electric'
];

const discoKeyboard = () => ({
  inline_keyboard: DISCO_LIST.map(d => [{ text: d, callback_data: `disco_${d}` }])
    .concat([[{ text: '⬅️ Cancel', callback_data: 'cancel_add_account' }]])
});

const typeKeyboard = () => ({
  inline_keyboard: [
    [{ text: '🔌 Prepaid', callback_data: 'type_prepaid' },
     { text: '🏢 Postpaid', callback_data: 'type_postpaid' }],
    [{ text: '⬅️ Cancel', callback_data: 'cancel_add_account' }]
  ]
});

const askMeterNumber = async (bot, chatId) => {
  await setConversation(chatId, { type: 'add_account', step: 'meter' });
  await bot.sendMessage(chatId,
`📝 *Add Your Meter*

Step 1 of 3 — Type your *meter number* below.

_It\'s the 6-11 digit number on your electric meter. Example: \`81004567901\`_

Send /cancel to stop.
`, { parse_mode: 'Markdown' });
};

const addAccount = async (bot, msg) => {
  const chatId = msg.chat.id;
  await askMeterNumber(bot, chatId);
};

const handleInput = async (bot, msg) => {
  const chatId = msg.chat.id;
  const conv = await getConversation(chatId);
  if (!conv || conv.type !== 'add_account') return;

  if (conv.step === 'meter') {
    const meterNumber = (msg.text || '').trim();

    if (!/^[0-9]{6,11}$/.test(meterNumber)) {
      return bot.sendMessage(chatId, '❌ That doesn\'t look like a valid meter number. Please type 6-11 digits only.');
    }

    const existing = await UserService.getAccountByMeter(meterNumber);
    if (existing) {
      return bot.sendMessage(chatId, '❌ This meter number is already registered. Please try a different one.');
    }

    await setConversation(chatId, { ...conv, meterNumber, step: 'type' });

    await bot.sendMessage(chatId, 
`✅ Meter number: \`${meterNumber}\`

Step 2 of 3 — Is it *prepaid* or *postpaid*?`,
      { parse_mode: 'Markdown', reply_markup: typeKeyboard() });
  }
};

const handleCallback = async (bot, query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const conv = await getConversation(chatId);

  if (data === 'cancel_add_account') {
    await clearConversation(chatId);
    await bot.answerCallbackQuery(query.id, { text: 'Cancelled' });
    const cancelUser = await UserService.getUserByTelegramId(query.from.id);
    return sendMainMenu(bot, chatId, '❌ Cancelled. Back to the main menu.', cancelUser?.id);
  }

  if (!conv || conv.type !== 'add_account') return;

  if (conv.step === 'type' && (data === 'type_prepaid' || data === 'type_postpaid')) {
    const accountType = data.replace('type_', '');
    await setConversation(chatId, { ...conv, accountType, step: 'disco' });
    await bot.editMessageText(
`✅ Meter: \`${conv.meterNumber}\`
✅ Type: ${accountType.toUpperCase()}

Step 3 of 3 — Select your electricity company:`,
      { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown', reply_markup: discoKeyboard() }
    );
    return await bot.answerCallbackQuery(query.id);
  }

  if (conv.step === 'disco' && data.startsWith('disco_')) {
    const distributionCompany = data.replace('disco_', '');
    conv.distributionCompany = distributionCompany;

    const user = await UserService.getUserByTelegramId(query.from.id);
    if (!user) {
      await clearConversation(chatId);
      return bot.sendMessage(chatId, 'Please send /start first.');
    }

    await UserService.addAccount(user.id, {
      meterNumber: conv.meterNumber,
      accountName: 'My Meter',
      accountType: conv.accountType,
      distributionCompany
    });

    await clearConversation(chatId);
    await bot.answerCallbackQuery(query.id, { text: 'Account added!' });
    await bot.sendMessage(chatId,
`🎉 *Meter Added Successfully!*

• Meter Number: \`${conv.meterNumber}\`
• Type: ${conv.accountType.toUpperCase()}
• Company: ${distributionCompany}

You can now view and pay bills for this meter.`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🏠 Back to Menu', callback_data: 'main_menu' }]] }
      });
  }
};

export { addAccount, handleInput, handleCallback };