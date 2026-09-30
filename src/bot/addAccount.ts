import UserService from '../services/userService.js';
import VendService from '../services/vendService.js';
import FucilService from '../services/fucil.js';
import { toDiscoCode, discoName } from '../utils/discos.js';
import { setConversation, getConversation, clearConversation, isAccountType } from './state.js';
import { sendMainMenu } from './mainMenu.js';
import { formatCurrency, escapeMarkdown } from '../utils/helpers.js';
import type { Bot, ChatId, InlineKeyboardMarkup, TelegramCallbackQuery, TelegramMessage } from './types.js';

/**
 * Fallback list if Fucil's disco list is unavailable at signup time. Codes match
 * `src/utils/discos.ts`; the customer's choice is stored as the human name.
 */
const DISCO_FALLBACK = [
  'Abuja Electric',
  'Eko Electric',
  'Kano Electric',
  'Jos Electric',
  'Aple Electric'
];

let discoCache: string[] | null = null;

/** Disco options come from Fucil so the menu only offers vendable providers. */
const getDiscoList = async (): Promise<string[]> => {
  if (discoCache) return discoCache;

  try {
    const discos = await FucilService.listDiscos();
    const prepaid = discos.filter((d) => !d.meterType || d.meterType.toLowerCase() === 'prepaid');
    const names = [...new Set(prepaid.map((d) => d.name || d.code).filter(Boolean))] as string[];
    if (names.length > 0) {
      discoCache = names;
      return names;
    }
    console.warn('⚠️ Fucil returned no discos; using the built-in list.');
  } catch (error) {
    console.warn('⚠️ Could not load discos from Fucil, using the built-in list:', error instanceof Error ? error.message : error);
  }

  return DISCO_FALLBACK;
};

const discoKeyboard = async (): Promise<InlineKeyboardMarkup> => {
  const list = await getDiscoList();
  return {
    inline_keyboard: list.map((d) => [{ text: d, callback_data: `disco_${d}` }])
      .concat([[{ text: '⬅️ Cancel', callback_data: 'cancel_add_account' }]])
  };
};

const typeKeyboard = (): InlineKeyboardMarkup => ({
  inline_keyboard: [
    [{ text: '🔌 Prepaid', callback_data: 'type_prepaid' },
     { text: '🏢 Postpaid', callback_data: 'type_postpaid' }],
    [{ text: '⬅️ Cancel', callback_data: 'cancel_add_account' }]
  ]
});

const addAccount = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;

  await setConversation(chatId, { type: 'add_account', step: 'disco' });
  await bot.sendMessage(chatId,
`📝 *Add Your Meter*

Step 1 of 3 — Select your *electricity company*.

We need this before your meter number so we can verify the meter with the provider.`,
    { parse_mode: 'Markdown', reply_markup: await discoKeyboard() });
};

/** Fucil validates a meter against a specific disco, so both are required here. */
const verifyMeter = async (
  meter: string,
  distributionCompany: string,
  accountType: string
): Promise<{ ok: true; customerName: string | null; address: string | null; outstanding: number | null } | { ok: false; error: string }> => {
  const discoCode = toDiscoCode(distributionCompany);
  if (!discoCode) {
    return { ok: false, error: 'This electricity company is not supported yet.' };
  }

  try {
    const result = await FucilService.validateMeter({
      disco: discoCode,
      meterType: accountType === 'postpaid' ? 'Postpaid' : 'Prepaid',
      meter
    });
    return {
      ok: true,
      customerName: result.customerName,
      address: result.customerAddress,
      outstanding: result.outstanding
    };
  } catch (error) {
    // Fucil's own message is the useful part ("meter not found", etc).
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
};

const handleInput = async (bot: Bot, msg: TelegramMessage): Promise<void> => {
  const chatId = msg.chat.id;
  const conv = await getConversation(chatId);
  if (!conv || conv.type !== 'add_account') return;

  if (conv.step !== 'meter') return;

  const meterNumber = (msg.text || '').trim();

  if (!/^[0-9]{6,11}$/.test(meterNumber)) {
    await bot.sendMessage(chatId, '❌ That doesn\'t look like a valid meter number. Please type 6-11 digits only.');
    return;
  }

  const existing = await UserService.getAccountByMeter(meterNumber);
  if (existing) {
    await bot.sendMessage(chatId, '❌ This meter number is already registered. Please try a different one.');
    return;
  }

  const distributionCompany = conv.distributionCompany;
  const accountType = conv.accountType;
  if (!distributionCompany || !isAccountType(accountType)) {
    await clearConversation(chatId);
    await bot.sendMessage(chatId, 'That meter session expired. Please send /addaccount to start again.');
    return;
  }

  const status = await bot.sendMessage(chatId, '🔍 Checking your meter with the provider…');

  const result = await verifyMeter(meterNumber, distributionCompany, accountType);

  if (!result.ok) {
    // Stay on the same step so the user can simply retype the number.
    await bot.sendMessage(chatId,
      `❌ *Invalid meter number*\n\nWe could not find \`${meterNumber}\` on ${escapeMarkdown(discoName(distributionCompany))}.\n\n${escapeMarkdown(result.error)}\n\nCheck the number on your meter and send it again.`,
      { parse_mode: 'Markdown' });
    return;
  }

  const lines = [
    `✅ *Meter verified*`,
    ``,
    `• Meter Number: \`${meterNumber}\``
  ];
  if (result.customerName) lines.push(`• Account Name: ${escapeMarkdown(result.customerName)}`);
  lines.push(`• Type: ${accountType.toUpperCase()}`);
  lines.push(`• Company: ${escapeMarkdown(discoName(distributionCompany))}`);
  if (result.address) lines.push(`• Address: ${escapeMarkdown(result.address)}`);
  if (accountType === 'postpaid' && result.outstanding !== null) {
    lines.push(`• Outstanding Bill: ${formatCurrency(result.outstanding)}`);
  }

  await setConversation(chatId, { ...conv, meterNumber, step: 'confirm' });

  await bot.sendMessage(chatId,
`${lines.join('\n')}

Tap *Save Meter* to add it, or send another meter number to check a different one.`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Save Meter', callback_data: 'save_meter' }],
          [{ text: '🔁 Check Another', callback_data: 'reenter_meter' }],
          [{ text: '⬅️ Cancel', callback_data: 'cancel_add_account' }]
        ]
      }
    });

  if (status?.message_id) {
    await bot.deleteMessage(chatId, status.message_id).catch(() => {});
  }
};

const handleCallback = async (bot: Bot, query: TelegramCallbackQuery): Promise<void> => {
  const chatId = query.message?.chat.id ?? query.from.id;
  const messageId = query.message?.message_id;
  const data = query.data;
  const conv = await getConversation(chatId);

  if (data === 'cancel_add_account') {
    await clearConversation(chatId);
    await bot.answerCallbackQuery(query.id, { text: 'Cancelled' });
    const cancelUser = await UserService.getUserByTelegramId(query.from.id);
    await sendMainMenu(bot, chatId, '❌ Cancelled. Back to the main menu.', cancelUser?.id);
    return;
  }

  if (!conv || conv.type !== 'add_account') return;

  const selectedType = data?.replace('type_', '');

  // Step 1: company chosen, now ask prepaid/postpaid.
  if (conv.step === 'disco' && data?.startsWith('disco_')) {
    const distributionCompany = data.replace('disco_', '');
    await setConversation(chatId, { ...conv, distributionCompany, step: 'type' });
    await bot.answerCallbackQuery(query.id);

    if (messageId !== undefined) {
      await bot.editMessageText(
        `✅ Company: ${escapeMarkdown(discoName(distributionCompany))}\n\nStep 2 of 3 — Is your meter *prepaid* or *postpaid*?`,
        { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: typeKeyboard() }
      );
      return;
    }

    await bot.sendMessage(chatId, 'Step 2 of 3 — Is your meter *prepaid* or *postpaid*?', {
      parse_mode: 'Markdown',
      reply_markup: typeKeyboard()
    });
    return;
  }

  // Step 2: meter type chosen, now ask for the meter number.
  if (conv.step === 'type' && isAccountType(selectedType)) {
    await setConversation(chatId, { ...conv, accountType: selectedType, step: 'meter' });
    await bot.answerCallbackQuery(query.id);

    if (messageId !== undefined) {
      await bot.editMessageText(
        `✅ Company: ${escapeMarkdown(discoName(conv.distributionCompany ?? ''))}\n✅ Type: ${selectedType.toUpperCase()}\n\nStep 3 of 3 — Type your *meter number* below.\n\n_It's the 6-11 digit number on your electric meter. Example: \`81004567901\`_\n\nWe'll verify it with the provider before saving.`,
        { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' }
      );
      return;
    }

    await bot.sendMessage(chatId,
      'Step 3 of 3 — Type your *meter number* below.\n\n_It\'s the 6-11 digit number on your electric meter._',
      { parse_mode: 'Markdown' });
    return;
  }

  if (data === 'reenter_meter') {
    await setConversation(chatId, { ...conv, meterNumber: undefined, step: 'meter' });
    await bot.answerCallbackQuery(query.id, { text: 'Enter another meter number' });
    await bot.sendMessage(chatId, 'Send the *meter number* you want to check.', { parse_mode: 'Markdown' });
    return;
  }

  if (data === 'save_meter') {
    await bot.answerCallbackQuery(query.id, { text: 'Saving…' });

    const user = await UserService.getUserByTelegramId(query.from.id);
    if (!user) {
      await clearConversation(chatId);
      await bot.sendMessage(chatId, 'Please send /start first.');
      return;
    }

    const meterNumber = conv.meterNumber;
    const accountType = conv.accountType;
    const distributionCompany = conv.distributionCompany;

    if (!meterNumber || !isAccountType(accountType) || !distributionCompany) {
      await clearConversation(chatId);
      await bot.sendMessage(chatId, 'That meter session expired. Please send /addaccount to start again.');
      return;
    }

    // Another user may have registered it while this session was open.
    const existing = await UserService.getAccountByMeter(meterNumber);
    if (existing) {
      await clearConversation(chatId);
      await bot.sendMessage(chatId, '❌ This meter number is already registered. Please send /addaccount to start again.');
      return;
    }

    await UserService.addAccount(user.id, {
      meterNumber,
      accountName: 'My Meter',
      accountType,
      distributionCompany
    });

    await clearConversation(chatId);
    await bot.sendMessage(chatId,
`🎉 *Meter Added Successfully!*

• Meter Number: \`${meterNumber}\`
• Type: ${accountType.toUpperCase()}
• Company: ${escapeMarkdown(discoName(distributionCompany))}

You can now buy electricity for this meter.`,
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🏠 Back to Menu', callback_data: 'main_menu' }]] }
      });
  }
};

export { addAccount, handleInput, handleCallback };
