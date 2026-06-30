require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

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
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const config = require('./config.json');

console.log('GT ROLE BOT V8.7.3 LOADED');

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
    .setDescription('Staff: create a GT Player Card v2.')
    .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(true))
    .addStringOption(o => o.setName('display_name').setDescription('Name shown on the card').setRequired(true))
    .addStringOption(o => o.setName('roster').setDescription('GT roster/design').setRequired(true).addChoices(
      { name: 'GT Member', value: 'GT Member' },
      { name: 'GT Queens', value: 'GT Queens' },
      { name: 'GT Comp Queens', value: 'GT Comp Queens' },
      { name: 'GT Rising Talents', value: 'GT Rising Talents' },
      { name: 'GT Ranked', value: 'GT Ranked' },
      { name: 'GT Content Creator', value: 'GT Content Creator' },
      { name: 'GT Academy Comp', value: 'GT Academy Comp' },
      { name: 'GT Pro Comp', value: 'GT Pro Comp' },
      { name: 'GT eSports', value: 'GT eSports' },
      { name: 'GT Moderator', value: 'GT Moderator' },
      { name: 'GT Admin', value: 'GT Admin' },
      { name: 'GT Executive Director', value: 'GT Executive Director' },
      { name: 'GT Co-owner', value: 'GT Co-owner' },
      { name: 'GT Owner', value: 'GT Owner' }
    ))
    .addStringOption(o => o.setName('gt_id').setDescription('Optional custom GT-ID, e.g. GT-001 or 1'))
    .addStringOption(o => o.setName('country').setDescription('Country code, e.g. DE, FR, NL'))
    .addStringOption(o => o.setName('region').setDescription('Region, e.g. EU, NAC, ME'))
    .addIntegerOption(o => o.setName('earnings').setDescription('Earnings as number, e.g. 12500').setMinValue(0))
    .addIntegerOption(o => o.setName('pr').setDescription('PR as number').setMinValue(0))
    .addStringOption(o => o.setName('twitch').setDescription('Twitch username or link'))
    .addStringOption(o => o.setName('tiktok').setDescription('TikTok username or link'))
    .addStringOption(o => o.setName('x').setDescription('X/Twitter username or link'))
    .addStringOption(o => o.setName('youtube').setDescription('YouTube channel/link'))
    .addStringOption(o => o.setName('fortnitetracker').setDescription('Fortnite Tracker profile/link'))
    .addStringOption(o => o.setName('about_me').setDescription('About me text, max 120 characters'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playeredit')
    .setDescription('Staff: edit a GT Player Card v2.')
    .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(true))
    .addStringOption(o => o.setName('display_name').setDescription('Name shown on the card'))
    .addStringOption(o => o.setName('roster').setDescription('GT roster/design').addChoices(
      { name: 'GT Member', value: 'GT Member' },
      { name: 'GT Queens', value: 'GT Queens' },
      { name: 'GT Comp Queens', value: 'GT Comp Queens' },
      { name: 'GT Rising Talents', value: 'GT Rising Talents' },
      { name: 'GT Ranked', value: 'GT Ranked' },
      { name: 'GT Content Creator', value: 'GT Content Creator' },
      { name: 'GT Academy Comp', value: 'GT Academy Comp' },
      { name: 'GT Pro Comp', value: 'GT Pro Comp' },
      { name: 'GT eSports', value: 'GT eSports' },
      { name: 'GT Moderator', value: 'GT Moderator' },
      { name: 'GT Admin', value: 'GT Admin' },
      { name: 'GT Executive Director', value: 'GT Executive Director' },
      { name: 'GT Co-owner', value: 'GT Co-owner' },
      { name: 'GT Owner', value: 'GT Owner' }
    ))
    .addStringOption(o => o.setName('gt_id').setDescription('Optional custom GT-ID, e.g. GT-001 or 1'))
    .addStringOption(o => o.setName('country').setDescription('Country code, e.g. DE, FR, NL'))
    .addStringOption(o => o.setName('region').setDescription('Region, e.g. EU, NAC, ME'))
    .addIntegerOption(o => o.setName('earnings').setDescription('Earnings as number').setMinValue(0))
    .addIntegerOption(o => o.setName('pr').setDescription('PR as number').setMinValue(0))
    .addStringOption(o => o.setName('twitch').setDescription('Twitch username or link'))
    .addStringOption(o => o.setName('tiktok').setDescription('TikTok username or link'))
    .addStringOption(o => o.setName('x').setDescription('X/Twitter username or link'))
    .addStringOption(o => o.setName('youtube').setDescription('YouTube channel/link'))
    .addStringOption(o => o.setName('fortnitetracker').setDescription('Fortnite Tracker profile/link'))
    .addStringOption(o => o.setName('about_me').setDescription('About me text, max 120 characters'))
    .addStringOption(o => o.setName('status').setDescription('active or inactive').addChoices({ name: 'active', value: 'active' }, { name: 'inactive', value: 'inactive' }))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playerrequest')
    .setDescription('Create or update your own GT Player Card request for staff review.')
    .addStringOption(o => o.setName('display_name').setDescription('Name shown on the card'))
    .addStringOption(o => o.setName('roster').setDescription('Your GT roster/design').addChoices(
      { name: 'GT Member', value: 'GT Member' },
      { name: 'GT Queens', value: 'GT Queens' },
      { name: 'GT Comp Queens', value: 'GT Comp Queens' },
      { name: 'GT Rising Talents', value: 'GT Rising Talents' },
      { name: 'GT Ranked', value: 'GT Ranked' },
      { name: 'GT Content Creator', value: 'GT Content Creator' },
      { name: 'GT Academy Comp', value: 'GT Academy Comp' },
      { name: 'GT Pro Comp', value: 'GT Pro Comp' },
      { name: 'GT eSports', value: 'GT eSports' },
      { name: 'GT Moderator', value: 'GT Moderator' },
      { name: 'GT Admin', value: 'GT Admin' },
      { name: 'GT Executive Director', value: 'GT Executive Director' },
      { name: 'GT Co-owner', value: 'GT Co-owner' },
      { name: 'GT Owner', value: 'GT Owner' }
    ))
    .addStringOption(o => o.setName('country').setDescription('Country code, e.g. DE, FR, NL'))
    .addStringOption(o => o.setName('region').setDescription('Region, e.g. EU, NAC, ME'))
    .addIntegerOption(o => o.setName('earnings').setDescription('Earnings as number, e.g. 12500').setMinValue(0))
    .addIntegerOption(o => o.setName('pr').setDescription('PR as number').setMinValue(0))
    .addStringOption(o => o.setName('twitch').setDescription('Twitch username or link'))
    .addStringOption(o => o.setName('tiktok').setDescription('TikTok username or link'))
    .addStringOption(o => o.setName('x').setDescription('X/Twitter username or link'))
    .addStringOption(o => o.setName('youtube').setDescription('YouTube channel/link'))
    .addStringOption(o => o.setName('fortnitetracker').setDescription('Fortnite Tracker profile/link'))
    .addStringOption(o => o.setName('about_me').setDescription('About me text, max 120 characters')),

  new SlashCommandBuilder()
    .setName('playerpending')
    .setDescription('Staff: list pending GT Player Card requests.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playerdelete')
    .setDescription('Staff: deactivate a GT Player Card. GT-ID stays reserved.')
    .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playercard')
    .setDescription('Preview a GT Player Card v2.')
    .addUserOption(o => o.setName('user').setDescription('User to show. Empty = yourself')),

  new SlashCommandBuilder()
    .setName('playerpost')
    .setDescription('Staff: post a GT Player Card v2 into the player directory.')
    .addUserOption(o => o.setName('user').setDescription('Player').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Optional channel. Empty = PLAYER_DIRECTORY_CHANNEL_ID').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('playerlist')
    .setDescription('Staff: list saved GT Player Cards.')
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
    const message = error?.rawError?.message || error?.message || '';
    const hasComponents = Array.isArray(payload?.components) && payload.components.length > 0;
    if (hasComponents && /Invalid Form Body/i.test(message)) {
      console.warn('Discord rejected button components. Retrying response without buttons.');
      const fallback = { ...payload, components: [] };
      try {
        if (interaction.deferred || interaction.replied) return await interaction.editReply(fallback);
        return await interaction.reply({ ...fallback, flags: MessageFlags.Ephemeral });
      } catch (retryError) {
        console.error('Failed to respond with payload fallback:', retryError);
      }
    } else {
      console.error('Failed to respond with payload:', error);
    }
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
const BIRTHDAY_ROLES_FILE = path.join(__dirname, 'birthdayRoles.json');

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

  await birthdayPool.query(`
    CREATE TABLE IF NOT EXISTS gt_birthday_role_assignments (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role_id TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id, role_id)
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

function loadBirthdayRoleStore() {
  try {
    if (!fs.existsSync(BIRTHDAY_ROLES_FILE)) return { assignments: [] };
    const parsed = JSON.parse(fs.readFileSync(BIRTHDAY_ROLES_FILE, 'utf8'));
    return { assignments: Array.isArray(parsed.assignments) ? parsed.assignments : [] };
  } catch (error) {
    console.error('Could not load birthdayRoles.json:', error.message);
    return { assignments: [] };
  }
}

function saveBirthdayRoleStore(store) {
  fs.writeFileSync(BIRTHDAY_ROLES_FILE, JSON.stringify(store, null, 2));
}

function rowToBirthdayRoleAssignment(row) {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    roleId: row.role_id,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  };
}

async function getBirthdayRoleAssignments() {
  if (birthdayPool) {
    const result = await birthdayPool.query('SELECT * FROM gt_birthday_role_assignments');
    return result.rows.map(rowToBirthdayRoleAssignment);
  }
  return loadBirthdayRoleStore().assignments;
}

async function upsertBirthdayRoleAssignment(guildId, userId, roleId, expiresAt) {
  const expiresIso = new Date(expiresAt).toISOString();
  if (birthdayPool) {
    await birthdayPool.query(
      `INSERT INTO gt_birthday_role_assignments (guild_id, user_id, role_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (guild_id, user_id, role_id)
       DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [guildId, userId, roleId, expiresIso]
    );
    return;
  }
  const store = loadBirthdayRoleStore();
  const existing = store.assignments.find(a => a.guildId === guildId && a.userId === userId && a.roleId === roleId);
  if (existing) existing.expiresAt = expiresIso;
  else store.assignments.push({ guildId, userId, roleId, expiresAt: expiresIso, createdAt: new Date().toISOString() });
  saveBirthdayRoleStore(store);
}

async function removeBirthdayRoleAssignment(guildId, userId, roleId) {
  if (birthdayPool) {
    await birthdayPool.query('DELETE FROM gt_birthday_role_assignments WHERE guild_id = $1 AND user_id = $2 AND role_id = $3', [guildId, userId, roleId]);
    return;
  }
  const store = loadBirthdayRoleStore();
  store.assignments = store.assignments.filter(a => !(a.guildId === guildId && a.userId === userId && a.roleId === roleId));
  saveBirthdayRoleStore(store);
}

function getBirthdayRoleId() {
  return process.env.BIRTHDAY_ROLE_ID || config.birthdayRoleId || '';
}

function isBirthdayCardEnabled() {
  const raw = process.env.BIRTHDAY_CARD_ENABLED ?? config.birthdayCardEnabled ?? true;
  return String(raw).toLowerCase() !== 'false';
}

async function giveBirthdayRole(guild, userId) {
  const roleId = getBirthdayRoleId();
  if (!roleId || !guild) return null;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return null;
  await member.roles.add(roleId);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await upsertBirthdayRoleAssignment(guild.id, userId, roleId, expiresAt);
  return expiresAt;
}

async function checkExpiredBirthdayRoles() {
  const assignments = await getBirthdayRoleAssignments().catch(error => {
    console.error('Could not load birthday role assignments:', error.message);
    return [];
  });
  if (!assignments.length) return;

  const now = Date.now();
  for (const assignment of assignments) {
    const expires = assignment.expiresAt ? new Date(assignment.expiresAt).getTime() : 0;
    if (!expires || expires > now) continue;
    try {
      const guild = await client.guilds.fetch(assignment.guildId).catch(() => null);
      const member = guild ? await guild.members.fetch(assignment.userId).catch(() => null) : null;
      if (member) await member.roles.remove(assignment.roleId).catch(() => {});
      await removeBirthdayRoleAssignment(assignment.guildId, assignment.userId, assignment.roleId);
      console.log(`Birthday role expired and removed for ${assignment.userId}`);
    } catch (error) {
      console.error(`Failed to remove expired birthday role for ${assignment.userId}:`, error.message);
    }
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


const PLAYER_CARDS_FILE = path.join(__dirname, 'playerCards.json');
const PLAYER_CARD_BG_PATH = path.join(__dirname, 'assets', 'cards', 'backgrounds', 'player-card-bg.png');

const ROSTER_STYLES = {
  'GT Member': { primary: '#8B5CF6', secondary: '#22D3EE', label: 'GT MEMBER' },
  'GT Queens': { primary: '#F472B6', secondary: '#A855F7', label: 'GT QUEENS' },
  'GT Comp Queens': { primary: '#EC4899', secondary: '#FFFFFF', label: 'GT COMP QUEENS' },
  'GT Rising Talents': { primary: '#2DD4BF', secondary: '#EF4444', label: 'GT RISING TALENTS' },
  'GT Ranked': { primary: '#D8A0A6', secondary: '#8B5CF6', label: 'GT RANKED' },
  'GT Content Creator': { primary: '#A855F7', secondary: '#FFFFFF', label: 'GT CONTENT CREATOR' },
  'GT Academy Comp': { primary: '#EF4444', secondary: '#FACC15', label: 'GT ACADEMY COMP' },
  'GT Pro Comp': { primary: '#8B5CF6', secondary: '#FB923C', label: 'GT PRO COMP' },
  'GT eSports': { primary: '#FACC15', secondary: '#14532D', label: 'GT ESPORTS' },
  'GT Moderator': { primary: '#EF4444', secondary: '#EC4899', label: 'GT MODERATOR' },
  'GT Admin': { primary: '#FB923C', secondary: '#FDBA74', label: 'GT ADMIN' },
  'GT Executive Director': { primary: '#EC4899', secondary: '#22D3EE', label: 'GT EXECUTIVE DIRECTOR' },
  'GT Co-owner': { primary: '#FDA4AF', secondary: '#F472B6', label: 'GT CO-OWNER' },
  'GT Coowner': { primary: '#FDA4AF', secondary: '#F472B6', label: 'GT CO-OWNER' },
  'GT Owner': { primary: '#DC2626', secondary: '#FFFFFF', label: 'GT OWNER' }
};

function getRosterStyle(roster) {
  return ROSTER_STYLES[roster] || ROSTER_STYLES['GT Member'];
}

async function initPlayerCardDatabase() {
  if (!birthdayPool) {
    console.log('Player card storage: playerCards.json local file mode.');
    return;
  }

  await birthdayPool.query(`
    CREATE TABLE IF NOT EXISTS gt_player_cards (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      gt_id_number INTEGER,
      gt_id TEXT,
      discord_username TEXT,
      display_name TEXT,
      roster TEXT,
      country_code TEXT,
      region TEXT,
      earnings INTEGER DEFAULT 0,
      pr INTEGER DEFAULT 0,
      twitch TEXT,
      tiktok TEXT,
      youtube TEXT,
      x TEXT,
      fortnitetracker TEXT,
      tagline TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    );
  `);

  const alters = [
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS gt_id_number INTEGER`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS gt_id TEXT`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS discord_username TEXT`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS country_code TEXT`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS earnings INTEGER DEFAULT 0`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS pr INTEGER DEFAULT 0`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS fortnitetracker TEXT`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS tagline TEXT`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE gt_player_cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`
  ];
  for (const q of alters) await birthdayPool.query(q).catch(() => {});

  console.log('Player card storage: PostgreSQL database connected.');
}

function loadPlayerCardStore() {
  try {
    if (!fs.existsSync(PLAYER_CARDS_FILE)) return { cards: [] };
    const parsed = JSON.parse(fs.readFileSync(PLAYER_CARDS_FILE, 'utf8'));
    return { cards: Array.isArray(parsed.cards) ? parsed.cards : [] };
  } catch (error) {
    console.error('Could not load playerCards.json:', error.message);
    return { cards: [] };
  }
}

function savePlayerCardStore(store) {
  fs.writeFileSync(PLAYER_CARDS_FILE, JSON.stringify(store, null, 2));
}

function formatGtId(number) {
  return `GT-${String(number).padStart(3, '0')}`;
}

function normalizeGtIdInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(?:GT[-\s]?)?(\d{1,6})$/i);
  if (!match) {
    throw new Error('GT-ID must look like GT-001 or 1.');
  }
  const number = Number(match[1]);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error('GT-ID number must be 1 or higher.');
  }
  return { gtIdNumber: number, gtId: formatGtId(number) };
}

async function gtIdExists(guildId, gtIdNumber, excludeUserId = null) {
  if (!gtIdNumber) return false;
  if (birthdayPool) {
    const params = [guildId, gtIdNumber];
    let query = 'SELECT user_id FROM gt_player_cards WHERE guild_id = $1 AND gt_id_number = $2';
    if (excludeUserId) {
      params.push(excludeUserId);
      query += ' AND user_id <> $3';
    }
    const result = await birthdayPool.query(query, params);
    return result.rows.length > 0;
  }
  const store = loadPlayerCardStore();
  return store.cards.some(c => c.guildId === guildId && Number(c.gtIdNumber || 0) === Number(gtIdNumber) && (!excludeUserId || c.userId !== excludeUserId));
}

async function nextGtIdNumber(guildId) {
  if (birthdayPool) {
    const result = await birthdayPool.query('SELECT COALESCE(MAX(gt_id_number), 0) + 1 AS next FROM gt_player_cards WHERE guild_id = $1', [guildId]);
    return Number(result.rows[0]?.next || 1);
  }
  const store = loadPlayerCardStore();
  const max = store.cards.filter(c => c.guildId === guildId).reduce((m, c) => Math.max(m, Number(c.gtIdNumber || 0)), 0);
  return max + 1;
}

function rowToPlayerCard(row) {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    gtIdNumber: row.gt_id_number || null,
    gtId: row.gt_id || (row.gt_id_number ? formatGtId(row.gt_id_number) : ''),
    discordUsername: row.discord_username || '',
    displayName: row.display_name || '',
    roster: row.roster || 'GT Member',
    countryCode: row.country_code || '',
    region: row.region || '',
    earnings: Number(row.earnings || 0),
    pr: Number(row.pr || 0),
    twitch: row.twitch || '',
    tiktok: row.tiktok || '',
    youtube: row.youtube || '',
    x: row.x || '',
    fortnitetracker: row.fortnitetracker || '',
    tagline: row.tagline || '',
    status: row.status || 'active',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

function cleanOptionalText(value, max = 100) {
  const text = String(value || '').trim();
  return text.length > max ? text.slice(0, max) : text;
}

function cleanSocial(value) {
  return cleanOptionalText(value, 180).replace(/^@/, '');
}

function buildSocialUrl(type, value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  const handle = raw.replace(/^@/, '');
  if (type === 'twitch') return `https://twitch.tv/${handle.replace(/^.*twitch\.tv\//i, '')}`;
  if (type === 'tiktok') return `https://tiktok.com/@${handle.replace(/^.*@/, '')}`;
  if (type === 'youtube') return /^@/.test(raw) ? `https://youtube.com/${raw}` : `https://youtube.com/${handle}`;
  if (type === 'x') return `https://x.com/${handle}`;
  if (type === 'fortnitetracker') {
    const cleaned = handle.replace(/^.*fortnitetracker\.com\/profile\/all\//i, '').replace(/^.*fortnitetracker\.com\/profile\/[^/]+\//i, '');
    return /^https?:\/\//i.test(raw) ? raw : `https://fortnitetracker.com/profile/all/${encodeURIComponent(cleaned)}`;
  }
  return raw;
}

function socialHandle(value) {
  if (!value) return '';
  return String(value)
    .replace(/^https?:\/\/(www\.)?/i, '')
    .replace(/^twitch\.tv\//i, '')
    .replace(/^tiktok\.com\/@?/i, '')
    .replace(/^x\.com\//i, '')
    .replace(/^twitter\.com\//i, '')
    .replace(/^youtube\.com\/@?/i, '')
    .replace(/^fortnitetracker\.com\/profile\/all\//i, '')
    .replace(/^fortnitetracker\.com\/profile\/[^/]+\//i, '')
    .replace(/\/$/, '')
    .replace(/^@/, '');
}

function countryFlag(code) {
  const cc = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '';
  return cc.split('').map(ch => String.fromCodePoint(127397 + ch.charCodeAt(0))).join('');
}

function formatMoney(value) {
  const n = Number(value || 0);
  if (!n) return '$0';
  return `$${n.toLocaleString('en-US')}`;
}

async function getPlayerCards(guildId = null, includeInactive = true) {
  if (birthdayPool) {
    let result;
    if (guildId) {
      result = await birthdayPool.query('SELECT * FROM gt_player_cards WHERE guild_id = $1 ORDER BY gt_id_number NULLS LAST, display_name NULLS LAST', [guildId]);
    } else {
      result = await birthdayPool.query('SELECT * FROM gt_player_cards ORDER BY guild_id, gt_id_number NULLS LAST, display_name NULLS LAST');
    }
    const cards = result.rows.map(rowToPlayerCard);
    return includeInactive ? cards : cards.filter(c => c.status !== 'inactive');
  }

  const store = loadPlayerCardStore();
  const cards = guildId ? store.cards.filter(c => c.guildId === guildId) : store.cards;
  return includeInactive ? cards : cards.filter(c => c.status !== 'inactive');
}

async function getPlayerCard(guildId, userId) {
  if (birthdayPool) {
    const result = await birthdayPool.query('SELECT * FROM gt_player_cards WHERE guild_id = $1 AND user_id = $2', [guildId, userId]);
    return result.rows[0] ? rowToPlayerCard(result.rows[0]) : null;
  }

  const store = loadPlayerCardStore();
  return store.cards.find(c => c.guildId === guildId && c.userId === userId) || null;
}

async function upsertPlayerCard(record, mode = 'create') {
  let existing = await getPlayerCard(record.guildId, record.userId);
  let gtIdNumber = record.gtIdNumber || existing?.gtIdNumber || null;
  let gtId = record.gtId || existing?.gtId || '';
  if (!gtIdNumber) {
    gtIdNumber = await nextGtIdNumber(record.guildId);
    gtId = formatGtId(gtIdNumber);
  }
  if (!gtId) gtId = formatGtId(gtIdNumber);

  const merged = {
    ...existing,
    ...record,
    gtIdNumber,
    gtId,
    status: record.status || existing?.status || 'active'
  };

  if (birthdayPool) {
    await birthdayPool.query(
      `INSERT INTO gt_player_cards (guild_id, user_id, gt_id_number, gt_id, discord_username, display_name, roster, country_code, region, earnings, pr, twitch, tiktok, youtube, x, fortnitetracker, tagline, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW(),NOW())
       ON CONFLICT (guild_id, user_id)
       DO UPDATE SET
         gt_id_number = COALESCE(EXCLUDED.gt_id_number, gt_player_cards.gt_id_number),
         gt_id = COALESCE(NULLIF(EXCLUDED.gt_id, ''), gt_player_cards.gt_id),
         discord_username = COALESCE(NULLIF(EXCLUDED.discord_username, ''), gt_player_cards.discord_username),
         display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), gt_player_cards.display_name),
         roster = COALESCE(NULLIF(EXCLUDED.roster, ''), gt_player_cards.roster),
         country_code = COALESCE(NULLIF(EXCLUDED.country_code, ''), gt_player_cards.country_code),
         region = COALESCE(NULLIF(EXCLUDED.region, ''), gt_player_cards.region),
         earnings = COALESCE(EXCLUDED.earnings, gt_player_cards.earnings),
         pr = COALESCE(EXCLUDED.pr, gt_player_cards.pr),
         twitch = COALESCE(NULLIF(EXCLUDED.twitch, ''), gt_player_cards.twitch),
         tiktok = COALESCE(NULLIF(EXCLUDED.tiktok, ''), gt_player_cards.tiktok),
         youtube = COALESCE(NULLIF(EXCLUDED.youtube, ''), gt_player_cards.youtube),
         x = COALESCE(NULLIF(EXCLUDED.x, ''), gt_player_cards.x),
         fortnitetracker = COALESCE(NULLIF(EXCLUDED.fortnitetracker, ''), gt_player_cards.fortnitetracker),
         tagline = COALESCE(NULLIF(EXCLUDED.tagline, ''), gt_player_cards.tagline),
         status = COALESCE(NULLIF(EXCLUDED.status, ''), gt_player_cards.status),
         updated_at = NOW()`,
      [merged.guildId, merged.userId, gtIdNumber, gtId, merged.discordUsername || '', merged.displayName || '', merged.roster || 'GT Member', merged.countryCode || '', merged.region || '', Number.isInteger(merged.earnings) ? merged.earnings : Number(merged.earnings || 0), Number.isInteger(merged.pr) ? merged.pr : Number(merged.pr || 0), merged.twitch || '', merged.tiktok || '', merged.youtube || '', merged.x || '', merged.fortnitetracker || '', merged.tagline || '', merged.status || 'active']
    );
    return getPlayerCard(record.guildId, record.userId);
  }

  const store = loadPlayerCardStore();
  const idx = store.cards.findIndex(c => c.guildId === record.guildId && c.userId === record.userId);
  const cleaned = { ...merged, updatedAt: new Date().toISOString(), createdAt: existing?.createdAt || new Date().toISOString() };
  if (idx >= 0) store.cards[idx] = cleaned;
  else store.cards.push(cleaned);
  savePlayerCardStore(store);
  return cleaned;
}

async function deactivatePlayerCard(guildId, userId) {
  const card = await getPlayerCard(guildId, userId);
  if (!card) return null;
  await upsertPlayerCard({ guildId, userId, status: 'inactive' }, 'edit');
  return card;
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const roundRect = roundedRect;

function drawPanel(ctx, x, y, w, h, style, alpha = 0.50) {
  ctx.save();
  roundedRect(ctx, x, y, w, h, 24);
  ctx.fillStyle = `rgba(8, 10, 24, ${alpha})`;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = style.primary;
  ctx.shadowColor = style.secondary;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.restore();
}

function drawFittedText(ctx, text, x, y, maxWidth, size, family = 'Arial Black') {
  let fontSize = size;
  do {
    ctx.font = `900 ${fontSize}px ${family}, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    fontSize -= 2;
  } while (fontSize > 24);
  ctx.fillText(text, x, y);
}

function drawCenteredFittedText(ctx, text, centerX, y, maxWidth, size, weight = 900, family = 'Arial Black') {
  const value = String(text || '').trim();
  let fontSize = size;
  do {
    ctx.font = `${weight} ${fontSize}px ${family}, Arial, sans-serif`;
    if (ctx.measureText(value).width <= maxWidth) break;
    fontSize -= 1;
  } while (fontSize > 13);
  ctx.textAlign = 'center';
  ctx.fillText(value, centerX, y);
}

function splitTextToFit(ctx, text, maxWidth, font) {
  ctx.font = font;
  const parts = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const part of parts) {
    const test = current ? `${current} ${part}` : part;
    if (ctx.measureText(test).width <= maxWidth || !current) current = test;
    else { lines.push(current); current = part; }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRosterLabel(ctx, label, centerX, y, maxWidth, style) {
  const text = String(label || 'GT MEMBER').toUpperCase();
  ctx.fillStyle = style.secondary;
  let fontSize = 32;
  let lines = [];
  do {
    lines = splitTextToFit(ctx, text, maxWidth, `900 ${fontSize}px Arial Black, Arial, sans-serif`).slice(0, 3);
    const widest = Math.max(...lines.map(line => ctx.measureText(line).width), 0);
    if (widest <= maxWidth && lines.length <= 3) break;
    fontSize -= 1;
  } while (fontSize > 18);
  const lineHeight = Math.max(26, fontSize + 5);
  const totalHeight = (lines.length - 1) * lineHeight;
  const startY = y - totalHeight / 2;
  lines.forEach((line, index) => drawCenteredFittedText(ctx, line, centerX, startY + index * lineHeight, maxWidth, fontSize, 900, 'Arial Black'));
}

async function loadFlagImage(countryCode) {
  const cc = String(countryCode || '').trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(cc)) return null;
  try {
    const res = await fetch(`https://flagcdn.com/w80/${cc}.png`, {
      headers: { 'User-Agent': 'GT-Role-Bot/8.6' }
    });
    if (!res.ok) return null;
    return loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

async function drawCountryRegion(ctx, card, x, y, maxWidth, style) {
  const country = String(card.countryCode || '').trim().toUpperCase();
  const region = String(card.region || '').trim().toUpperCase();
  ctx.textAlign = 'left';
  let regionX = x;

  if (country) {
    const flag = await loadFlagImage(country);
    ctx.save();
    roundedRect(ctx, x, y - 37, 66, 44, 10);
    ctx.fillStyle = `rgba(255,255,255,0.10)`;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.secondary;
    ctx.stroke();
    if (flag) {
      ctx.save();
      roundedRect(ctx, x + 8, y - 29, 50, 30, 6);
      ctx.clip();
      ctx.drawImage(flag, x + 8, y - 29, 50, 30);
      ctx.restore();
    } else {
      const emoji = countryFlag(country);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '28px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", Arial, sans-serif';
      ctx.fillText(emoji || country, x + 10, y - 4);
    }
    ctx.restore();
    regionX = x + 84;
  }

  ctx.fillStyle = '#E5E7EB';
  ctx.font = '700 30px Arial, sans-serif';
  if (region) ctx.fillText(region, regionX, y - 2);
  if (!country && !region) ctx.fillText('GT ESPORTS', x, y - 2);
}

function drawSocialGrid(ctx, socials, x, y, w, style) {
  if (!socials.length) return;
  const gap = 24;
  const colW = Math.floor((w - gap) / 2);
  const rowH = 34;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < socials.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const tx = x + col * (colW + gap);
    const ty = y + row * rowH;
    drawFittedText(ctx, socials[i], tx, ty, colW, 23, 'Arial');
  }
}

async function loadImageFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  return loadImage(Buffer.from(await res.arrayBuffer()));
}

async function renderPlayerCardImage(guild, card) {
  const width = 1200;
  const height = 675;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const style = getRosterStyle(card.roster);

  if (fs.existsSync(PLAYER_CARD_BG_PATH)) {
    const bg = await loadImage(PLAYER_CARD_BG_PATH);
    ctx.drawImage(bg, 0, 0, width, height);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#090014');
    gradient.addColorStop(0.5, '#111827');
    gradient.addColorStop(1, '#200020');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // soft roster glow
  const glow = ctx.createRadialGradient(230, 240, 20, 230, 240, 330);
  glow.addColorStop(0, `${style.primary}88`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const hasEarnings = Number(card.earnings || 0) > 0;
  const hasPr = Number(card.pr || 0) > 0;
  const socials = [
    card.twitch ? `Twitch: ${socialHandle(card.twitch)}` : '',
    card.tiktok ? `TikTok: ${socialHandle(card.tiktok)}` : '',
    card.x ? `X: ${socialHandle(card.x)}` : '',
    card.youtube ? `YouTube: ${socialHandle(card.youtube)}` : ''
  ].filter(Boolean);

  drawPanel(ctx, 68, 80, 325, 450, style, 0.42);
  drawPanel(ctx, 430, 85, 685, 185, style, 0.42);

  const rightPanelBottom = 530; // aligns with the avatar/profile panel bottom
  const statY = 292;
  const statH = 118; // flatter stat boxes so they do not collide with socials
  if (hasEarnings && hasPr) {
    drawPanel(ctx, 430, statY, 325, statH, style, 0.42);
    drawPanel(ctx, 790, statY, 325, statH, style, 0.42);
  } else if (hasEarnings || hasPr) {
    drawPanel(ctx, 430, statY, 685, statH, style, 0.42);
  }

  // Keep socials away from stats and the integrated footer/logo area.
  // The social panel bottom aligns with the avatar/profile panel bottom.
  let socialY;
  let socialH;
  if (socials.length) {
    if (hasEarnings || hasPr) {
      socialH = socials.length > 2 ? 92 : 72;
      socialY = rightPanelBottom - socialH;
    } else {
      socialY = 300;
      socialH = rightPanelBottom - socialY;
    }
    drawPanel(ctx, 430, socialY, 685, socialH, style, 0.38);
  }

  const member = await guild.members.fetch(card.userId).catch(() => null);
  const user = member?.user || await client.users.fetch(card.userId).catch(() => null);
  const avatarUrl = user?.displayAvatarURL?.({ extension: 'png', size: 512 }) || null;

  if (avatarUrl) {
    try {
      const avatar = await loadImageFromUrl(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(230, 225, 118, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 112, 107, 236, 236);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.arc(230, 225, 123, 0, Math.PI * 2);
      ctx.lineWidth = 8;
      ctx.strokeStyle = style.primary;
      ctx.shadowColor = style.secondary;
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.restore();
    } catch (error) {
      console.warn('Avatar render failed:', error.message);
    }
  }

  // avatar panel text: roster is the main label, GT-ID is smaller below it.
  ctx.textAlign = 'center';
  ctx.fillStyle = style.secondary;
  drawRosterLabel(ctx, style.label, 230, 390, 285, style);
  ctx.fillStyle = '#FFFFFF';
  drawCenteredFittedText(ctx, card.gtId || 'GT-???', 230, 468, 245, 21, 900, 'Arial Black');

  // main info
  const name = (card.displayName || member?.displayName || user?.username || 'GT PLAYER').toUpperCase();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  drawFittedText(ctx, name, 465, 155, 610, 56);
  await drawCountryRegion(ctx, card, 468, 205, 610, style);
  if (card.tagline) {
    ctx.font = '600 24px Arial, sans-serif';
    ctx.fillStyle = '#D1D5DB';
    const aboutMe = String(card.tagline).trim();
    drawFittedText(ctx, aboutMe, 468, 240, 610, 24, 'Arial');
  }

  // stats only when available
  ctx.textAlign = 'center';
  if (hasEarnings && hasPr) {
    ctx.fillStyle = style.secondary;
    ctx.font = '800 25px Arial, sans-serif';
    ctx.fillText('EARNINGS', 592, 332);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 39px Arial Black, Arial, sans-serif';
    ctx.fillText(formatMoney(card.earnings), 592, 386);

    ctx.fillStyle = style.secondary;
    ctx.font = '800 25px Arial, sans-serif';
    ctx.fillText('PR', 952, 332);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 42px Arial Black, Arial, sans-serif';
    ctx.fillText(Number(card.pr || 0).toLocaleString('en-US'), 952, 386);
  } else if (hasEarnings || hasPr) {
    ctx.fillStyle = style.secondary;
    ctx.font = '800 25px Arial, sans-serif';
    ctx.fillText(hasEarnings ? 'EARNINGS' : 'PR', 772, 332);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 42px Arial Black, Arial, sans-serif';
    ctx.fillText(hasEarnings ? formatMoney(card.earnings) : Number(card.pr || 0).toLocaleString('en-US'), 772, 386);
  }

  // socials on card, fitted into a two-column grid so they never run past the panel edge.
  if (socials.length) {
    const gridY = (hasEarnings || hasPr) ? socialY + 32 : socialY + 42;
    drawSocialGrid(ctx, socials, 468, gridY, 610, style);
  }

  return canvas.toBuffer('image/png');
}

async function renderBirthdayPlayerCardImage(guild, card, birthday, year) {
  const basePng = await renderPlayerCardImage(guild, card);
  const baseImage = await loadImage(basePng);
  const width = 1200;
  const height = 675;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const style = getRosterStyle(card.roster);

  ctx.drawImage(baseImage, 0, 0, width, height);

  const banner = ctx.createLinearGradient(390, 0, 1120, 0);
  banner.addColorStop(0, `${style.primary}ee`);
  banner.addColorStop(1, `${style.secondary}dd`);
  roundRect(ctx, 415, 520, 720, 82, 26);
  ctx.fillStyle = banner;
  ctx.shadowColor = style.secondary;
  ctx.shadowBlur = 22;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 34px Arial Black, Arial, sans-serif';
  ctx.fillText('HAPPY BIRTHDAY', 775, 555);

  const age = ageTurningThisYear(birthday, year);
  ctx.font = '800 22px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(age ? `GT celebrates you today · turning ${age}` : 'GT celebrates you today', 775, 586);

  // small birthday sparkle dots in roster colors
  ctx.save();
  for (const dot of [
    [75, 78, 8, style.secondary], [1110, 94, 7, style.primary], [1022, 518, 6, style.secondary],
    [88, 548, 7, style.primary], [1140, 330, 5, '#FFFFFF'], [385, 560, 5, '#FFFFFF']
  ]) {
    ctx.beginPath();
    ctx.fillStyle = dot[3];
    ctx.arc(dot[0], dot[1], dot[2], 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return canvas.toBuffer('image/png');
}

async function buildBirthdayCardPayload(guild, card, birthday, year) {
  const png = await renderBirthdayPlayerCardImage(guild, card, birthday, year);
  const filename = `${card.gtId || 'GT-CARD'}-${(card.displayName || 'birthday').replace(/[^a-z0-9_-]/gi, '_')}-birthday.png`;
  const file = new AttachmentBuilder(png, { name: filename });
  const age = ageTurningThisYear(birthday, year);
  const ageText = age ? `
Today they turn **${age}**! 🥳` : '';
  return {
    content: `🎂 **Happy Birthday <@${birthday.userId}>!** 💜${ageText}
GT wishes you an amazing day, lots of good vibes and many wins today 🥳`,
    files: [file],
    components: buildSocialButtons(card)
  };
}

async function sendBirthdayGreeting(channel, birthday, year) {
  const age = ageTurningThisYear(birthday, year);
  const ageText = age ? `
Today they turn **${age}**! 🥳` : '';
  const baseMessage = `🎂 **Happy Birthday <@${birthday.userId}>!** 💜${ageText}

GT wishes you an amazing day, lots of good vibes and many wins today 🥳`;

  if (isBirthdayCardEnabled()) {
    const guild = channel.guild || await client.guilds.fetch(birthday.guildId).catch(() => null);
    const card = guild ? await getPlayerCard(birthday.guildId, birthday.userId).catch(() => null) : null;
    if (guild && card && card.status !== 'inactive') {
      try {
        const payload = await buildBirthdayCardPayload(guild, card, birthday, year);
        await channel.send(payload);
        return;
      } catch (error) {
        console.error(`Birthday card render failed for ${birthday.userId}:`, error.message);
      }
    }
  }

  await channel.send(baseMessage);
}

function isValidButtonUrl(url) {
  try {
    const parsed = new URL(String(url || ''));
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

function buildSocialButtons(card) {
  const buttons = [];
  const items = [
    ['Twitch', 'twitch', card.twitch],
    ['TikTok', 'tiktok', card.tiktok],
    ['X', 'x', card.x],
    ['YouTube', 'youtube', card.youtube],
    ['Fortnite Tracker', 'fortnitetracker', card.fortnitetracker]
  ];
  for (const [label, type, value] of items) {
    const url = buildSocialUrl(type, value);
    if (!url) continue;
    if (!isValidButtonUrl(url)) {
      console.warn(`Skipping invalid ${label} button URL: ${url}`);
      continue;
    }
    buttons.push(new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url));
  }
  if (!buttons.length) return [];
  const rows = [];
  for (let i = 0; i < buttons.length; i += 4) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 4)));
  return rows;
}

async function buildPlayerCardPayload(guild, card) {
  const png = await renderPlayerCardImage(guild, card);
  const filename = `${card.gtId || 'GT-CARD'}-${(card.displayName || 'player').replace(/[^a-z0-9_-]/gi, '_')}.png`;
  const file = new AttachmentBuilder(png, { name: filename });
  const content = `**${card.gtId || 'GT-???'} · ${card.displayName || 'GT Player'}**\n${getRosterStyle(card.roster).label}${card.status && card.status !== 'active' ? ` · ${card.status}` : ''}`;
  return { content, files: [file], components: buildSocialButtons(card) };
}

function optionWasProvided(interaction, name) {
  return interaction.options.data.some(opt => opt.name === name);
}

function addStringField(record, interaction, fieldName, optionName, maxLength, transform = v => v) {
  if (!optionWasProvided(interaction, optionName)) return;
  const raw = interaction.options.getString(optionName);
  const cleaned = cleanOptionalText(raw, maxLength);
  record[fieldName] = transform(cleaned);
}

function addSocialField(record, interaction, fieldName, optionName) {
  if (!optionWasProvided(interaction, optionName)) return;
  record[fieldName] = cleanSocial(interaction.options.getString(optionName));
}

function makePlayerRecordFromInteraction(interaction, user, mode) {
  const record = {
    guildId: interaction.guildId,
    userId: user.id,
    discordUsername: user.username || ''
  };

  addStringField(record, interaction, 'displayName', 'display_name', 80);
  addStringField(record, interaction, 'roster', 'roster', 80);
  addStringField(record, interaction, 'countryCode', 'country', 2, v => v.toUpperCase());
  addStringField(record, interaction, 'region', 'region', 30, v => v.toUpperCase());
  addSocialField(record, interaction, 'twitch', 'twitch');
  addSocialField(record, interaction, 'tiktok', 'tiktok');
  addSocialField(record, interaction, 'youtube', 'youtube');
  addSocialField(record, interaction, 'x', 'x');
  addSocialField(record, interaction, 'fortnitetracker', 'fortnitetracker');
  addStringField(record, interaction, 'tagline', 'about_me', 120);
  addStringField(record, interaction, 'status', 'status', 20);

  if (optionWasProvided(interaction, 'earnings')) {
    const earnings = interaction.options.getInteger('earnings');
    record.earnings = earnings === null ? undefined : earnings;
  }
  if (optionWasProvided(interaction, 'pr')) {
    const pr = interaction.options.getInteger('pr');
    record.pr = pr === null ? undefined : pr;
  }
  if (optionWasProvided(interaction, 'gt_id')) {
    const gtIdInput = normalizeGtIdInput(interaction.options.getString('gt_id'));
    record.gtIdNumber = gtIdInput?.gtIdNumber;
    record.gtId = gtIdInput?.gtId;
  }

  if (mode === 'create') {
    if (!record.displayName) record.displayName = user.username || 'GT Player';
    if (!record.roster) record.roster = 'GT Member';
    if (!record.status) record.status = 'active';
  }

  return record;
}
async function handlePlayerCreate(interaction) {
  const user = interaction.options.getUser('user');
  const existing = await getPlayerCard(interaction.guildId, user.id);
  if (existing) return safeEdit(interaction, `${user} already has a GT Player Card (${existing.gtId}). Use /playeredit instead.`);
  let record;
  try {
    record = makePlayerRecordFromInteraction(interaction, user, 'create');
  } catch (error) {
    return safeEdit(interaction, error.message);
  }
  if (record.gtIdNumber && await gtIdExists(interaction.guildId, record.gtIdNumber, user.id)) {
    return safeEdit(interaction, `GT-ID **${record.gtId}** is already used by another player.`);
  }
  const saved = await upsertPlayerCard(record, 'create');
  const payload = await buildPlayerCardPayload(interaction.guild, saved);
  await safeEditPayload(interaction, { content: `Created ${user}'s GT Player Card: **${saved.gtId}**`, files: payload.files, components: payload.components });
}

async function handlePlayerEdit(interaction) {
  const user = interaction.options.getUser('user');
  const existing = await getPlayerCard(interaction.guildId, user.id);
  if (!existing) return safeEdit(interaction, `${user} does not have a GT Player Card yet. Use /playercreate first.`);
  let record;
  try {
    record = makePlayerRecordFromInteraction(interaction, user, 'edit');
  } catch (error) {
    return safeEdit(interaction, error.message);
  }
  if (!record.gtIdNumber) {
    record.gtIdNumber = existing.gtIdNumber;
    record.gtId = existing.gtId;
  } else if (await gtIdExists(interaction.guildId, record.gtIdNumber, user.id)) {
    return safeEdit(interaction, `GT-ID **${record.gtId}** is already used by another player.`);
  }
  const saved = await upsertPlayerCard(record, 'edit');
  const payload = await buildPlayerCardPayload(interaction.guild, saved);
  await safeEditPayload(interaction, { content: `Updated ${user}'s GT Player Card: **${saved.gtId}**`, files: payload.files, components: payload.components });
}

async function handlePlayerRequest(interaction) {
  const user = interaction.user;
  const existing = await getPlayerCard(interaction.guildId, user.id);
  let record;
  try {
    record = makePlayerRecordFromInteraction(interaction, user, existing ? 'edit' : 'create');
  } catch (error) {
    return safeEdit(interaction, error.message);
  }

  if (!existing && !record.displayName) record.displayName = user.username || 'GT Player';
  if (!existing && !record.roster) record.roster = 'GT Member';
  record.status = 'pending';

  const saved = await upsertPlayerCard(record, existing ? 'edit' : 'create');
  const payload = await buildPlayerCardPayload(interaction.guild, saved);
  await safeEditPayload(interaction, {
    content: `✅ Your GT Player Card request was saved as **${saved.gtId}** and is now waiting for staff review.`,
    files: payload.files,
    components: payload.components
  });
}

async function handlePlayerPending(interaction) {
  const cards = (await getPlayerCards(interaction.guildId, true)).filter(c => c.status === 'pending');
  if (!cards.length) return safeEdit(interaction, 'No pending GT Player Card requests right now.');
  const lines = cards.map(c => `• **${c.gtId || 'GT-???'}** — <@${c.userId}> — ${c.displayName || 'No name'} — ${c.roster || 'No roster'}`);
  await sendLongReply(interaction, `**Pending GT Player Card Requests (${cards.length})**\n\n${lines.join('\n')}`);
}

async function handlePlayerDelete(interaction) {
  const user = interaction.options.getUser('user');
  const card = await deactivatePlayerCard(interaction.guildId, user.id);
  await safeEdit(interaction, card ? `Deactivated ${user}'s GT Player Card. **${card.gtId}** stays reserved.` : `${user} does not have a GT Player Card.`);
}

async function handlePlayerCard(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const card = await getPlayerCard(interaction.guildId, user.id);
  if (!card) return safeEdit(interaction, user.id === interaction.user.id ? 'You do not have a GT Player Card yet.' : `${user} does not have a GT Player Card yet.`);
  const payload = await buildPlayerCardPayload(interaction.guild, card);
  await safeEditPayload(interaction, payload);
}

async function handlePlayerPost(interaction) {
  const user = interaction.options.getUser('user');
  const selected = interaction.options.getChannel('channel');
  const channelId = selected?.id || process.env.PLAYER_DIRECTORY_CHANNEL_ID || config.playerDirectoryChannelId;
  const channel = selected || await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!isUsableTextChannel(channel)) return safeEdit(interaction, 'Please select a valid channel or set PLAYER_DIRECTORY_CHANNEL_ID.');
  let card = await getPlayerCard(interaction.guildId, user.id);
  if (!card) return safeEdit(interaction, `${user} does not have a GT Player Card yet.`);
  if (card.status === 'pending') {
    card = await upsertPlayerCard({ guildId: interaction.guildId, userId: user.id, status: 'active' }, 'edit');
  }
  const payload = await buildPlayerCardPayload(interaction.guild, card);
  await channel.send(payload);
  await safeEdit(interaction, `Posted and approved ${user}'s GT Player Card in ${channel}.`);
}

async function handlePlayerList(interaction) {
  const cards = await getPlayerCards(interaction.guildId, true);
  if (!cards.length) return safeEdit(interaction, 'No GT Player Cards saved yet.');
  const lines = cards.map(c => `• **${c.gtId || 'GT-???'}** — <@${c.userId}> — ${c.displayName || 'No name'} — ${c.roster || 'No roster'}${c.status && c.status !== 'active' ? ` — ${c.status}` : ''}`);
  await sendLongReply(interaction, `**GT Player Cards (${cards.length})**\n\n${lines.join('\n')}`);
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
      await sendBirthdayGreeting(channel, birthday, year);
      const guild = channel.guild || await client.guilds.fetch(birthday.guildId).catch(() => null);
      const expiresAt = guild ? await giveBirthdayRole(guild, birthday.userId).catch(error => {
        console.error(`Failed to give birthday role to ${birthday.userId}:`, error.message);
        return null;
      }) : null;
      await markBirthdaySent(birthday.guildId, birthday.userId, year);
      if (expiresAt) console.log(`Birthday role given to ${birthday.userId} until ${expiresAt.toISOString()}`);
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
  try { await initPlayerCardDatabase(); }
  catch (error) { console.error('Player card database init failed:', error.message); }
  checkExpiredEventBans();
  setInterval(checkExpiredEventBans, 60 * 1000);
  checkAutoFortniteEvents();
  setInterval(checkAutoFortniteEvents, 60 * 1000);
  checkTwitchLiveNotifications();
  setInterval(checkTwitchLiveNotifications, Number(process.env.TWITCH_NOTIFY_INTERVAL_SECONDS || config.twitchLiveNotifications?.intervalSeconds || 60) * 1000);
  checkBirthdays();
  setInterval(checkBirthdays, 60 * 1000);
  checkExpiredBirthdayRoles();
  setInterval(checkExpiredBirthdayRoles, 60 * 1000);
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
      case 'playerrequest': await handlePlayerRequest(interaction); break;
      case 'playerpending': await handlePlayerPending(interaction); break;
      case 'playerdelete': await handlePlayerDelete(interaction); break;
      case 'playercard': await handlePlayerCard(interaction); break;
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
