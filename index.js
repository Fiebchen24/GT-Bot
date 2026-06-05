require('dotenv').config();

const fs = require('fs');
const path = require('path');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  EmbedBuilder
} = require('discord.js');

const config = require('./config.json');

console.log('GT ROLE BOT V7.1.1 LOADED');

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('calendar')
    .setDescription('Show the current GT competitive calendar.'),

  new SlashCommandBuilder()
    .setName('calendarlist')
    .setDescription('List saved GT calendar events.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('calendarpost')
    .setDescription('Post or update the GT calendar embed in the configured channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('calendarrefresh')
    .setDescription('Fetch Fortnite events now and update the GT calendar.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('calendaradd')
    .setDescription('Add an event to the GT competitive calendar.')
    .addStringOption(o => o.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(o => o.setName('date').setDescription('Date: YYYY-MM-DD').setRequired(true))
    .addStringOption(o => o.setName('time').setDescription('Time: HH:MM in CET/CEST').setRequired(true))
    .addStringOption(o => o.setName('type').setDescription('Type, e.g. Fortnite Cup or GT Event').setRequired(true)
      .addChoices(
        { name: 'Fortnite Cup', value: 'Fortnite Cup' },
        { name: 'GT Event', value: 'GT Event' },
        { name: 'Partner Event', value: 'Partner Event' },
        { name: 'Scrims', value: 'Scrims' },
        { name: 'Other', value: 'Other' }
      ))
    .addStringOption(o => o.setName('region').setDescription('Region, e.g. EU / NAC / NAW / OCE').setRequired(false))
    .addStringOption(o => o.setName('notes').setDescription('Optional short notes').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('calendarremove')
    .setDescription('Remove an event from the GT competitive calendar by ID.')
    .addStringOption(o => o.setName('id').setDescription('Event ID from /calendarlist').setRequired(true))
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


const CALENDAR_FILE = path.join(__dirname, 'data', 'gtCalendar.json');
const CALENDAR_MESSAGE_FILE = path.join(__dirname, 'data', 'gtCalendarMessage.json');
const FORTNITE_EVENTS_CACHE_FILE = path.join(__dirname, 'data', 'fortniteEventsCache.json');

function ensureDataDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadCalendarStore() {
  ensureDataDir();
  try {
    if (!fs.existsSync(CALENDAR_FILE)) return { events: [] };
    const parsed = JSON.parse(fs.readFileSync(CALENDAR_FILE, 'utf8'));
    if (Array.isArray(parsed)) return { events: parsed };
    return { events: Array.isArray(parsed.events) ? parsed.events : [] };
  } catch (error) {
    console.error('Could not load gtCalendar.json:', error);
    return { events: [] };
  }
}

function saveCalendarStore(store) {
  ensureDataDir();
  fs.writeFileSync(CALENDAR_FILE, JSON.stringify({ events: store.events || [] }, null, 2));
}

function loadCalendarMessageStore() {
  ensureDataDir();
  try {
    if (!fs.existsSync(CALENDAR_MESSAGE_FILE)) return {};
    return JSON.parse(fs.readFileSync(CALENDAR_MESSAGE_FILE, 'utf8')) || {};
  } catch (error) {
    console.error('Could not load gtCalendarMessage.json:', error);
    return {};
  }
}

function saveCalendarMessageStore(store) {
  ensureDataDir();
  fs.writeFileSync(CALENDAR_MESSAGE_FILE, JSON.stringify(store || {}, null, 2));
}

function loadFortniteEventsCache() {
  ensureDataDir();
  try {
    if (!fs.existsSync(FORTNITE_EVENTS_CACHE_FILE)) return { updatedAt: null, source: '', events: [] };
    const parsed = JSON.parse(fs.readFileSync(FORTNITE_EVENTS_CACHE_FILE, 'utf8'));
    return {
      updatedAt: parsed.updatedAt || null,
      source: parsed.source || '',
      events: Array.isArray(parsed.events) ? parsed.events : []
    };
  } catch (error) {
    console.error('Could not load fortniteEventsCache.json:', error);
    return { updatedAt: null, source: '', events: [] };
  }
}

function saveFortniteEventsCache(events, source = 'Fortnite API') {
  ensureDataDir();
  fs.writeFileSync(FORTNITE_EVENTS_CACHE_FILE, JSON.stringify({
    updatedAt: new Date().toISOString(),
    source,
    events: events || []
  }, null, 2));
}

function berlinDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function berlinTimeString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    hour: '2-digit', minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${map.hour}:${map.minute}`;
}

function validateCalendarDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date. Use YYYY-MM-DD.');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date. Use YYYY-MM-DD.');
}

function validateCalendarTime(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('Invalid time. Use HH:MM.');
  const [h, m] = time.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) throw new Error('Invalid time. Use HH:MM.');
}

function makeCalendarId() {
  return `gt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function getValueByPaths(obj, paths) {
  for (const p of paths) {
    const parts = p.split('.');
    let cur = obj;
    for (const part of parts) cur = cur?.[part];
    if (cur !== undefined && cur !== null && cur !== '') return cur;
  }
  return null;
}

function findArraysDeep(value, depth = 0, arrays = []) {
  if (depth > 5 || value === null || value === undefined) return arrays;
  if (Array.isArray(value)) {
    if (value.some(item => item && typeof item === 'object')) arrays.push(value);
    for (const item of value.slice(0, 20)) findArraysDeep(item, depth + 1, arrays);
    return arrays;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) findArraysDeep(value[key], depth + 1, arrays);
  }
  return arrays;
}

function parseApiDate(input) {
  if (!input) return null;
  if (typeof input === 'number') {
    const date = new Date(input > 9999999999 ? input : input * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeFortniteEvent(raw, windowData = null) {
  const source = windowData || raw;
  const title = getValueByPaths(raw, [
    'title', 'name', 'displayName', 'eventName', 'event.name', 'metadata.title', 'metadata.name',
    'eventTemplateId', 'eventId', 'id'
  ]);
  const startRaw = getValueByPaths(source, [
    'startTime', 'beginTime', 'start', 'startsAt', 'sessionStartTime', 'date', 'startDate', 'windowStartTime'
  ]) || getValueByPaths(raw, ['startTime', 'beginTime', 'start', 'startsAt', 'date', 'startDate']);

  const endRaw = getValueByPaths(source, [
    'endTime', 'finishTime', 'end', 'endsAt', 'sessionEndTime', 'endDate', 'windowEndTime'
  ]) || getValueByPaths(raw, ['endTime', 'finishTime', 'end', 'endsAt', 'endDate']);

  const start = parseApiDate(startRaw);
  if (!title || !start) return null;

  const region = getValueByPaths(raw, ['region', 'eventRegion', 'serverRegion', 'metadata.region']) ||
    getValueByPaths(source, ['region', 'eventRegion', 'serverRegion']) || 'Fortnite';

  const platform = getValueByPaths(raw, ['platform', 'platforms', 'metadata.platform']) || '';
  const notes = endRaw ? `Ends ${berlinDateString(parseApiDate(endRaw) || start)} ${berlinTimeString(parseApiDate(endRaw) || start)}` : '';

  return {
    id: `fn-${String(getValueByPaths(raw, ['id', 'eventId', 'eventTemplateId', 'name']) || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}-${start.getTime()}`,
    title: String(title).replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim(),
    date: berlinDateString(start),
    time: berlinTimeString(start),
    region: Array.isArray(region) ? region.join(', ') : String(region || 'Fortnite').toUpperCase(),
    type: 'Fortnite Cup',
    notes: platform && typeof platform === 'string' ? `${platform}${notes ? ` — ${notes}` : ''}` : notes,
    source: 'auto'
  };
}

function extractFortniteEventsFromPayload(payload) {
  const arrays = findArraysDeep(payload);
  const candidates = [];

  for (const arr of arrays) {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const windows = getValueByPaths(item, ['windows', 'eventWindows', 'sessions', 'rounds']);
      if (Array.isArray(windows) && windows.length) {
        for (const windowData of windows) {
          const normalized = normalizeFortniteEvent(item, windowData);
          if (normalized) candidates.push(normalized);
        }
      } else {
        const normalized = normalizeFortniteEvent(item);
        if (normalized) candidates.push(normalized);
      }
    }
  }

  const seen = new Set();
  return candidates
    .filter(e => e.date >= berlinDateString())
    .filter(e => {
      const key = `${e.title}|${e.date}|${e.time}|${e.region}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => `${a.date} ${a.time} ${a.title}`.localeCompare(`${b.date} ${b.time} ${b.title}`))
    .slice(0, 100);
}

function buildCitoUpcomingUrl(rawUrl) {
  const fallback = 'https://api.citoapi.com/api/v1/fortnite/tournaments/upcoming';
  if (!rawUrl) return fallback;

  const trimmed = String(rawUrl).trim().replace(/\/+$/, '');
  if (!trimmed) return fallback;

  // If a full tournaments endpoint is supplied, use it as-is.
  if (/\/fortnite\/tournaments(\/upcoming)?$/i.test(trimmed)) return trimmed;

  // If the user supplied the base API URL, append the free upcoming endpoint.
  return `${trimmed}/fortnite/tournaments/upcoming`;
}

async function fetchFortniteEvents() {
  const rawApiUrl = process.env.CITO_API_URL || process.env.FORTNITE_EVENTS_API_URL || config.citoApiUrl || config.fortniteEventsApiUrl;
  const apiUrl = buildCitoUpcomingUrl(rawApiUrl);
  const apiKey = process.env.CITO_API_KEY || process.env.FORTNITE_EVENTS_API_KEY || config.citoApiKey || config.fortniteEventsApiKey;

  if (!apiKey) {
    console.log('Calendar auto-fetch skipped: set CITO_API_KEY to enable automatic Fortnite events.');
    return loadFortniteEventsCache().events;
  }

  const headers = {
    Accept: 'application/json',
    'x-api-key': apiKey
  };

  const response = await fetch(apiUrl, { headers });

  if (!response.ok) {
    let details = '';
    try {
      const body = await response.text();
      details = body ? ` - ${body.slice(0, 300)}` : '';
    } catch (_) {}
    throw new Error(`Fortnite events API error ${response.status}: ${response.statusText}${details}`);
  }

  const payload = await response.json();
  const events = extractFortniteEventsFromPayload(payload);
  saveFortniteEventsCache(events, apiUrl);
  console.log(`Fetched ${events.length} Fortnite events from Cito upcoming endpoint.`);
  return events;
}

async function refreshFortniteEventsSafe() {
  try {
    return await fetchFortniteEvents();
  } catch (error) {
    console.error('Fortnite calendar fetch failed:', error.message);
    return loadFortniteEventsCache().events;
  }
}

function sortedManualCalendarEvents(includePast = false) {
  const today = berlinDateString();
  return loadCalendarStore().events
    .filter(e => includePast || e.date >= today)
    .map(e => ({ ...e, source: e.source || 'manual' }))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function sortedAllCalendarEvents(includePast = false) {
  const today = berlinDateString();
  const autoEvents = loadFortniteEventsCache().events.map(e => ({ ...e, source: 'auto' }));
  const manualEvents = sortedManualCalendarEvents(includePast);
  const all = [...manualEvents, ...autoEvents]
    .filter(e => includePast || e.date >= today)
    .sort((a, b) => `${a.date} ${a.time} ${a.title}`.localeCompare(`${b.date} ${b.time} ${b.title}`));

  const seen = new Set();
  return all.filter(e => {
    const key = `${e.title}|${e.date}|${e.time}|${e.region}|${e.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatCalendarLine(e, withId = false) {
  const region = e.region ? ` \`${e.region}\`` : '';
  const source = e.source === 'auto' ? 'Auto Fortnite' : e.type;
  const notes = e.notes ? ` — ${e.notes}` : '';
  const id = withId ? `\n  ID: \`${e.id}\`` : '';
  return `• **${e.time}** — ${e.title}${region}\n  ${source}${notes}${id}`;
}

async function buildCalendarEmbed(refreshAuto = false) {
  if (refreshAuto) await refreshFortniteEventsSafe();

  const today = berlinDateString();
  const events = sortedAllCalendarEvents(false);
  const todayEvents = events.filter(e => e.date === today).slice(0, 10);
  const tomorrowDate = berlinDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const tomorrowEvents = events.filter(e => e.date === tomorrowDate).slice(0, 8);
  const upcomingEvents = events.filter(e => e.date > tomorrowDate).slice(0, 10);
  const cache = loadFortniteEventsCache();
  const sourceText = cache.updatedAt
    ? `Auto Fortnite updated: ${formatDateTime(cache.updatedAt)}`
    : 'Auto Fortnite: not configured yet';

  return new EmbedBuilder()
    .setTitle('📅 Today at GT')
    .setDescription('Automatic Fortnite cups + manual GT events. Times are CET/CEST.')
    .addFields(
      {
        name: 'Today',
        value: todayEvents.length ? todayEvents.map(e => formatCalendarLine(e)).join('\n') : 'No events listed for today.'
      },
      {
        name: 'Tomorrow',
        value: tomorrowEvents.length ? tomorrowEvents.map(e => formatCalendarLine(e)).join('\n') : 'No events listed for tomorrow.'
      },
      {
        name: 'Upcoming',
        value: upcomingEvents.length ? upcomingEvents.map(e => `• **${e.date} ${e.time}** — ${e.title}${e.region ? ` \`${e.region}\`` : ''}`).join('\n') : 'No upcoming events listed.'
      }
    )
    .setFooter({ text: `GT Competitive Calendar • ${sourceText}` })
    .setTimestamp();
}

async function getCalendarChannel(guild) {
  const channelId = process.env.CALENDAR_CHANNEL_ID || config.calendarChannelId;
  if (!channelId) return null;
  return guild.channels.fetch(channelId).catch(() => null);
}

async function updateCalendarMessage(guild, ping = false, refreshAuto = false) {
  const channel = await getCalendarChannel(guild);
  if (!channel || !channel.isTextBased()) return null;

  const embed = await buildCalendarEmbed(refreshAuto);
  const store = loadCalendarMessageStore();
  let message = null;

  if (store[guild.id]?.messageId) {
    message = await channel.messages.fetch(store[guild.id].messageId).catch(() => null);
  }

  if (message) {
    await message.edit({ embeds: [embed] });
    return message;
  }

  const roleId = process.env.TOURNAMENT_ALERT_ROLE_ID || config.tournamentAlertRoleId;
  const content = ping && roleId ? `<@&${roleId}>` : '';
  message = await channel.send({ content, embeds: [embed], allowedMentions: { roles: roleId ? [roleId] : [] } });
  store[guild.id] = { channelId: channel.id, messageId: message.id, updatedAt: new Date().toISOString() };
  saveCalendarMessageStore(store);
  return message;
}

async function handleCalendar(interaction) {
  await interaction.editReply({ embeds: [await buildCalendarEmbed(false)] });
}

async function handleCalendarList(interaction) {
  const events = sortedManualCalendarEvents(true).slice(0, 50);
  if (!events.length) return safeEdit(interaction, 'No calendar events saved.');
  const lines = ['**Manual GT Calendar Events**', ...events.map(e => formatCalendarLine(e, true))];
  await sendLongReply(interaction, lines.join('\n'));
}

async function handleCalendarAdd(interaction) {
  const title = interaction.options.getString('title').trim();
  const date = interaction.options.getString('date').trim();
  const time = interaction.options.getString('time').trim();
  const type = interaction.options.getString('type').trim();
  const region = (interaction.options.getString('region') || 'EU').trim();
  const notes = (interaction.options.getString('notes') || '').trim();

  validateCalendarDate(date);
  validateCalendarTime(time);
  if (!title) throw new Error('Title cannot be empty.');

  const store = loadCalendarStore();
  const event = {
    id: makeCalendarId(),
    title,
    date,
    time,
    region,
    type,
    notes,
    createdBy: interaction.user.id,
    createdAt: new Date().toISOString()
  };
  store.events.push(event);
  saveCalendarStore(store);

  await updateCalendarMessage(interaction.guild, false, false).catch(error => console.error('Calendar auto-update failed:', error.message));
  await safeEdit(interaction, `Calendar event added: **${title}** on **${date} ${time}**. ID: \`${event.id}\``);
}

async function handleCalendarRemove(interaction) {
  const id = interaction.options.getString('id').trim();
  const store = loadCalendarStore();
  const before = store.events.length;
  const removed = store.events.find(e => e.id === id);
  store.events = store.events.filter(e => e.id !== id);
  saveCalendarStore(store);

  if (before === store.events.length) return safeEdit(interaction, `No calendar event found with ID \`${id}\`.`);
  await updateCalendarMessage(interaction.guild, false, false).catch(error => console.error('Calendar auto-update failed:', error.message));
  await safeEdit(interaction, `Calendar event removed: **${removed.title}**.`);
}

async function handleCalendarPost(interaction) {
  const message = await updateCalendarMessage(interaction.guild, false, true);
  if (!message) return safeEdit(interaction, 'Calendar channel not found. Set CALENDAR_CHANNEL_ID in .env or calendarChannelId in config.json.');
  await safeEdit(interaction, `Calendar posted/updated in ${message.channel}.`);
}

async function handleCalendarRefresh(interaction) {
  const events = await refreshFortniteEventsSafe();
  const message = await updateCalendarMessage(interaction.guild, false, false);
  const location = message ? ` and updated ${message.channel}` : '';
  await safeEdit(interaction, `Fortnite calendar refreshed. Auto events found: **${events.length}**${location}.`);
}

async function updateCalendarForAllGuilds() {
  for (const guild of client.guilds.cache.values()) {
    await updateCalendarMessage(guild, false, true).catch(error => console.error(`Calendar update failed for ${guild.id}:`, error.message));
  }
}

client.once('clientReady', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  checkExpiredEventBans();
  setInterval(checkExpiredEventBans, 60 * 1000);
  await updateCalendarForAllGuilds();
  setInterval(updateCalendarForAllGuilds, 6 * 60 * 60 * 1000);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const deferred = await safeDefer(interaction);
  if (!deferred) return;

  try {
    switch (interaction.commandName) {
      case 'giverolefromchannel': return handleRoleFromChannel(interaction, 'give');
      case 'takerolefromchannel': return handleRoleFromChannel(interaction, 'take');
      case 'earningsroles': return handleEarningsRoles(interaction);
      case 'checksignup': return handleCheckSignup(interaction);
      case 'postcupcheck': return handlePostCupCheck(interaction);
      case 'voicechannelcreate': return handleVoiceCreate(interaction);
      case 'voicechanneldelete': return handleVoiceDelete(interaction);
      case 'voicechanneldeleteall': return handleVoiceDeleteAll(interaction);
      case 'eventbanadd': return handleEventBanAdd(interaction);
      case 'eventbanfromchannel': return handleEventBanFromChannel(interaction);
      case 'eventbanremove': return handleEventBanRemove(interaction);
      case 'eventbanlist': return handleEventBanList(interaction);
      case 'calendar': return handleCalendar(interaction);
      case 'calendarlist': return handleCalendarList(interaction);
      case 'calendaradd': return handleCalendarAdd(interaction);
      case 'calendarremove': return handleCalendarRemove(interaction);
      case 'calendarpost': return handleCalendarPost(interaction);
      case 'calendarrefresh': return handleCalendarRefresh(interaction);
      default: return safeEdit(interaction, 'Unknown command.');
    }
  } catch (error) {
    console.error(error);
    return safeEdit(interaction, `Error: ${error.message}`);
  }
});

registerCommands()
  .then(() => client.login(TOKEN))
  .catch(error => {
    console.error('Startup failed:', error);
    process.exit(1);
  });
