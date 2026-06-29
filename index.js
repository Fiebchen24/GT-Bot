require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle
} = require('discord.js');

const config = require('./config.json');

console.log('GT ROLE BOT V8.0 LOADED');

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Missing TOKEN, CLIENT_ID or GUILD_ID in environment variables.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const commands = [
  new SlashCommandBuilder()
    .setName('giverolefromchannel')
    .setDescription('Give a role to everyone mentioned in a channel.')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to scan').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role to give').setRequired(true))
    .addIntegerOption(o => o.setName('limit').setDescription('Messages to scan, max 1000').setMinValue(1).setMaxValue(1000))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('takerolefromchannel')
    .setDescription('Remove a role from everyone mentioned in a channel.')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to scan').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
    .addIntegerOption(o => o.setName('limit').setDescription('Messages to scan, max 1000').setMinValue(1).setMaxValue(1000))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('earningsroles')
    .setDescription('Update earnings roles from mentions and earnings numbers in a channel.')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to scan').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addIntegerOption(o => o.setName('limit').setDescription('Messages to scan, max 1000').setMinValue(1).setMaxValue(1000))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('checksignup')
    .setDescription('Pre-cup check: sign-in teams vs Twitch links / DC proof.')
    .addChannelOption(o => o.setName('sign_in_channel').setDescription('Channel with @name sign-ins').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addChannelOption(o => o.setName('twitch_channel').setDescription('Channel with Twitch links or DC proof').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addIntegerOption(o => o.setName('limit').setDescription('Messages to scan per channel, max 1000').setMinValue(1).setMaxValue(1000)),

  new SlashCommandBuilder()
    .setName('postcupcheck')
    .setDescription('Post-cup check: Twitch links live/VOD proof or DC manual proof.')
    .addChannelOption(o => o.setName('twitch_channel').setDescription('Channel with Twitch links or DC proof').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addIntegerOption(o => o.setName('hours').setDescription('Look back this many hours for VODs').setMinValue(1).setMaxValue(168))
    .addIntegerOption(o => o.setName('limit').setDescription('Messages to scan, max 1000').setMinValue(1).setMaxValue(1000)),

  new SlashCommandBuilder()
    .setName('voicechannelcreate')
    .setDescription('Create one or many voice channels in a category.')
    .addChannelOption(o => o.setName('category').setDescription('Category to create voice channels in').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('Base channel name').setRequired(true))
    .addIntegerOption(o => o.setName('user_limit').setDescription('User limit 0-99, 0 = unlimited').setMinValue(0).setMaxValue(99).setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('How many channels to create, max 50').setMinValue(1).setMaxValue(50).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('voicechanneldelete')
    .setDescription('Delete a selected voice channel.')
    .addChannelOption(o => o.setName('channel').setDescription('Voice channel to delete').addChannelTypes(ChannelType.GuildVoice).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('voicechanneldeleteall')
    .setDescription('Delete all voice channels in a selected category.')
    .addChannelOption(o => o.setName('category').setDescription('Category to delete voice channels from').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addStringOption(o => o.setName('name_prefix').setDescription('Optional: only delete voice channels starting with this name'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('eventbanadd')
    .setDescription('Give an event-ban role to one user until a date or for X days.')
    .addUserOption(o => o.setName('user').setDescription('User to event-ban').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Event-ban role to give').setRequired(true))
    .addChannelOption(o => o.setName('log_channel').setDescription('Optional channel for automatic expiry logs').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption(o => o.setName('until_date').setDescription('Optional date: YYYY-MM-DD or DD.MM.YYYY'))
    .addIntegerOption(o => o.setName('days').setDescription('Optional duration in days. Default: 30').setMinValue(1).setMaxValue(365))
    .addStringOption(o => o.setName('reason').setDescription('Optional reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('eventbanfromchannel')
    .setDescription('Give an event-ban role to everyone mentioned in a channel.')
    .addChannelOption(o => o.setName('channel').setDescription('Channel with @mentions').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Event-ban role to give').setRequired(true))
    .addChannelOption(o => o.setName('log_channel').setDescription('Optional channel for automatic expiry logs').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption(o => o.setName('until_date').setDescription('Optional date: YYYY-MM-DD or DD.MM.YYYY'))
    .addIntegerOption(o => o.setName('days').setDescription('Optional duration in days. Default: 30').setMinValue(1).setMaxValue(365))
    .addIntegerOption(o => o.setName('limit').setDescription('Messages to scan, max 1000').setMinValue(1).setMaxValue(1000))
    .addStringOption(o => o.setName('reason').setDescription('Optional reason'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('eventbanremove')
    .setDescription('Remove an event-ban role from one user and clear the saved expiry.')
    .addUserOption(o => o.setName('user').setDescription('User to unban').setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Event-ban role to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('eventbanlist')
    .setDescription('List active saved event bans.')
    .addRoleOption(o => o.setName('role').setDescription('Optional: only list this event-ban role'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
,


  new SlashCommandBuilder()
    .setName('twitchwatchadd')
    .setDescription('Add a Twitch channel for live notifications.')
    .addStringOption(o => o.setName('username').setDescription('Twitch username, e.g. fiebchen').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Discord channel for live notifications').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('twitchwatchremove')
    .setDescription('Remove a Twitch channel from live notifications.')
    .addStringOption(o => o.setName('username').setDescription('Twitch username to remove').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('twitchwatchlist')
    .setDescription('List Twitch live notification watches.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('fortniteevents')
    .setDescription('Show upcoming Fortnite events from the ICS calendar.')
    .addIntegerOption(o => o.setName('days').setDescription('How many days ahead to show, default 7').setMinValue(1).setMaxValue(60))
    .addIntegerOption(o => o.setName('limit').setDescription('Max events to show, default 10').setMinValue(1).setMaxValue(25)),

  new SlashCommandBuilder()
    .setName('fortniteeventstoday')
    .setDescription("Show today's Fortnite events from the ICS calendar.")
    .addIntegerOption(o => o.setName('limit').setDescription('Max events to show, default 15').setMinValue(1).setMaxValue(25)),

  new SlashCommandBuilder()
    .setName('fortniteeventspost')
    .setDescription('Post Fortnite calendar events into a selected channel.')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post into').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addIntegerOption(o => o.setName('days').setDescription('How many days ahead to show, default 7').setMinValue(1).setMaxValue(60))
    .addIntegerOption(o => o.setName('limit').setDescription('Max events to show, default 10').setMinValue(1).setMaxValue(25))
    .addStringOption(o => o.setName('region').setDescription('Region filter, e.g. EU, NAC, ALL'))
    .addStringOption(o => o.setName('keyword').setDescription('Optional keyword filter, e.g. FNCS, Ranked, ZB'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('fortniteeventsgrouped')
    .setDescription('Post grouped Fortnite events for today or next days into a selected channel.')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to post into').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addIntegerOption(o => o.setName('days').setDescription('Days to include, 1=today, default 1').setMinValue(1).setMaxValue(14))
    .addStringOption(o => o.setName('region').setDescription('Region filter, e.g. EU, NAC, ALL'))
    .addStringOption(o => o.setName('keyword').setDescription('Optional keyword filter, e.g. FNCS, Ranked, ZB'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
,
  new SlashCommandBuilder()
    .setName('birthdayset')
    .setDescription('Set your own birthday reminder.')
    .addIntegerOption(o => o.setName('day').setDescription('Day of month, e.g. 24').setMinValue(1).setMaxValue(31).setRequired(true))
    .addIntegerOption(o => o.setName('month').setDescription('Month, e.g. 6 for June').setMinValue(1).setMaxValue(12).setRequired(true))
    .addIntegerOption(o => o.setName('year').setDescription('Optional birth year, only if you want GT to know your age').setMinValue(1900).setMaxValue(new Date().getFullYear()))
    .addStringOption(o => o.setName('timezone').setDescription('Timezone, default Europe/Berlin, e.g. Europe/London, America/New_York'))
    .addStringOption(o => o.setName('reminder_time').setDescription('Reminder time in your timezone, HH:MM, default 09:00')),

  new SlashCommandBuilder()
    .setName('birthdayremove')
    .setDescription('Remove your own birthday reminder.'),

  new SlashCommandBuilder()
    .setName('birthdaynext')
    .setDescription('Show upcoming GT birthdays.')
    .addIntegerOption(o => o.setName('limit').setDescription('How many birthdays to show, default 10').setMinValue(1).setMaxValue(25)),

  new SlashCommandBuilder()
    .setName('birthdaylist')
    .setDescription('Staff: list all saved birthdays.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playercreate')
    .setDescription('Create or update a GT player card.')
    .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(true))
    .addStringOption(o => o.setName('ign').setDescription('Player name / IGN').setRequired(true))
    .addStringOption(o => o.setName('roster').setDescription('GT roster').setRequired(true)
      .addChoices(
        { name: 'GT Member', value: 'GT Member' },
        { name: 'GT Academy', value: 'GT Academy' },
        { name: 'GT Pro', value: 'GT Pro' },
        { name: 'GT Queens Comp', value: 'GT Queens Comp' },
        { name: 'Creator', value: 'Creator' }
      ))
    .addStringOption(o => o.setName('country').setDescription('Country, e.g. Germany').setRequired(false))
    .addStringOption(o => o.setName('mode').setDescription('Mode, e.g. Zero Build').setRequired(false))
    .addStringOption(o => o.setName('role').setDescription('Role, e.g. IGL / Fragger / Support').setRequired(false))
    .addStringOption(o => o.setName('earnings').setDescription('Earnings, e.g. $500').setRequired(false))
    .addStringOption(o => o.setName('placement').setDescription('Best placement / achievement').setRequired(false))
    .addStringOption(o => o.setName('twitch').setDescription('Twitch URL').setRequired(false))
    .addStringOption(o => o.setName('tiktok').setDescription('TikTok URL').setRequired(false))
    .addStringOption(o => o.setName('x').setDescription('X / Twitter URL').setRequired(false))
    .addStringOption(o => o.setName('youtube').setDescription('YouTube URL').setRequired(false))
    .addStringOption(o => o.setName('quote').setDescription('Short player quote').setRequired(false))
    .addStringOption(o => o.setName('image').setDescription('Image URL for the card').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playeredit')
    .setDescription('Edit an existing GT player card. Only filled fields are changed.')
    .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(true))
    .addStringOption(o => o.setName('ign').setDescription('Player name / IGN').setRequired(false))
    .addStringOption(o => o.setName('roster').setDescription('GT roster').setRequired(false)
      .addChoices(
        { name: 'GT Member', value: 'GT Member' },
        { name: 'GT Academy', value: 'GT Academy' },
        { name: 'GT Pro', value: 'GT Pro' },
        { name: 'GT Queens Comp', value: 'GT Queens Comp' },
        { name: 'Creator', value: 'Creator' }
      ))
    .addStringOption(o => o.setName('country').setDescription('Country').setRequired(false))
    .addStringOption(o => o.setName('mode').setDescription('Mode').setRequired(false))
    .addStringOption(o => o.setName('role').setDescription('Role').setRequired(false))
    .addStringOption(o => o.setName('earnings').setDescription('Earnings').setRequired(false))
    .addStringOption(o => o.setName('placement').setDescription('Best placement / achievement').setRequired(false))
    .addStringOption(o => o.setName('twitch').setDescription('Twitch URL').setRequired(false))
    .addStringOption(o => o.setName('tiktok').setDescription('TikTok URL').setRequired(false))
    .addStringOption(o => o.setName('x').setDescription('X / Twitter URL').setRequired(false))
    .addStringOption(o => o.setName('youtube').setDescription('YouTube URL').setRequired(false))
    .addStringOption(o => o.setName('quote').setDescription('Short player quote').setRequired(false))
    .addStringOption(o => o.setName('image').setDescription('Image URL').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playerdelete')
    .setDescription('Delete a GT player card.')
    .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playerpost')
    .setDescription('Post or update GT player card(s) in the player directory channel.')
    .addUserOption(o => o.setName('user').setDescription('Optional: only post/update this player').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playerlist')
    .setDescription('List saved GT player cards.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)

].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Slash commands registered.');
}

function isUsableTextChannel(channel) {
  return channel && typeof channel.messages?.fetch === 'function' && channel.isTextBased?.();
}

async function safeDefer(interaction) {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    return true;
  } catch (error) {
    console.error('Failed to defer interaction:', error);
    return false;
  }
}

async function safeEdit(interaction, content) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.editReply({ content });
    return await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to respond:', error);
  }
}

async function safeEditPayload(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
    return await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  } catch (error) {
    console.error('Failed to respond with payload:', error);
  }
}

async function sendShort(channel, content) {
  try {
    if (isUsableTextChannel(channel)) await channel.send(content);
  } catch (error) {
    console.warn(`Could not send short message to ${channel?.name || 'channel'}:`, error.message);
  }
}

async function fetchMessages(channel, limit = 1000) {
  if (!isUsableTextChannel(channel)) throw new Error(`Please select a valid text channel for ${channel?.name || 'selected channel'}.`);
  const max = Math.min(Math.max(limit || 1000, 1), 1000);
  let remaining = max;
  let before;
  const all = [];

  while (remaining > 0) {
    const batchSize = Math.min(remaining, 100);
    const options = { limit: batchSize };
    if (before) options.before = before;
    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;
    all.push(...batch.values());
    before = batch.last().id;
    remaining -= batch.size;
    if (batch.size < batchSize) break;
  }

  return all;
}

function splitText(text, max = 1800) {
  const lines = String(text).split('\n');
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + '\n' + line).length > max) {
      if (current.trim()) chunks.push(current);
      current = line;
    } else {
      current += current ? `\n${line}` : line;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

async function sendLongReply(interaction, text) {
  const chunks = splitText(text);
  if (!chunks.length) return safeEdit(interaction, 'Done.');
  await safeEdit(interaction, chunks[0]);
  for (const chunk of chunks.slice(1)) {
    try { await interaction.followUp({ content: chunk, flags: MessageFlags.Ephemeral }); }
    catch (error) { console.error('Failed to send follow-up:', error); }
  }
}

const EVENT_BANS_FILE = path.join(__dirname, 'eventBans.json');

function loadEventBanStore() {
  try {
    if (!fs.existsSync(EVENT_BANS_FILE)) return { bans: [] };
    const parsed = JSON.parse(fs.readFileSync(EVENT_BANS_FILE, 'utf8'));
    return { bans: Array.isArray(parsed.bans) ? parsed.bans : [] };
  } catch (error) {
    console.error('Could not load eventBans.json:', error);
    return { bans: [] };
  }
}

function saveEventBanStore(store) {
  fs.writeFileSync(EVENT_BANS_FILE, JSON.stringify(store, null, 2));
}

function parseExpiry(untilDate, days) {
  if (untilDate) {
    const value = untilDate.trim();
    let year, month, day;
    let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      match = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (match) {
        day = Number(match[1]);
        month = Number(match[2]);
        year = Number(match[3]);
      }
    }
    if (!year || !month || !day) throw new Error('Invalid date. Use YYYY-MM-DD or DD.MM.YYYY.');
    const expires = new Date(year, month - 1, day, 23, 59, 59, 999);
    if (Number.isNaN(expires.getTime())) throw new Error('Invalid date. Use YYYY-MM-DD or DD.MM.YYYY.');
    if (expires.getTime() <= Date.now()) throw new Error('Expiry date must be in the future.');
    return expires;
  }

  const durationDays = days || 30;
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
}

function formatDateTime(dateInput) {
  const date = new Date(dateInput);
  return date.toLocaleString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function upsertEventBan({ guildId, userId, roleId, expiresAt, reason, addedBy, logChannelId }) {
  const store = loadEventBanStore();
  const existing = store.bans.find(b => b.guildId === guildId && b.userId === userId && b.roleId === roleId);
  const record = {
    guildId,
    userId,
    roleId,
    expiresAt: expiresAt.toISOString(),
    reason: reason || '',
    addedBy,
    logChannelId: logChannelId || config.eventBanLogChannelId || '',
    createdAt: new Date().toISOString()
  };
  if (existing) Object.assign(existing, record);
  else store.bans.push(record);
  saveEventBanStore(store);
}

function removeEventBanRecord(guildId, userId, roleId) {
  const store = loadEventBanStore();
  const before = store.bans.length;
  store.bans = store.bans.filter(b => !(b.guildId === guildId && b.userId === userId && b.roleId === roleId));
  saveEventBanStore(store);
  return before - store.bans.length;
}


async function sendEventBanLog(ban, message) {
  const logChannelId = ban.logChannelId || config.eventBanLogChannelId;
  if (!logChannelId) return;

  try {
    const guild = await client.guilds.fetch(ban.guildId);
    const channel = await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    await channel.send(message);
  } catch (error) {
    console.error(`Failed to send event ban log for ${ban.userId}:`, error.message);
  }
}

async function checkExpiredEventBans() {
  const store = loadEventBanStore();
  const now = Date.now();
  const remaining = [];
  let changed = false;

  for (const ban of store.bans) {
    if (new Date(ban.expiresAt).getTime() > now) {
      remaining.push(ban);
      continue;
    }

    changed = true;
    try {
      const guild = await client.guilds.fetch(ban.guildId);
      const member = await guild.members.fetch(ban.userId).catch(() => null);
      if (member && member.roles.cache.has(ban.roleId)) {
        await member.roles.remove(ban.roleId, 'Event ban expired');
        console.log(`Removed expired event ban role ${ban.roleId} from ${ban.userId}`);
        const reasonText = ban.reason ? ` Reason: ${ban.reason}.` : '';
        await sendEventBanLog(ban, `✅ Event ban expired and was removed from <@${ban.userId}>. Role: <@&${ban.roleId}>.${reasonText}`);
      }
    } catch (error) {
      console.error(`Failed to remove expired event ban for ${ban.userId}:`, error.message);
      remaining.push(ban);
      changed = false;
    }
  }

  if (changed) saveEventBanStore({ bans: remaining });
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function extractTwitchNames(content) {
  const text = String(content || '');
  const results = [];
  const regexes = [
    /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{3,25})(?:\b|\/|\?|$)/gi,
    /(?:https?:\/\/)?(?:www\.)?m\.twitch\.tv\/([a-zA-Z0-9_]{3,25})(?:\b|\/|\?|$)/gi
  ];
  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(text)) !== null) results.push(match[1].toLowerCase());
  }
  return [...new Set(results)];
}

function hasDcProof(content) {
  const text = String(content || '').toLowerCase();
  return /(^|\s)dc(\s|$)/i.test(text) || /dc\s*ss/i.test(text) || /discord\s*screenshare/i.test(text);
}

function namesFromTextBeforeProof(content) {
  let text = String(content || '')
    .replace(/<@!?\d+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/(?:www\.)?twitch\.tv\/\S+/gi, ' ')
    .replace(/\bdc\s*ss\b/gi, ' ')
    .replace(/\bdc\b/gi, ' ')
    .replace(/discord\s*screenshare/gi, ' ')
    .trim();
  return text.split(/[\n,|+]+/).map(s => normalize(s)).filter(s => s.length >= 3);
}

async function memberKeys(guild, user) {
  const keys = new Set();
  keys.add(normalize(user.username));
  if (user.globalName) keys.add(normalize(user.globalName));
  try {
    const member = await guild.members.fetch(user.id);
    if (member.displayName) keys.add(normalize(member.displayName));
    if (member.nickname) keys.add(normalize(member.nickname));
  } catch {}
  return [...keys].filter(k => k.length >= 3);
}

function keyMatchesProof(key, proofKeys) {
  if (!key || key.length < 3) return false;
  for (const proof of proofKeys) {
    if (!proof || proof.length < 3) continue;
    if (proof === key) return true;
    if (proof.length >= 4 && key.includes(proof)) return true;
    if (key.length >= 4 && proof.includes(key)) return true;
  }
  return false;
}

async function buildSignInTeams(guild, messages) {
  const teams = [];
  for (const message of [...messages].reverse()) {
    if (message.author?.bot) continue;
    const users = [...message.mentions.users.values()];
    if (!users.length) continue;
    const members = [];
    for (const user of users) {
      members.push({ user, keys: await memberKeys(guild, user) });
    }
    teams.push({ messageId: message.id, members });
  }
  return teams;
}

function buildProofData(messages) {
  const proofUserIds = new Set();
  const proofKeys = new Set();
  const twitchNames = new Set();
  const dcProofs = [];

  for (const message of messages) {
    if (message.author?.bot) continue;
    const content = message.content || '';
    const twitch = extractTwitchNames(content);
    const dc = hasDcProof(content);
    const hasProof = twitch.length > 0 || dc;
    if (!hasProof) continue;

    for (const user of message.mentions.users.values()) proofUserIds.add(user.id);
    for (const name of twitch) {
      twitchNames.add(name);
      proofKeys.add(normalize(name));
    }
    for (const key of namesFromTextBeforeProof(content)) proofKeys.add(key);
    if (dc) dcProofs.push(content);
  }

  return { proofUserIds, proofKeys, twitchNames: [...twitchNames], dcProofs };
}

function teamHasProof(team, proofData) {
  for (const member of team.members) {
    if (proofData.proofUserIds.has(member.user.id)) return true;
    if (member.keys.some(key => keyMatchesProof(key, proofData.proofKeys))) return true;
  }
  return false;
}

function formatTeam(team) {
  return team.members.map(m => `<@${m.user.id}>`).join(' + ');
}

async function handleCheckSignup(interaction) {
  const signInChannel = interaction.options.getChannel('sign_in_channel');
  const twitchChannel = interaction.options.getChannel('twitch_channel');
  const limit = interaction.options.getInteger('limit') || 1000;

  if (!isUsableTextChannel(signInChannel)) return safeEdit(interaction, 'Error: Please select a valid text channel for sign-in channel.');
  if (!isUsableTextChannel(twitchChannel)) return safeEdit(interaction, 'Error: Please select a valid text channel for Twitch channel.');

  const [signMessages, twitchMessages] = await Promise.all([
    fetchMessages(signInChannel, limit),
    fetchMessages(twitchChannel, limit)
  ]);

  const teams = await buildSignInTeams(interaction.guild, signMessages);
  const proofData = buildProofData(twitchMessages);
  const missing = teams.filter(team => !teamHasProof(team, proofData));
  const matched = teams.length - missing.length;
  const players = teams.reduce((sum, team) => sum + team.members.length, 0);

  const lines = [];
  lines.push('**Signup Check**');
  lines.push(`Checked ${teams.length} sign-in teams / ${players} players.`);
  lines.push(`${proofData.twitchNames.length} Twitch links are in the Twitch channel.`);
  lines.push(`${proofData.dcProofs.length} DC proof entries are in the Twitch channel.`);
  lines.push(`${matched} teams are matched.`);
  lines.push(`${missing.length} teams are missing proof.`);
  lines.push('');

  if (missing.length) {
    lines.push('**Missing Twitch/DC proof:**');
    for (const team of missing) lines.push(`X ${formatTeam(team)}`);
  } else {
    lines.push('All sign-in teams have Twitch/DC proof.');
  }

  await sendLongReply(interaction, lines.join('\n'));
  await sendShort(signInChannel, `Signup check completed: ${teams.length} teams checked, ${missing.length} missing proof.`);
  await sendShort(twitchChannel, `Twitch/DC proof check completed: ${proofData.twitchNames.length} Twitch links, ${proofData.dcProofs.length} DC proof entries, ${missing.length} missing teams.`);
}

function getEarningsFromMessage(content, userId) {
  const safe = String(content || '');
  const regex = new RegExp(`<@!?${userId}>\\s*\\$?([0-9][0-9.,]*)`, 'i');
  const match = safe.match(regex);
  if (!match) return null;
  const cleaned = match[1].replace(/[.,]/g, '');
  const value = parseInt(cleaned, 10);
  return Number.isNaN(value) ? null : value;
}

function bestEarningsRole(earnings) {
  return [...(config.earningsRoles || [])].sort((a, b) => b.min - a.min).find(r => earnings >= r.min);
}

async function handleRoleFromChannel(interaction, mode) {
  const channel = interaction.options.getChannel('channel');
  const role = interaction.options.getRole('role');
  const limit = interaction.options.getInteger('limit') || 1000;
  if (!isUsableTextChannel(channel)) return safeEdit(interaction, 'Error: Please select a valid text channel.');

  const messages = await fetchMessages(channel, limit);
  const userIds = new Set();
  for (const message of messages) for (const user of message.mentions.users.values()) userIds.add(user.id);

  let changed = 0, already = 0, failed = 0;
  for (const userId of userIds) {
    try {
      const member = await interaction.guild.members.fetch(userId);
      const hasRole = member.roles.cache.has(role.id);
      if (mode === 'give') {
        if (hasRole) already++;
        else { await member.roles.add(role); changed++; }
      } else {
        if (!hasRole) already++;
        else { await member.roles.remove(role); changed++; }
      }
    } catch { failed++; }
  }

  const verb = mode === 'give' ? 'added to' : 'removed from';
  await safeEdit(interaction, `Done. ${role} ${verb} ${changed} members. Already correct: ${already}. Failed: ${failed}. Users found: ${userIds.size}.`);
}

async function handleEarningsRoles(interaction) {
  const channel = interaction.options.getChannel('channel');
  const limit = interaction.options.getInteger('limit') || 1000;
  if (!isUsableTextChannel(channel)) return safeEdit(interaction, 'Error: Please select a valid text channel.');

  const messages = await fetchMessages(channel, limit);
  const allRoleIds = (config.earningsRoles || []).map(r => r.roleId);
  let updated = 0, already = 0, skipped = 0, failed = 0;

  for (const message of messages) {
    for (const user of message.mentions.users.values()) {
      const earnings = getEarningsFromMessage(message.content, user.id);
      if (earnings === null) { skipped++; continue; }
      const roleData = bestEarningsRole(earnings);
      if (!roleData) { skipped++; continue; }
      try {
        const member = await interaction.guild.members.fetch(user.id);
        const hasCorrect = member.roles.cache.has(roleData.roleId);
        const hasWrong = allRoleIds.some(id => id !== roleData.roleId && member.roles.cache.has(id));
        if (hasCorrect && !hasWrong) { already++; continue; }
        await member.roles.remove(allRoleIds).catch(() => {});
        await member.roles.add(roleData.roleId);
        updated++;
      } catch { failed++; }
    }
  }

  await safeEdit(interaction, `Earnings roles done. Updated: ${updated}. Already correct: ${already}. Skipped: ${skipped}. Failed: ${failed}.`);
}

let twitchTokenCache = { token: null, expiresAt: 0 };
async function getTwitchToken() {
  if (twitchTokenCache.token && Date.now() < twitchTokenCache.expiresAt) return twitchTokenCache.token;
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in Render environment variables.');
  const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch token error: ${res.status}`);
  const data = await res.json();
  twitchTokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return twitchTokenCache.token;
}

async function twitchApi(path) {
  const token = await getTwitchToken();
  const res = await fetch(`https://api.twitch.tv/helix/${path}`, {
    headers: {
      'Client-ID': process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error(`Twitch API error ${res.status} for ${path}`);
  return res.json();
}

async function handlePostCupCheck(interaction) {
  const twitchChannel = interaction.options.getChannel('twitch_channel');
  const hours = interaction.options.getInteger('hours') || 24;
  const limit = interaction.options.getInteger('limit') || 1000;
  if (!isUsableTextChannel(twitchChannel)) return safeEdit(interaction, 'Error: Please select a valid text channel for Twitch channel.');

  const messages = await fetchMessages(twitchChannel, limit);
  const proof = buildProofData(messages);
  const twitchNames = proof.twitchNames;

  const manualDc = proof.dcProofs.length;
  const live = [];
  const vod = [];
  const none = [];
  const notFound = [];

  if (twitchNames.length) {
    try {
      const userQuery = twitchNames.map(n => `login=${encodeURIComponent(n)}`).join('&');
      const usersData = await twitchApi(`users?${userQuery}`);
      const users = usersData.data || [];
      const userByLogin = new Map(users.map(u => [u.login.toLowerCase(), u]));

      const streamQuery = twitchNames.map(n => `user_login=${encodeURIComponent(n)}`).join('&');
      const streamsData = await twitchApi(`streams?${streamQuery}`);
      const liveSet = new Set((streamsData.data || []).map(s => s.user_login.toLowerCase()));

      const since = Date.now() - hours * 60 * 60 * 1000;
      for (const name of twitchNames) {
        if (liveSet.has(name)) { live.push(name); continue; }
        const user = userByLogin.get(name);
        if (!user) { notFound.push(name); continue; }
        const videos = await twitchApi(`videos?user_id=${user.id}&type=archive&first=5`);
        const recent = (videos.data || []).some(v => new Date(v.created_at).getTime() >= since);
        if (recent) vod.push(name);
        else none.push(name);
      }
    } catch (error) {
      return sendLongReply(interaction, `Twitch check failed: ${error.message}`);
    }
  }

  const lines = [];
  lines.push('**Post-Cup Stream Proof Check**');
  lines.push(`Checked ${twitchNames.length} Twitch links.`);
  lines.push(`DC manual proof entries: ${manualDc}.`);
  lines.push(`Live now: ${live.length}.`);
  lines.push(`Recent VOD in last ${hours}h: ${vod.length}.`);
  lines.push(`No proof found: ${none.length}.`);
  lines.push(`Twitch user not found: ${notFound.length}.`);
  lines.push('');
  if (live.length) lines.push(`**Live now:**\n${live.map(n => `🟢 ${n}`).join('\n')}`);
  if (vod.length) lines.push(`\n**Recent VOD found:**\n${vod.map(n => `🟡 ${n}`).join('\n')}`);
  if (none.length) lines.push(`\n**No Twitch proof found:**\n${none.map(n => `🔴 ${n}`).join('\n')}`);
  if (notFound.length) lines.push(`\n**Twitch user not found:**\n${notFound.map(n => `WARN ${n}`).join('\n')}`);

  await sendLongReply(interaction, lines.join('\n'));
  await sendShort(twitchChannel, `Post-cup check completed: ${twitchNames.length} Twitch links checked, ${live.length} live, ${vod.length} VOD, ${none.length} no proof, ${manualDc} DC proof entries.`);
}

async function handleVoiceCreate(interaction) {
  const category = interaction.options.getChannel('category');
  const baseName = interaction.options.getString('name');
  const userLimit = interaction.options.getInteger('user_limit');
  const amount = interaction.options.getInteger('amount');

  if (!category || category.type !== ChannelType.GuildCategory) return safeEdit(interaction, 'Error: Please select a valid category.');

  const createdChannels = [];
  let failed = 0;
  for (let i = 1; i <= amount; i++) {
    const channelName = amount === 1 ? baseName : `${baseName} ${i}`;
    try {
      const created = await interaction.guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: category.id,
        userLimit
      });
      createdChannels.push(created);
    } catch (error) {
      failed++;
      console.error(`Failed to create voice channel ${channelName}:`, error.message);
    }
  }

  const createdList = createdChannels.map(channel => `OK ${channel}`).join('\n');
  await sendLongReply(interaction, `Created ${createdChannels.length} voice channels in ${category}. Failed: ${failed}.\n${createdList}`);
}

async function handleVoiceDelete(interaction) {
  const channel = interaction.options.getChannel('channel');
  if (!channel || channel.type !== ChannelType.GuildVoice) return safeEdit(interaction, 'Error: Please select a valid voice channel.');
  const name = channel.name;
  await channel.delete('Deleted by GT Role Bot command');
  await safeEdit(interaction, `Deleted voice channel: ${name}`);
}

async function handleVoiceDeleteAll(interaction) {
  const category = interaction.options.getChannel('category');
  const prefixRaw = interaction.options.getString('name_prefix');
  const prefix = prefixRaw ? prefixRaw.trim().toLowerCase() : null;

  if (!category || category.type !== ChannelType.GuildCategory) {
    return safeEdit(interaction, 'Error: Please select a valid category.');
  }

  const voiceChannels = interaction.guild.channels.cache
    .filter(channel => channel.type === ChannelType.GuildVoice && channel.parentId === category.id)
    .filter(channel => !prefix || channel.name.toLowerCase().startsWith(prefix));

  if (!voiceChannels.size) {
    const prefixText = prefixRaw ? ` with prefix "${prefixRaw}"` : '';
    return safeEdit(interaction, `No voice channels found in ${category}${prefixText}.`);
  }

  const deleted = [];
  const failed = [];

  for (const channel of voiceChannels.values()) {
    const name = channel.name;
    try {
      await channel.delete('Deleted by GT Role Bot delete-all command');
      deleted.push(name);
    } catch (error) {
      failed.push(`${name} (${error.message})`);
      console.error(`Failed to delete voice channel ${name}:`, error.message);
    }
  }

  const lines = [];
  lines.push(`Deleted ${deleted.length} voice channels from ${category}. Failed: ${failed.length}.`);
  if (deleted.length) lines.push('', '**Deleted:**', ...deleted.map(name => `✅ ${name}`));
  if (failed.length) lines.push('', '**Failed:**', ...failed.map(name => `❌ ${name}`));

  await sendLongReply(interaction, lines.join('\n'));
}


async function addEventBanToUser(interaction, user, role, expiresAt, reason, logChannelId) {
  const member = await interaction.guild.members.fetch(user.id);
  if (member.roles.cache.has(role.id)) {
    upsertEventBan({
      guildId: interaction.guild.id,
      userId: user.id,
      roleId: role.id,
      expiresAt,
      reason,
      addedBy: interaction.user.id,
      logChannelId
    });
    return 'already';
  }

  await member.roles.add(role, reason || 'Event ban added by GT Role Bot');
  upsertEventBan({
    guildId: interaction.guild.id,
    userId: user.id,
    roleId: role.id,
    expiresAt,
    reason,
    addedBy: interaction.user.id,
    logChannelId
  });
  return 'added';
}

async function handleEventBanAdd(interaction) {
  const user = interaction.options.getUser('user');
  const role = interaction.options.getRole('role');
  const untilDate = interaction.options.getString('until_date');
  const days = interaction.options.getInteger('days');
  const reason = interaction.options.getString('reason') || '';
  const logChannel = interaction.options.getChannel('log_channel');
  const logChannelId = logChannel?.id || config.eventBanLogChannelId || '';
  const expiresAt = parseExpiry(untilDate, days);

  const status = await addEventBanToUser(interaction, user, role, expiresAt, reason, logChannelId);
  const statusText = status === 'already' ? 'already had the role, expiry updated' : 'role added';
  await safeEdit(interaction, `Event ban set for <@${user.id}>. ${statusText}. Role: ${role}. Expires: ${formatDateTime(expiresAt)}.${logChannelId ? ` Expiry log: <#${logChannelId}>.` : ''}`);
}

async function handleEventBanFromChannel(interaction) {
  const channel = interaction.options.getChannel('channel');
  const role = interaction.options.getRole('role');
  const untilDate = interaction.options.getString('until_date');
  const days = interaction.options.getInteger('days');
  const limit = interaction.options.getInteger('limit') || 1000;
  const reason = interaction.options.getString('reason') || '';
  const logChannel = interaction.options.getChannel('log_channel');
  const logChannelId = logChannel?.id || config.eventBanLogChannelId || '';

  if (!isUsableTextChannel(channel)) return safeEdit(interaction, 'Error: Please select a valid text channel.');
  const expiresAt = parseExpiry(untilDate, days);
  const messages = await fetchMessages(channel, limit);
  const userIds = new Set();
  for (const message of messages) {
    if (message.author?.bot) continue;
    for (const user of message.mentions.users.values()) userIds.add(user.id);
  }

  let added = 0, updated = 0, failed = 0;
  const failedUsers = [];
  for (const userId of userIds) {
    try {
      const user = await client.users.fetch(userId);
      const status = await addEventBanToUser(interaction, user, role, expiresAt, reason, logChannelId);
      if (status === 'already') updated++;
      else added++;
    } catch (error) {
      failed++;
      failedUsers.push(`<@${userId}> (${error.message})`);
    }
  }

  const lines = [];
  lines.push('**Event Ban From Channel**');
  lines.push(`Checked mentions in ${channel}.`);
  lines.push(`Role: ${role}`);
  lines.push(`Expires: ${formatDateTime(expiresAt)}`);
  if (logChannelId) lines.push(`Expiry log channel: <#${logChannelId}>`);
  lines.push(`Added: ${added}. Updated existing: ${updated}. Failed: ${failed}. Users found: ${userIds.size}.`);
  if (failedUsers.length) lines.push('', '**Failed:**', ...failedUsers.map(x => `❌ ${x}`));
  await sendLongReply(interaction, lines.join('\n'));
}

async function handleEventBanRemove(interaction) {
  const user = interaction.options.getUser('user');
  const role = interaction.options.getRole('role');
  let removedRole = false;

  try {
    const member = await interaction.guild.members.fetch(user.id);
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Event ban manually removed by GT Role Bot');
      removedRole = true;
    }
  } catch (error) {
    return safeEdit(interaction, `Error removing role: ${error.message}`);
  }

  const removedRecords = removeEventBanRecord(interaction.guild.id, user.id, role.id);
  await safeEdit(interaction, `Event ban removed for <@${user.id}>. Role removed: ${removedRole ? 'yes' : 'already not on user'}. Saved expiry cleared: ${removedRecords ? 'yes' : 'none found'}.`);
}

async function handleEventBanList(interaction) {
  const role = interaction.options.getRole('role');
  const store = loadEventBanStore();
  const bans = store.bans
    .filter(b => b.guildId === interaction.guild.id)
    .filter(b => !role || b.roleId === role.id)
    .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt));

  if (!bans.length) return safeEdit(interaction, 'No active saved event bans found.');

  const lines = [];
  lines.push('**Active Event Bans**');
  for (const ban of bans.slice(0, 100)) {
    const reasonText = ban.reason ? ` — ${ban.reason}` : '';
    lines.push(`• <@${ban.userId}> | <@&${ban.roleId}> | expires ${formatDateTime(ban.expiresAt)}${reasonText}`);
  }
  if (bans.length > 100) lines.push(`...and ${bans.length - 100} more.`);
  await sendLongReply(interaction, lines.join('\n'));
}




const TWITCH_WATCH_FILE = path.join(__dirname, 'twitchWatch.json');

function normalizeTwitchLogin(username) {
  return String(username || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '')
    .replace(/^@/, '')
    .split(/[\s/?#]/)[0]
    .toLowerCase();
}

async function initTwitchWatchDatabase() {
  if (!birthdayPool) {
    console.log('Twitch watch storage: twitchWatch.json local file mode.');
    return;
  }

  await birthdayPool.query(`
    CREATE TABLE IF NOT EXISTS gt_twitch_watchers (
      guild_id TEXT NOT NULL,
      username TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      last_live BOOLEAN NOT NULL DEFAULT FALSE,
      last_stream_id TEXT NOT NULL DEFAULT '',
      last_notified_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, username)
    );
  `);

  console.log('Twitch watch storage: PostgreSQL database connected.');
}

function loadTwitchWatchStoreFromFile() {
  let fromFile = [];
  try {
    if (fs.existsSync(TWITCH_WATCH_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TWITCH_WATCH_FILE, 'utf8'));
      fromFile = Array.isArray(parsed.watchers) ? parsed.watchers : [];
    }
  } catch (error) {
    console.error('Could not load twitchWatch.json:', error.message);
  }
  return fromFile;
}

function normalizeWatcherRecord(watcher, fallbackGuildId = GUILD_ID) {
  const login = normalizeTwitchLogin(watcher.username || watcher.login || watcher.twitchUser);
  const channelId = String(watcher.channelId || watcher.discordChannelId || '').trim();
  const guildId = String(watcher.guildId || watcher.guild_id || fallbackGuildId || '').trim();
  if (!login || !channelId || !guildId) return null;
  return {
    guildId,
    username: login,
    channelId,
    lastLive: Boolean(watcher.lastLive ?? watcher.last_live),
    lastStreamId: watcher.lastStreamId || watcher.last_stream_id || '',
    lastNotifiedAt: watcher.lastNotifiedAt || watcher.last_notified_at || ''
  };
}

async function loadTwitchWatchStore() {
  const fromConfig = Array.isArray(config.twitchLiveNotifications?.watchers)
    ? config.twitchLiveNotifications.watchers
    : [];

  let storedWatchers = [];
  if (birthdayPool) {
    try {
      const result = await birthdayPool.query('SELECT * FROM gt_twitch_watchers');
      storedWatchers = result.rows.map(row => ({
        guildId: row.guild_id,
        username: row.username,
        channelId: row.channel_id,
        lastLive: row.last_live,
        lastStreamId: row.last_stream_id || '',
        lastNotifiedAt: row.last_notified_at ? new Date(row.last_notified_at).toISOString() : ''
      }));
    } catch (error) {
      console.error('Could not load Twitch watchers from database:', error.message);
    }
  } else {
    storedWatchers = loadTwitchWatchStoreFromFile();
  }

  const merged = new Map();
  for (const raw of [...fromConfig, ...storedWatchers]) {
    const watcher = normalizeWatcherRecord(raw);
    if (!watcher) continue;
    merged.set(`${watcher.guildId}:${watcher.username}`, watcher);
  }

  return { watchers: [...merged.values()] };
}

async function saveTwitchWatchStore(store) {
  const watchers = (store.watchers || []).map(w => normalizeWatcherRecord(w)).filter(Boolean);

  if (birthdayPool) {
    const clientDb = await birthdayPool.connect();
    try {
      await clientDb.query('BEGIN');
      for (const watcher of watchers) {
        await clientDb.query(
          `INSERT INTO gt_twitch_watchers (guild_id, username, channel_id, last_live, last_stream_id, last_notified_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (guild_id, username)
           DO UPDATE SET
             channel_id = EXCLUDED.channel_id,
             last_live = EXCLUDED.last_live,
             last_stream_id = EXCLUDED.last_stream_id,
             last_notified_at = EXCLUDED.last_notified_at,
             updated_at = NOW()`,
          [watcher.guildId, watcher.username, watcher.channelId, watcher.lastLive, watcher.lastStreamId || '', watcher.lastNotifiedAt || null]
        );
      }
      await clientDb.query('COMMIT');
    } catch (error) {
      await clientDb.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      clientDb.release();
    }
    return;
  }

  fs.writeFileSync(TWITCH_WATCH_FILE, JSON.stringify({ watchers }, null, 2));
}

async function upsertTwitchWatcher(watcher) {
  const normalized = normalizeWatcherRecord(watcher);
  if (!normalized) throw new Error('Invalid Twitch watcher.');

  if (birthdayPool) {
    await birthdayPool.query(
      `INSERT INTO gt_twitch_watchers (guild_id, username, channel_id, last_live, last_stream_id, last_notified_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (guild_id, username)
       DO UPDATE SET
         channel_id = EXCLUDED.channel_id,
         last_live = EXCLUDED.last_live,
         last_stream_id = EXCLUDED.last_stream_id,
         last_notified_at = EXCLUDED.last_notified_at,
         updated_at = NOW()`,
      [normalized.guildId, normalized.username, normalized.channelId, normalized.lastLive, normalized.lastStreamId || '', normalized.lastNotifiedAt || null]
    );
    return;
  }

  const store = await loadTwitchWatchStore();
  const existing = store.watchers.find(w => w.guildId === normalized.guildId && w.username === normalized.username);
  if (existing) Object.assign(existing, normalized);
  else store.watchers.push(normalized);
  await saveTwitchWatchStore(store);
}

async function removeTwitchWatcher(guildId, username) {
  const login = normalizeTwitchLogin(username);
  if (birthdayPool) {
    const result = await birthdayPool.query('DELETE FROM gt_twitch_watchers WHERE guild_id = $1 AND username = $2', [guildId, login]);
    return result.rowCount;
  }

  const store = await loadTwitchWatchStore();
  const before = store.watchers.length;
  store.watchers = store.watchers.filter(w => !(w.guildId === guildId && w.username === login));
  await saveTwitchWatchStore(store);
  return before - store.watchers.length;
}

function buildTwitchLiveMessage(stream) {
  const login = stream.user_login || stream.user_name;
  const title = stream.title ? `\n📝 ${stream.title}` : '';
  const game = stream.game_name ? `\n🎮 ${stream.game_name}` : '';
  return `🔴 **${stream.user_name || login} is LIVE on Twitch!**${game}${title}\n📺 https://twitch.tv/${login}`;
}

async function fetchTwitchStreamsByLogin(logins) {
  const unique = [...new Set((logins || []).map(normalizeTwitchLogin).filter(Boolean))];
  const streams = [];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    if (!chunk.length) continue;
    const query = chunk.map(n => `user_login=${encodeURIComponent(n)}`).join('&');
    const data = await twitchApi(`streams?${query}`);
    streams.push(...(data.data || []));
  }
  return streams;
}

async function checkTwitchLiveNotifications() {
  const store = await loadTwitchWatchStore();
  if (!store.watchers.length) return;

  try {
    const streams = await fetchTwitchStreamsByLogin(store.watchers.map(w => w.username));
    const liveByLogin = new Map(streams.map(s => [String(s.user_login).toLowerCase(), s]));
    let changed = false;

    for (const watcher of store.watchers) {
      const stream = liveByLogin.get(watcher.username);
      const wasLive = Boolean(watcher.lastLive);

      if (stream) {
        const isNewStream = watcher.lastStreamId !== stream.id;
        if (!wasLive || isNewStream) {
          const channel = await client.channels.fetch(watcher.channelId).catch(() => null);
          if (isUsableTextChannel(channel)) {
            await channel.send(buildTwitchLiveMessage(stream));
            console.log(`Twitch live notification sent for ${watcher.username}.`);
          } else {
            console.warn(`Twitch live notification channel invalid for ${watcher.username}: ${watcher.channelId}`);
          }
        }
        watcher.lastLive = true;
        watcher.lastStreamId = stream.id;
        watcher.lastNotifiedAt = new Date().toISOString();
        changed = true;
      } else if (wasLive || watcher.lastStreamId) {
        watcher.lastLive = false;
        watcher.lastStreamId = '';
        changed = true;
      }
    }

    if (changed) await saveTwitchWatchStore(store);
  } catch (error) {
    console.error('Twitch live notification check failed:', error.message);
  }
}

async function handleTwitchWatchAdd(interaction) {
  const username = normalizeTwitchLogin(interaction.options.getString('username'));
  const channel = interaction.options.getChannel('channel');
  if (!username) return safeEdit(interaction, 'Please enter a valid Twitch username.');
  if (!isUsableTextChannel(channel)) return safeEdit(interaction, 'Please select a valid text channel.');

  // Validate that the Twitch user exists.
  const users = await twitchApi(`users?login=${encodeURIComponent(username)}`);
  const user = (users.data || [])[0];
  if (!user) return safeEdit(interaction, `Twitch user not found: ${username}`);

  const store = await loadTwitchWatchStore();
  const existing = store.watchers.find(w => w.guildId === interaction.guildId && w.username === username);
  await upsertTwitchWatcher({
    guildId: interaction.guildId,
    username,
    channelId: channel.id,
    lastLive: existing ? existing.lastLive : false,
    lastStreamId: existing ? existing.lastStreamId : '',
    lastNotifiedAt: existing ? existing.lastNotifiedAt : ''
  });

  await safeEdit(interaction, `Twitch live notifications ${existing ? 'updated' : 'enabled'} for **${user.display_name || username}** in ${channel}.`);
}

async function handleTwitchWatchRemove(interaction) {
  const username = normalizeTwitchLogin(interaction.options.getString('username'));
  const removed = await removeTwitchWatcher(interaction.guildId, username);
  await safeEdit(interaction, removed ? `Removed Twitch live notifications for **${username}**.` : `No Twitch live notification watch found for **${username}**.`);
}

async function handleTwitchWatchList(interaction) {
  const store = await loadTwitchWatchStore();
  const watchers = store.watchers.filter(w => w.guildId === interaction.guildId);
  if (!watchers.length) return safeEdit(interaction, 'No Twitch live notification watches configured.');
  const lines = ['**Twitch Live Notifications**', ''];
  for (const watcher of watchers) {
    lines.push(`• **${watcher.username}** → <#${watcher.channelId}> ${watcher.lastLive ? '🔴 currently marked live' : ''}`.trim());
  }
  await sendLongReply(interaction, lines.join('\n'));
}

function getFortniteCalendarSource() {
  const url = process.env.FORTNITE_CALENDAR_ICS_URL || config.fortniteCalendarIcsUrl || config.fortniteCalendarUrl || '';
  const file = process.env.FORTNITE_CALENDAR_ICS_FILE || config.fortniteCalendarIcsFile || '';
  return { url: String(url || '').trim(), file: String(file || '').trim() };
}

async function fetchFortniteCalendarText() {
  const { url, file } = getFortniteCalendarSource();

  if (file) {
    const filePath = path.isAbsolute(file) ? file : path.join(__dirname, file);
    if (!fs.existsSync(filePath)) throw new Error(`Fortnite calendar file not found: ${file}`);
    return fs.readFileSync(filePath, 'utf8');
  }

  if (!url) {
    throw new Error('No Fortnite calendar configured. Add fortniteCalendarIcsUrl to config.json or FORTNITE_CALENDAR_ICS_URL in Render Environment.');
  }

  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 GT-Role-Bot/7.1 (+https://discord.com)',
      'Accept': 'text/calendar, text/plain, */*',
      'Cache-Control': 'no-cache'
    }
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Could not fetch Fortnite calendar: HTTP 403. The ICS link is blocked or private. Make the calendar public/exportable, use the direct .ics export link, or upload the .ics file into GitHub and set fortniteCalendarIcsFile.');
    }
    throw new Error(`Could not fetch Fortnite calendar: HTTP ${response.status}`);
  }

  const text = await response.text();
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('The calendar response is not a valid ICS calendar.');
  return text;
}

function unfoldIcsLines(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const lines = [];
  for (const line of raw) {
    if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }
  return lines;
}

function unescapeIcsValue(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function parseIcsDate(value) {
  const raw = String(value || '').trim();
  let match = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0);
  }

  match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (match) {
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6])));
  }

  match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  }

  return null;
}

function parseIcsEvents(icsText) {
  const lines = unfoldIcsLines(icsText);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.summary && current?.start) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const left = line.slice(0, sep);
    const value = line.slice(sep + 1);
    const key = left.split(';')[0].toUpperCase();

    if (key === 'SUMMARY') current.summary = unescapeIcsValue(value);
    if (key === 'LOCATION') current.location = unescapeIcsValue(value);
    if (key === 'DESCRIPTION') current.description = unescapeIcsValue(value);
    if (key === 'DTSTART') current.start = parseIcsDate(value);
    if (key === 'DTEND') current.end = parseIcsDate(value);
  }

  return events
    .filter(event => event.start instanceof Date && !Number.isNaN(event.start.getTime()))
    .sort((a, b) => a.start - b.start);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function endOfToday() {
  const start = startOfToday();
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}


function getFortniteTimezone() {
  return process.env.FORTNITE_TIMEZONE || config.fortniteTimezone || config.autoFortniteEvents?.timezone || 'Europe/Berlin';
}

function formatEventDate(event, timezone = getFortniteTimezone()) {
  return event.start.toLocaleDateString('en-GB', { timeZone: timezone, weekday: 'short', day: '2-digit', month: '2-digit' });
}

function formatEventTimeOnly(date, timezone = getFortniteTimezone()) {
  return date.toLocaleTimeString('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' });
}

function formatEventTime(event, timezone = getFortniteTimezone()) {
  const datePart = formatEventDate(event, timezone);
  const start = formatEventTimeOnly(event.start, timezone);
  if (!event.end || Number.isNaN(event.end.getTime())) return `${datePart}, ${start}`;
  const end = formatEventTimeOnly(event.end, timezone);
  return `${datePart}, ${start} - ${end}`;
}

function extractEventRegion(summary) {
  const match = String(summary || '').match(/\[(EU|NAC|NAE|NAW|OCE|ASIA|ME|BR|GLOBAL|ALL)\]/i);
  return match ? match[1].toUpperCase() : 'OTHER';
}

function regionFlag(region) {
  const map = {
    EU: '🇪🇺', NAC: '🇺🇸', NAE: '🇺🇸', NAW: '🇺🇸',
    OCE: '🇦🇺', ASIA: '🌏', ME: '🌍', BR: '🇧🇷', GLOBAL: '🌐', ALL: '🌐', OTHER: '•'
  };
  return map[region] || '•';
}

function cleanEventTitle(summary) {
  return String(summary || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectEventGroup(summary) {
  const s = String(summary || '').toLowerCase();
  if (s.includes('fncs')) return '🏆 FNCS';
  if (s.includes('cash cup')) return '💰 Cash Cups';
  if (s.includes('ranked cup') || s.includes('ranked')) return '⚔️ Ranked Cups';
  if (s.includes('victory cup')) return '👑 Victory Cups';
  if (s.includes('console')) return '🎮 Console';
  if (s.includes('zero build') || /\bzb\b/i.test(summary)) return '🛡️ Zero Build';
  if (s.includes('reload')) return '🔁 Reload';
  return '📌 Other Events';
}

function filterFortniteEvents(events, { region = 'ALL', keyword = '' } = {}) {
  const wantedRegion = String(region || 'ALL').trim().toUpperCase();
  const wantedKeyword = String(keyword || '').trim().toLowerCase();

  return events.filter(event => {
    const summary = String(event.summary || '');
    const eventRegion = extractEventRegion(summary);
    const regionOk = wantedRegion === 'ALL' || eventRegion === wantedRegion;
    const keywordOk = !wantedKeyword || summary.toLowerCase().includes(wantedKeyword);
    return regionOk && keywordOk;
  });
}

async function getFortniteEventsInRange(from, to, limit = 100, filters = {}) {
  const icsText = await fetchFortniteCalendarText();
  return filterFortniteEvents(
    parseIcsEvents(icsText).filter(event => event.start >= from && event.start < to),
    filters
  ).slice(0, limit);
}

function buildFortniteEventsMessage(events, title, options = {}) {
  const timezone = options.timezone || getFortniteTimezone();
  const lines = [];
  lines.push(`**${title}**`);
  lines.push('');

  if (!events.length) {
    lines.push('No Fortnite events found for this range.');
    return lines.join('\n');
  }

  for (const event of events) {
    lines.push(`📅 **${cleanEventTitle(event.summary)}**`);
    lines.push(`⏰ ${formatEventTime(event, timezone)}`);
    if (event.location) lines.push(`📍 ${event.location}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildGroupedFortniteEventsMessage(events, title, options = {}) {
  const timezone = options.timezone || getFortniteTimezone();
  const regionFilter = String(options.region || 'ALL').toUpperCase();
  const keyword = String(options.keyword || '').trim();
  const lines = [];
  lines.push(`**${title}**`);
  lines.push(`Timezone: ${timezone}${regionFilter !== 'ALL' ? ` | Region: ${regionFilter}` : ''}${keyword ? ` | Filter: ${keyword}` : ''}`);
  lines.push('');

  if (!events.length) {
    lines.push('No Fortnite events found for this range.');
    return lines.join('\n');
  }

  const order = ['🏆 FNCS', '💰 Cash Cups', '👑 Victory Cups', '⚔️ Ranked Cups', '🎮 Console', '🛡️ Zero Build', '🔁 Reload', '📌 Other Events'];
  const grouped = new Map();
  for (const event of events) {
    const group = detectEventGroup(event.summary);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(event);
  }

  for (const group of order) {
    const groupEvents = grouped.get(group);
    if (!groupEvents?.length) continue;
    lines.push(`**${group}**`);
    for (const event of groupEvents.sort((a, b) => a.start - b.start)) {
      const region = extractEventRegion(event.summary);
      const start = formatEventTimeOnly(event.start, timezone);
      const end = event.end && !Number.isNaN(event.end.getTime()) ? `-${formatEventTimeOnly(event.end, timezone)}` : '';
      const date = formatEventDate(event, timezone);
      lines.push(`${regionFlag(region)} **${region}** — ${cleanEventTitle(event.summary)} — ${date}, ${start}${end}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

async function handleFortniteEvents(interaction, mode) {
  const limit = interaction.options.getInteger('limit') || (mode === 'today' ? 25 : 25);
  let from;
  let to;
  let title;

  if (mode === 'today') {
    from = startOfToday();
    to = endOfToday();
    title = "Today's Fortnite Events";
  } else {
    const days = interaction.options.getInteger('days') || 7;
    from = new Date(Date.now() - 60 * 60 * 1000);
    to = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    title = `Upcoming Fortnite Events - next ${days} days`;
  }

  const events = await getFortniteEventsInRange(from, to, limit, { region: 'ALL' });
  await sendLongReply(interaction, buildGroupedFortniteEventsMessage(events, title, { region: 'ALL' }));
}

async function handleFortniteEventsPost(interaction) {
  const channel = interaction.options.getChannel('channel');
  if (!isUsableTextChannel(channel)) return safeEdit(interaction, 'Please select a valid text channel.');

  const days = interaction.options.getInteger('days') || 7;
  const limit = interaction.options.getInteger('limit') || 25;
  const region = interaction.options.getString('region') || 'ALL';
  const keyword = interaction.options.getString('keyword') || '';
  const from = new Date(Date.now() - 60 * 60 * 1000);
  const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const events = await getFortniteEventsInRange(from, to, limit, { region, keyword });
  const message = buildGroupedFortniteEventsMessage(events, `Upcoming Fortnite Events - next ${days} days`, { region, keyword });

  for (const chunk of splitText(message, 1900)) await channel.send(chunk);
  await safeEdit(interaction, `Posted ${events.length} Fortnite event(s) in ${channel}.`);
}

async function handleFortniteEventsGrouped(interaction) {
  const channel = interaction.options.getChannel('channel');
  if (!isUsableTextChannel(channel)) return safeEdit(interaction, 'Please select a valid text channel.');

  const days = interaction.options.getInteger('days') || 1;
  const region = interaction.options.getString('region') || config.autoFortniteEvents?.region || 'EU';
  const keyword = interaction.options.getString('keyword') || '';
  const limit = 100;
  const from = days === 1 ? startOfToday() : new Date(Date.now() - 60 * 60 * 1000);
  const to = days === 1 ? endOfToday() : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const events = await getFortniteEventsInRange(from, to, limit, { region, keyword });
  const title = days === 1 ? "Today's Fortnite Comp Calendar" : `Fortnite Comp Calendar - next ${days} days`;
  const message = buildGroupedFortniteEventsMessage(events, title, { region, keyword });

  for (const chunk of splitText(message, 1900)) await channel.send(chunk);
  await safeEdit(interaction, `Posted grouped Fortnite calendar in ${channel}. Events: ${events.length}.`);
}

function getAutoFortniteConfig() {
  const cfg = config.autoFortniteEvents || {};
  const enabledRaw = process.env.AUTO_FORTNITE_EVENTS_ENABLED ?? cfg.enabled ?? false;
  const enabled = enabledRaw === true || String(enabledRaw).toLowerCase() === 'true' || String(enabledRaw) === '1';
  return {
    enabled,
    channelId: process.env.AUTO_FORTNITE_EVENTS_CHANNEL_ID || cfg.channelId || '',
    time: process.env.AUTO_FORTNITE_EVENTS_TIME || cfg.time || '09:00',
    timezone: process.env.AUTO_FORTNITE_EVENTS_TIMEZONE || cfg.timezone || getFortniteTimezone(),
    region: process.env.AUTO_FORTNITE_EVENTS_REGION || cfg.region || 'EU',
    days: Number(process.env.AUTO_FORTNITE_EVENTS_DAYS || cfg.days || 1),
    keyword: process.env.AUTO_FORTNITE_EVENTS_KEYWORD || cfg.keyword || ''
  };
}

function getDatePartsInTimezone(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  const data = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return {
    dateKey: `${data.year}-${data.month}-${data.day}`,
    time: `${data.hour}:${data.minute}`
  };
}

let lastAutoFortnitePostKey = null;
async function checkAutoFortniteEvents() {
  const cfg = getAutoFortniteConfig();
  if (!cfg.enabled || !cfg.channelId) return;

  const nowParts = getDatePartsInTimezone(new Date(), cfg.timezone);
  if (nowParts.time !== cfg.time) return;
  if (lastAutoFortnitePostKey === nowParts.dateKey) return;

  const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
  if (!isUsableTextChannel(channel)) {
    console.warn('Auto Fortnite Events: configured channel is invalid or not text based.');
    lastAutoFortnitePostKey = nowParts.dateKey;
    return;
  }

  try {
    const days = Math.min(Math.max(cfg.days || 1, 1), 14);
    const from = days === 1 ? startOfToday() : new Date(Date.now() - 60 * 60 * 1000);
    const to = days === 1 ? endOfToday() : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const events = await getFortniteEventsInRange(from, to, 100, { region: cfg.region, keyword: cfg.keyword });
    const title = days === 1 ? "Today's Fortnite Comp Calendar" : `Fortnite Comp Calendar - next ${days} days`;
    const message = buildGroupedFortniteEventsMessage(events, title, { region: cfg.region, keyword: cfg.keyword, timezone: cfg.timezone });
    for (const chunk of splitText(message, 1900)) await channel.send(chunk);
    lastAutoFortnitePostKey = nowParts.dateKey;
    console.log(`Auto Fortnite Events posted ${events.length} event(s) to ${cfg.channelId}.`);
  } catch (error) {
    console.error('Auto Fortnite Events failed:', error);
    await sendShort(channel, `Could not post Fortnite calendar automatically: ${error.message}`);
    lastAutoFortnitePostKey = nowParts.dateKey;
  }
}


const BIRTHDAYS_FILE = path.join(__dirname, 'birthdays.json');

const birthdayDbUrl = process.env.DATABASE_URL || process.env.BIRTHDAY_DATABASE_URL || '';
const birthdayPool = birthdayDbUrl && Pool
  ? new Pool({
      connectionString: birthdayDbUrl,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }
    })
  : null;

async function initBirthdayDatabase() {
  if (!birthdayPool) {
    console.log('Birthday storage: birthdays.json local file mode.');
    return;
  }

  await birthdayPool.query(`
    CREATE TABLE IF NOT EXISTS gt_birthdays (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      month INTEGER NOT NULL,
      birth_year INTEGER,
      timezone TEXT NOT NULL DEFAULT 'Europe/Berlin',
      reminder_time TEXT NOT NULL DEFAULT '09:00',
      last_sent_year INTEGER,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  console.log('Birthday storage: PostgreSQL database connected.');
}

function loadBirthdayStore() {
  try {
    if (!fs.existsSync(BIRTHDAYS_FILE)) return { birthdays: [] };
    const parsed = JSON.parse(fs.readFileSync(BIRTHDAYS_FILE, 'utf8'));
    return { birthdays: Array.isArray(parsed.birthdays) ? parsed.birthdays : [] };
  } catch (error) {
    console.error('Could not load birthdays.json:', error);
    return { birthdays: [] };
  }
}

function saveBirthdayStore(store) {
  fs.writeFileSync(BIRTHDAYS_FILE, JSON.stringify(store, null, 2));
}

function rowToBirthday(row) {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    day: row.day,
    month: row.month,
    birthYear: row.birth_year || null,
    timezone: row.timezone,
    reminderTime: row.reminder_time,
    lastSentYear: row.last_sent_year || null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

async function getBirthdays(guildId = null) {
  if (birthdayPool) {
    const result = guildId
      ? await birthdayPool.query('SELECT * FROM gt_birthdays WHERE guild_id = $1', [guildId])
      : await birthdayPool.query('SELECT * FROM gt_birthdays');
    return result.rows.map(rowToBirthday);
  }

  const store = loadBirthdayStore();
  return guildId ? store.birthdays.filter(b => b.guildId === guildId) : store.birthdays;
}

async function upsertBirthday(record) {
  if (birthdayPool) {
    await birthdayPool.query(
      `INSERT INTO gt_birthdays (guild_id, user_id, day, month, birth_year, timezone, reminder_time, last_sent_year, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NOW())
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET
         day = EXCLUDED.day,
         month = EXCLUDED.month,
         birth_year = EXCLUDED.birth_year,
         timezone = EXCLUDED.timezone,
         reminder_time = EXCLUDED.reminder_time,
         last_sent_year = NULL,
         updated_at = NOW()`,
      [record.guildId, record.userId, record.day, record.month, record.birthYear || null, record.timezone, record.reminderTime]
    );
    return;
  }

  const store = loadBirthdayStore();
  const existing = store.birthdays.find(b => b.guildId === record.guildId && b.userId === record.userId);
  if (existing) Object.assign(existing, { ...record, lastSentYear: null, updatedAt: new Date().toISOString() });
  else store.birthdays.push({ ...record, lastSentYear: null, updatedAt: new Date().toISOString() });
  saveBirthdayStore(store);
}

async function removeBirthday(guildId, userId) {
  if (birthdayPool) {
    const result = await birthdayPool.query('DELETE FROM gt_birthdays WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
    return result.rowCount;
  }

  const store = loadBirthdayStore();
  const before = store.birthdays.length;
  store.birthdays = store.birthdays.filter(b => !(b.guildId === guildId && b.userId === userId));
  saveBirthdayStore(store);
  return before - store.birthdays.length;
}

async function markBirthdaySent(guildId, userId, year) {
  if (birthdayPool) {
    await birthdayPool.query('UPDATE gt_birthdays SET last_sent_year = $3, updated_at = NOW() WHERE guild_id = $1 AND user_id = $2', [guildId, userId, year]);
    return;
  }

  const store = loadBirthdayStore();
  const birthday = store.birthdays.find(b => b.guildId === guildId && b.userId === userId);
  if (birthday) {
    birthday.lastSentYear = year;
    saveBirthdayStore(store);
  }
}

function getBirthdayChannelId() {
  return process.env.BIRTHDAY_CHANNEL_ID || config.birthdayChannelId || '';
}

function isValidTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeReminderTime(value) {
  const raw = String(value || '09:00').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error('Reminder time must be HH:MM, for example 09:00 or 21:30.');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error('Reminder time must be a valid HH:MM time.');
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function isValidBirthdayDate(day, month) {
  const test = new Date(2024, month - 1, day); // leap year allows Feb 29
  return test.getMonth() === month - 1 && test.getDate() === day;
}

function formatBirthdayDate(day, month, birthYear = null) {
  const base = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.`;
  return birthYear ? `${base}${birthYear}` : base;
}

function nextBirthdayDate(day, month, timezone) {
  const now = new Date();
  const parts = getDatePartsInTimezone(now, timezone);
  let year = Number(parts.dateKey.slice(0, 4));
  let next = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const todayKey = parts.dateKey;
  const birthdayKeyThisYear = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (birthdayKeyThisYear < todayKey) next = new Date(Date.UTC(year + 1, month - 1, day, 12, 0, 0));
  return next;
}

function daysUntilBirthday(day, month, timezone) {
  const now = new Date();
  const parts = getDatePartsInTimezone(now, timezone);
  const todayUtc = new Date(`${parts.dateKey}T12:00:00Z`);
  const next = nextBirthdayDate(day, month, timezone);
  return Math.max(0, Math.round((next.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000)));
}

function ageTurningThisYear(birthday, year) {
  if (!birthday.birthYear) return null;
  const age = Number(year) - Number(birthday.birthYear);
  return age > 0 && age < 130 ? age : null;
}

async function handleBirthdaySet(interaction) {
  const day = interaction.options.getInteger('day');
  const month = interaction.options.getInteger('month');
  const birthYear = interaction.options.getInteger('year') || null;
  const timezone = (interaction.options.getString('timezone') || config.birthdayDefaultTimezone || 'Europe/Berlin').trim();
  const reminderTime = normalizeReminderTime(interaction.options.getString('reminder_time') || config.birthdayDefaultTime || '09:00');

  if (!isValidBirthdayDate(day, month)) throw new Error('That birthday date is not valid.');
  if (!isValidTimezone(timezone)) throw new Error('That timezone is not valid. Example: Europe/Berlin, Europe/London, America/New_York.');
  if (birthYear && birthYear > new Date().getFullYear()) throw new Error('Birth year cannot be in the future.');

  await upsertBirthday({
    guildId: interaction.guildId,
    userId: interaction.user.id,
    day,
    month,
    birthYear,
    timezone,
    reminderTime
  });

  const channelId = getBirthdayChannelId();
  const channelText = channelId ? `<#${channelId}>` : 'No birthday channel configured yet';
  const yearText = birthYear ? ` with birth year ${birthYear}` : '';
  await safeEdit(interaction, `🎂 Birthday saved for ${formatBirthdayDate(day, month)}${yearText} at ${reminderTime} (${timezone}).\nReminder channel: ${channelText}`);
}

async function handleBirthdayRemove(interaction) {
  const removed = await removeBirthday(interaction.guildId, interaction.user.id);
  await safeEdit(interaction, removed ? '🎂 Your birthday reminder was removed.' : 'You do not have a saved birthday reminder.');
}

async function handleBirthdayNext(interaction) {
  const limit = interaction.options.getInteger('limit') || 10;
  const items = (await getBirthdays(interaction.guildId))
    .map(b => ({ ...b, days: daysUntilBirthday(b.day, b.month, b.timezone || 'Europe/Berlin') }))
    .sort((a, b) => a.days - b.days)
    .slice(0, limit);

  if (!items.length) return safeEdit(interaction, 'No birthdays saved yet. Players can add theirs with `/birthdayset`.');
  const lines = items.map(b => {
    const ageText = b.birthYear ? ` — turns ${ageTurningThisYear(b, Number(getDatePartsInTimezone(new Date(), b.timezone || 'Europe/Berlin').dateKey.slice(0, 4)) + (b.days === 0 ? 0 : 0)) || '?'} ` : '';
    return `• <@${b.userId}> — ${formatBirthdayDate(b.day, b.month, b.birthYear)}${ageText}— in ${b.days} day${b.days === 1 ? '' : 's'} — ${b.reminderTime || '09:00'} ${b.timezone || 'Europe/Berlin'}`;
  });
  await sendLongReply(interaction, `🎂 Upcoming GT Birthdays\n\n${lines.join('\n')}`);
}

async function handleBirthdayList(interaction) {
  const items = (await getBirthdays(interaction.guildId))
    .sort((a, b) => a.month - b.month || a.day - b.day);
  if (!items.length) return safeEdit(interaction, 'No birthdays saved yet.');
  const lines = items.map(b => `• <@${b.userId}> — ${formatBirthdayDate(b.day, b.month, b.birthYear)} — ${b.reminderTime || '09:00'} ${b.timezone || 'Europe/Berlin'}`);
  await sendLongReply(interaction, `🎂 Saved Birthdays (${items.length})\n\n${lines.join('\n')}`);
}



const PLAYERS_FILE = path.join(__dirname, 'data', 'gtPlayers.json');

async function initPlayerDatabase() {
  if (!birthdayPool) {
    console.log('Player card storage: gtPlayers.json local file mode.');
    return;
  }

  await birthdayPool.query(`
    CREATE TABLE IF NOT EXISTS gt_players (
      guild_id TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      gt_id TEXT NOT NULL,
      ign TEXT NOT NULL,
      roster TEXT NOT NULL,
      country TEXT DEFAULT '',
      mode TEXT DEFAULT '',
      player_role TEXT DEFAULT '',
      earnings TEXT DEFAULT '',
      placement TEXT DEFAULT '',
      twitch TEXT DEFAULT '',
      tiktok TEXT DEFAULT '',
      x_url TEXT DEFAULT '',
      youtube TEXT DEFAULT '',
      quote TEXT DEFAULT '',
      image TEXT DEFAULT '',
      channel_id TEXT DEFAULT '',
      message_id TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      updated_by TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (guild_id, discord_id),
      UNIQUE (guild_id, gt_id)
    );
  `);

  console.log('Player card storage: PostgreSQL database connected.');
}

function loadJsonFile(file, fallback) {
  ensureDataDir();
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8')) || fallback;
  } catch (error) {
    console.error(`Could not load ${path.basename(file)}:`, error.message);
    return fallback;
  }
}

function saveJsonFile(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function cleanOptional(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function validUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function rosterEmoji(roster) {
  const value = String(roster || '').toLowerCase();
  if (value.includes('pro')) return '👑';
  if (value.includes('academy')) return '⭐';
  if (value.includes('queen')) return '👸';
  if (value.includes('creator')) return '🎥';
  return '💛';
}

function playerSortValue(player) {
  const order = { 'GT Pro': 1, 'GT Queens Comp': 2, 'GT Academy': 3, 'GT Member': 4, 'Creator': 5 };
  return `${order[player.roster] || 99}-${String(player.ign || '').toLowerCase()}`;
}

function getPlayerDirectoryChannelId() {
  return process.env.PLAYER_DIRECTORY_CHANNEL_ID || config.playerDirectoryChannelId || '';
}

async function getPlayerDirectoryChannel(guild) {
  const channelId = getPlayerDirectoryChannelId();
  if (!channelId) return null;
  return guild.channels.fetch(channelId).catch(() => null);
}

function normalizePlayerRow(row) {
  if (!row) return null;
  return {
    discordId: row.discord_id || row.discordId,
    gtId: row.gt_id || row.gtId,
    ign: row.ign || '',
    roster: row.roster || '',
    country: row.country || '',
    mode: row.mode || '',
    role: row.player_role || row.role || '',
    earnings: row.earnings || '',
    placement: row.placement || '',
    twitch: row.twitch || '',
    tiktok: row.tiktok || '',
    x: row.x_url || row.x || '',
    youtube: row.youtube || '',
    quote: row.quote || '',
    image: row.image || '',
    channelId: row.channel_id || row.channelId || '',
    messageId: row.message_id || row.messageId || ''
  };
}

async function getNextGtId(guildId) {
  if (!birthdayPool) {
    const store = loadJsonFile(PLAYERS_FILE, { nextId: 1, players: {} });
    const gtId = `GT-${String(store.nextId || 1).padStart(3, '0')}`;
    store.nextId = (store.nextId || 1) + 1;
    saveJsonFile(PLAYERS_FILE, store);
    return gtId;
  }

  const result = await birthdayPool.query(`
    SELECT COALESCE(MAX(CAST(SUBSTRING(gt_id FROM 4) AS INT)), 0) + 1 AS next_id
    FROM gt_players
    WHERE guild_id = $1 AND gt_id ~ '^GT-[0-9]+$'
  `, [guildId]);
  return `GT-${String(result.rows[0].next_id || 1).padStart(3, '0')}`;
}

async function getPlayer(guildId, discordId) {
  if (!birthdayPool) {
    const store = loadJsonFile(PLAYERS_FILE, { nextId: 1, players: {} });
    return store.players[discordId] || null;
  }
  const result = await birthdayPool.query('SELECT * FROM gt_players WHERE guild_id=$1 AND discord_id=$2', [guildId, discordId]);
  return normalizePlayerRow(result.rows[0]);
}

async function listPlayers(guildId) {
  if (!birthdayPool) {
    const store = loadJsonFile(PLAYERS_FILE, { nextId: 1, players: {} });
    return Object.values(store.players || {}).sort((a,b) => playerSortValue(a).localeCompare(playerSortValue(b)));
  }
  const result = await birthdayPool.query('SELECT * FROM gt_players WHERE guild_id=$1 ORDER BY roster, ign', [guildId]);
  return result.rows.map(normalizePlayerRow).sort((a,b) => playerSortValue(a).localeCompare(playerSortValue(b)));
}

async function savePlayer(guildId, userId, player) {
  if (!birthdayPool) {
    const store = loadJsonFile(PLAYERS_FILE, { nextId: 1, players: {} });
    store.players[userId] = player;
    saveJsonFile(PLAYERS_FILE, store);
    return player;
  }

  await birthdayPool.query(`
    INSERT INTO gt_players
      (guild_id, discord_id, gt_id, ign, roster, country, mode, player_role, earnings, placement, twitch, tiktok, x_url, youtube, quote, image, channel_id, message_id, created_by, updated_by, updated_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
    ON CONFLICT (guild_id, discord_id) DO UPDATE SET
      ign=EXCLUDED.ign, roster=EXCLUDED.roster, country=EXCLUDED.country, mode=EXCLUDED.mode, player_role=EXCLUDED.player_role,
      earnings=EXCLUDED.earnings, placement=EXCLUDED.placement, twitch=EXCLUDED.twitch, tiktok=EXCLUDED.tiktok, x_url=EXCLUDED.x_url,
      youtube=EXCLUDED.youtube, quote=EXCLUDED.quote, image=EXCLUDED.image, channel_id=EXCLUDED.channel_id, message_id=EXCLUDED.message_id,
      updated_by=EXCLUDED.updated_by, updated_at=NOW()
  `, [guildId, userId, player.gtId, player.ign, player.roster, player.country, player.mode, player.role, player.earnings, player.placement, player.twitch, player.tiktok, player.x, player.youtube, player.quote, player.image, player.channelId || '', player.messageId || '', player.createdBy || '', player.updatedBy || '']);
  return player;
}

async function deletePlayer(guildId, userId) {
  const player = await getPlayer(guildId, userId);
  if (!player) return null;
  if (birthdayPool) await birthdayPool.query('DELETE FROM gt_players WHERE guild_id=$1 AND discord_id=$2', [guildId, userId]);
  else {
    const store = loadJsonFile(PLAYERS_FILE, { nextId: 1, players: {} });
    delete store.players[userId];
    saveJsonFile(PLAYERS_FILE, store);
  }
  return player;
}

function buildPlayerCardEmbed(player, member = null) {
  const avatar = member?.displayAvatarURL?.({ size: 256 }) || null;
  const socials = [];
  if (validUrl(player.twitch)) socials.push(`[Twitch](${player.twitch})`);
  if (validUrl(player.tiktok)) socials.push(`[TikTok](${player.tiktok})`);
  if (validUrl(player.x)) socials.push(`[X](${player.x})`);
  if (validUrl(player.youtube)) socials.push(`[YouTube](${player.youtube})`);

  const embed = new EmbedBuilder()
    .setTitle(`${rosterEmoji(player.roster)} ${player.gtId} • ${player.ign}`)
    .setDescription(player.quote ? `“${player.quote}”` : 'GT Player Card')
    .addFields(
      { name: 'Roster', value: player.roster || 'Not set', inline: true },
      { name: 'Country', value: player.country || 'Not set', inline: true },
      { name: 'Mode', value: player.mode || 'Not set', inline: true },
      { name: 'Role', value: player.role || 'Not set', inline: true },
      { name: 'Earnings', value: player.earnings || 'Not set', inline: true },
      { name: 'Best Placement', value: player.placement || 'Not set', inline: false },
      { name: 'Socials', value: socials.length ? socials.join(' • ') : 'No socials added yet.', inline: false }
    )
    .setColor(0xff4fd8)
    .setFooter({ text: 'GT Player Directory' })
    .setTimestamp();
  if (validUrl(player.image)) embed.setImage(player.image);
  else if (avatar) embed.setThumbnail(avatar);
  return embed;
}

function buildPlayerButtons(player) {
  const buttons = [];
  const addButton = (label, emoji, url) => {
    if (!validUrl(url)) return;
    buttons.push(new ButtonBuilder().setLabel(label).setEmoji(emoji).setURL(url).setStyle(ButtonStyle.Link));
  };
  addButton('Twitch', '🎥', player.twitch);
  addButton('TikTok', '🎵', player.tiktok);
  addButton('X', '🐦', player.x);
  addButton('YouTube', '▶️', player.youtube);
  return buttons.length ? [new ActionRowBuilder().addComponents(buttons.slice(0, 5))] : [];
}

function getPlayerInput(interaction, requireCreate = false) {
  const get = name => cleanOptional(interaction.options.getString(name));
  const data = {};
  for (const field of ['ign', 'roster', 'country', 'mode', 'role', 'earnings', 'placement', 'twitch', 'tiktok', 'x', 'youtube', 'quote', 'image']) {
    const value = get(field);
    if (value || requireCreate) data[field] = value;
  }
  return data;
}

async function postOrUpdatePlayerCard(guild, userId) {
  const player = await getPlayer(guild.id, userId);
  if (!player) throw new Error('Player card not found.');
  const channel = await getPlayerDirectoryChannel(guild);
  if (!channel || !isUsableTextChannel(channel)) throw new Error('Player directory channel not found. Set PLAYER_DIRECTORY_CHANNEL_ID in Render or config.json.');
  const member = await guild.members.fetch(userId).catch(() => null);
  const payload = { embeds: [buildPlayerCardEmbed(player, member)], components: buildPlayerButtons(player) };
  let message = null;
  if (player.messageId) message = await channel.messages.fetch(player.messageId).catch(() => null);
  if (message) await message.edit(payload);
  else {
    message = await channel.send(payload);
    player.messageId = message.id;
    player.channelId = channel.id;
    await savePlayer(guild.id, userId, player);
  }
  return message;
}

async function handlePlayerCreate(interaction) {
  const user = interaction.options.getUser('user');
  const input = getPlayerInput(interaction, true);
  if (!input.ign) throw new Error('IGN is required.');
  if (!input.roster) throw new Error('Roster is required.');
  const existing = await getPlayer(interaction.guild.id, user.id);
  const player = {
    ...(existing || {}),
    discordId: user.id,
    gtId: existing?.gtId || await getNextGtId(interaction.guild.id),
    ign: input.ign,
    roster: input.roster,
    country: input.country || '',
    mode: input.mode || '',
    role: input.role || '',
    earnings: input.earnings || '',
    placement: input.placement || '',
    twitch: input.twitch || '',
    tiktok: input.tiktok || '',
    x: input.x || '',
    youtube: input.youtube || '',
    quote: input.quote || '',
    image: input.image || '',
    updatedBy: interaction.user.id,
    createdBy: existing?.createdBy || interaction.user.id
  };
  await savePlayer(interaction.guild.id, user.id, player);
  let location = '';
  try {
    const message = await postOrUpdatePlayerCard(interaction.guild, user.id);
    location = ` Posted in ${message.channel}.`;
  } catch (error) {
    location = ` Saved, but not posted yet: ${error.message}`;
  }
  await safeEdit(interaction, `Player card saved for **${player.ign}** (${player.gtId}).${location}`);
}

async function handlePlayerEdit(interaction) {
  const user = interaction.options.getUser('user');
  const input = getPlayerInput(interaction, false);
  const player = await getPlayer(interaction.guild.id, user.id);
  if (!player) throw new Error('No player card found for this user. Use /playercreate first.');
  for (const [key, value] of Object.entries(input)) if (value) player[key] = value;
  player.updatedBy = interaction.user.id;
  await savePlayer(interaction.guild.id, user.id, player);
  let location = '';
  try {
    const message = await postOrUpdatePlayerCard(interaction.guild, user.id);
    location = ` Updated in ${message.channel}.`;
  } catch (error) {
    location = ` Saved, but not posted: ${error.message}`;
  }
  await safeEdit(interaction, `Player card updated for **${player.ign}** (${player.gtId}).${location}`);
}

async function handlePlayerDelete(interaction) {
  const user = interaction.options.getUser('user');
  const player = await getPlayer(interaction.guild.id, user.id);
  if (!player) return safeEdit(interaction, 'No player card found for this user.');
  if (player.channelId && player.messageId) {
    const channel = await interaction.guild.channels.fetch(player.channelId).catch(() => null);
    const message = await channel?.messages?.fetch(player.messageId).catch(() => null);
    if (message) await message.delete().catch(() => null);
  }
  await deletePlayer(interaction.guild.id, user.id);
  await safeEdit(interaction, `Player card deleted for **${player.ign}** (${player.gtId}).`);
}

async function handlePlayerPost(interaction) {
  const user = interaction.options.getUser('user');
  if (user) {
    await postOrUpdatePlayerCard(interaction.guild, user.id);
    const player = await getPlayer(interaction.guild.id, user.id);
    return safeEdit(interaction, `Player card posted/updated for **${player.ign}**.`);
  }
  const players = await listPlayers(interaction.guild.id);
  if (!players.length) return safeEdit(interaction, 'No player cards saved yet.');
  let posted = 0;
  for (const player of players) {
    await postOrUpdatePlayerCard(interaction.guild, player.discordId);
    posted++;
  }
  await safeEdit(interaction, `Posted/updated **${posted}** player cards.`);
}

async function handlePlayerList(interaction) {
  const players = await listPlayers(interaction.guild.id);
  if (!players.length) return safeEdit(interaction, 'No player cards saved yet.');
  const lines = ['**GT Player Cards**', ...players.map(p => `• **${p.gtId}** — ${p.ign} | ${p.roster} | <@${p.discordId}>`)].join('\n');
  await sendLongReply(interaction, lines);
}

async function checkBirthdays() {
  const channelId = getBirthdayChannelId();
  if (!channelId) return;

  const birthdays = await getBirthdays();
  if (!birthdays.length) return;

  const now = new Date();

  for (const birthday of birthdays) {
    const timezone = birthday.timezone || 'Europe/Berlin';
    const reminderTime = birthday.reminderTime || '09:00';
    let parts;
    try { parts = getDatePartsInTimezone(now, timezone); }
    catch { continue; }

    const [year, month, day] = parts.dateKey.split('-').map(Number);
    if (day !== birthday.day || month !== birthday.month) continue;
    if (parts.time !== reminderTime) continue;
    if (birthday.lastSentYear === year) continue;

    try {
      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!isUsableTextChannel(channel)) continue;
      const age = ageTurningThisYear(birthday, year);
      const ageText = age ? `\nToday they turn **${age}**! 🥳` : '';
      await channel.send(`🎂 Happy Birthday <@${birthday.userId}>! 💜${ageText}\n\nGT wishes you an amazing day, lots of good vibes and many wins today 🥳`);
      await markBirthdaySent(birthday.guildId, birthday.userId, year);
    } catch (error) {
      console.error(`Failed to send birthday reminder for ${birthday.userId}:`, error.message);
    }
  }
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try { await initBirthdayDatabase(); }
  catch (error) { console.error('Birthday database init failed:', error.message); }
  try { await initTwitchWatchDatabase(); }
  catch (error) { console.error('Twitch watch database init failed:', error.message); }
  try { await initPlayerDatabase(); }
  catch (error) { console.error('Player database init failed:', error.message); }
  checkExpiredEventBans();
  setInterval(checkExpiredEventBans, 60 * 1000);
  checkAutoFortniteEvents();
  setInterval(checkAutoFortniteEvents, 60 * 1000);
  checkTwitchLiveNotifications();
  setInterval(checkTwitchLiveNotifications, Number(process.env.TWITCH_NOTIFY_INTERVAL_SECONDS || config.twitchLiveNotifications?.intervalSeconds || 60) * 1000);
  checkBirthdays();
  setInterval(checkBirthdays, 60 * 1000);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const deferred = await safeDefer(interaction);
  if (!deferred) return;

  try {
    switch (interaction.commandName) {
      case 'giverolefromchannel': await handleRoleFromChannel(interaction, 'give'); break;
      case 'takerolefromchannel': await handleRoleFromChannel(interaction, 'take'); break;
      case 'earningsroles': await handleEarningsRoles(interaction); break;
      case 'checksignup': await handleCheckSignup(interaction); break;
      case 'postcupcheck': await handlePostCupCheck(interaction); break;
      case 'voicechannelcreate': await handleVoiceCreate(interaction); break;
      case 'voicechanneldelete': await handleVoiceDelete(interaction); break;
      case 'voicechanneldeleteall': await handleVoiceDeleteAll(interaction); break;
      case 'eventbanadd': await handleEventBanAdd(interaction); break;
      case 'eventbanfromchannel': await handleEventBanFromChannel(interaction); break;
      case 'eventbanremove': await handleEventBanRemove(interaction); break;
      case 'eventbanlist': await handleEventBanList(interaction); break;
      case 'twitchwatchadd': await handleTwitchWatchAdd(interaction); break;
      case 'twitchwatchremove': await handleTwitchWatchRemove(interaction); break;
      case 'twitchwatchlist': await handleTwitchWatchList(interaction); break;
      case 'fortniteevents': await handleFortniteEvents(interaction, 'upcoming'); break;
      case 'fortniteeventstoday': await handleFortniteEvents(interaction, 'today'); break;
      case 'fortniteeventspost': await handleFortniteEventsPost(interaction); break;
      case 'fortniteeventsgrouped': await handleFortniteEventsGrouped(interaction); break;
      case 'birthdayset': await handleBirthdaySet(interaction); break;
      case 'birthdayremove': await handleBirthdayRemove(interaction); break;
      case 'birthdaynext': await handleBirthdayNext(interaction); break;
      case 'birthdaylist': await handleBirthdayList(interaction); break;
      case 'playercreate': await handlePlayerCreate(interaction); break;
      case 'playeredit': await handlePlayerEdit(interaction); break;
      case 'playerdelete': await handlePlayerDelete(interaction); break;
      case 'playerpost': await handlePlayerPost(interaction); break;
      case 'playerlist': await handlePlayerList(interaction); break;
      default: await safeEdit(interaction, 'Unknown command.'); break;
    }
  } catch (error) {
    console.error(error);
    await safeEdit(interaction, `Error: ${error.message}`);
  }
});

registerCommands()
  .then(() => client.login(TOKEN))
  .catch(error => {
    console.error('Startup failed:', error);
    process.exit(1);
  });
