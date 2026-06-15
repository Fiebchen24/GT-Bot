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
  MessageFlags
} = require('discord.js');

const config = require('./config.json');

console.log('GT ROLE BOT V7.1 LOADED');

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

function formatEventTime(event) {
  const datePart = event.start.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const start = event.start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (!event.end || Number.isNaN(event.end.getTime())) return `${datePart}, ${start}`;
  const end = event.end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${datePart}, ${start} - ${end}`;
}

async function getFortniteEventsInRange(from, to, limit) {
  const icsText = await fetchFortniteCalendarText();
  return parseIcsEvents(icsText)
    .filter(event => event.start >= from && event.start < to)
    .slice(0, limit);
}

function buildFortniteEventsMessage(events, title) {
  const lines = [];
  lines.push(`**${title}**`);
  lines.push('');

  if (!events.length) {
    lines.push('No Fortnite events found for this range.');
    return lines.join('\n');
  }

  for (const event of events) {
    lines.push(`📅 **${event.summary}**`);
    lines.push(`⏰ ${formatEventTime(event)}`);
    if (event.location) lines.push(`📍 ${event.location}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

async function handleFortniteEvents(interaction, mode) {
  const limit = interaction.options.getInteger('limit') || (mode === 'today' ? 15 : 10);
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

  const events = await getFortniteEventsInRange(from, to, limit);
  await sendLongReply(interaction, buildFortniteEventsMessage(events, title));
}

async function handleFortniteEventsPost(interaction) {
  const channel = interaction.options.getChannel('channel');
  if (!isUsableTextChannel(channel)) return safeEdit(interaction, 'Please select a valid text channel.');

  const days = interaction.options.getInteger('days') || 7;
  const limit = interaction.options.getInteger('limit') || 10;
  const from = new Date(Date.now() - 60 * 60 * 1000);
  const to = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const events = await getFortniteEventsInRange(from, to, limit);
  const message = buildFortniteEventsMessage(events, `Upcoming Fortnite Events - next ${days} days`);

  for (const chunk of splitText(message, 1900)) await channel.send(chunk);
  await safeEdit(interaction, `Posted ${events.length} Fortnite event(s) in ${channel}.`);
}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  checkExpiredEventBans();
  setInterval(checkExpiredEventBans, 60 * 1000);
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
      case 'fortniteevents': return handleFortniteEvents(interaction, 'upcoming');
      case 'fortniteeventstoday': return handleFortniteEvents(interaction, 'today');
      case 'fortniteeventspost': return handleFortniteEventsPost(interaction);
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
