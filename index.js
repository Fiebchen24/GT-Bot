require('dotenv').config();

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

console.log('GT ROLE BOT V6.5 LOADED');

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
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

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
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
