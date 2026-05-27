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

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

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

const textChannelOption = option => option
  .setName('channel')
  .setDescription('Channel to scan')
  .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  .setRequired(true);

const scanLimitOption = option => option
  .setName('limit')
  .setDescription('Messages to scan. Default 1000, max 5000')
  .setMinValue(1)
  .setMaxValue(5000)
  .setRequired(false);

const commands = [
  new SlashCommandBuilder()
    .setName('giverolefromchannel')
    .setDescription('Gives a role to everyone mentioned in a selected channel.')
    .addChannelOption(textChannelOption)
    .addRoleOption(option => option.setName('role').setDescription('Role to give').setRequired(true))
    .addIntegerOption(scanLimitOption)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('takerolefromchannel')
    .setDescription('Removes a role from everyone mentioned in a selected channel.')
    .addChannelOption(textChannelOption)
    .addRoleOption(option => option.setName('role').setDescription('Role to remove').setRequired(true))
    .addIntegerOption(scanLimitOption)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('earningsroles')
    .setDescription('Updates earnings roles based on mentions and earnings numbers in a channel.')
    .addChannelOption(textChannelOption)
    .addIntegerOption(scanLimitOption)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('checksignup')
    .setDescription('Before cup: checks sign-ins against Twitch registrations.')
    .addChannelOption(option => option
      .setName('signin_channel')
      .setDescription('Channel with sign-ins / Discord mentions')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addChannelOption(option => option
      .setName('twitch_channel')
      .setDescription('Channel with Twitch links / Twitch registrations')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addIntegerOption(scanLimitOption)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('checkstreamproof')
    .setDescription('After cup: checks signed-in players for live status or recent Twitch VODs.')
    .addChannelOption(option => option
      .setName('signin_channel')
      .setDescription('Channel with sign-ins / Discord mentions')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addChannelOption(option => option
      .setName('twitch_channel')
      .setDescription('Channel with Discord names + Twitch links')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addIntegerOption(option => option.setName('hours').setDescription('How many hours back to check VODs. Default 24').setMinValue(1).setMaxValue(168).setRequired(false))
    .addIntegerOption(scanLimitOption)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Slash commands registered.');
  console.log('GT Role Bot V5.4 command set active.');
}

function normalizeTwitchName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '')
    .trim();
}

function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(gt|mask|penta|team|twitch|ttv|yt|youtube|live|fn|ǒïǥ|oig)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function extractTwitchLinks(content) {
  const found = new Set();
  const regex = /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{3,25})(?:[/?#\s]|$)/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = normalizeTwitchName(match[1]);
    if (name && !['directory', 'videos', 'settings', 'popout'].includes(name)) found.add(name);
  }
  return [...found];
}

function validateTextChannel(channel, label = 'channel') {
  if (!channel || typeof channel.isTextBased !== 'function' || !channel.isTextBased() || !channel.messages) {
    throw new Error(`Please select a valid text channel for ${label}.`);
  }
  return channel;
}

async function fetchMessages(channel, limit = 1000) {
  validateTextChannel(channel);
  const max = Math.min(Math.max(limit || 1000, 1), 5000);
  const all = [];
  let before;

  while (all.length < max) {
    const batchSize = Math.min(100, max - all.length);
    const options = { limit: batchSize };
    if (before) options.before = before;

    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;

    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < batchSize) break;
  }

  return all.reverse();
}

function extractEarningsAfterMention(content, userId) {
  const mentionRegex = new RegExp(`<@!?${userId}>\\s*\\$?([\\d.,]+)`, 'i');
  const match = content.match(mentionRegex);
  if (!match) return null;
  const cleaned = match[1].replace(/,/g, '').replace(/\./g, '');
  const earnings = parseInt(cleaned, 10);
  return Number.isNaN(earnings) ? null : earnings;
}

function getEarningsRole(earnings) {
  const sortedRoles = [...config.earningsRoles].sort((a, b) => b.min - a.min);
  return sortedRoles.find(role => earnings >= role.min);
}

async function getMemberKeys(guild, user) {
  const keys = new Set();
  const add = value => {
    const key = normalizeName(value);
    if (key.length >= 3) keys.add(key);
  };

  add(user.username);
  add(user.globalName);
  add(user.displayName);

  try {
    const member = await guild.members.fetch(user.id);
    add(member.displayName);
    add(member.nickname);
  } catch {}

  return [...keys];
}

function twitchMatchesUserKeys(twitchName, keys) {
  const tw = normalizeName(twitchName);
  if (tw.length < 3) return false;

  return keys.some(key => {
    if (key.length < 3) return false;
    return tw === key || tw.startsWith(key) || tw.includes(key) || key.includes(tw);
  });
}

function chunkLines(title, lines, maxLength = 1850) {
  const chunks = [];
  let current = title ? `${title}\n` : '';

  for (const line of lines) {
    const next = `${current}${line}\n`;
    if (next.length > maxLength) {
      if (current.trim()) chunks.push(current.trim());
      current = `${line}\n`;
    } else {
      current = next;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function replyLong(interaction, title, lines, ephemeral = true) {
  const chunks = chunkLines(title, lines);
  if (chunks.length === 0) return interaction.editReply('No result.');
  await interaction.editReply(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    const payload = { content: chunks[i] };
    if (ephemeral) payload.flags = MessageFlags.Ephemeral;
    await interaction.followUp(payload);
  }
}

async function getTwitchToken() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) throw new Error('Missing Twitch API credentials.');

  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch token failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function twitchApi(path, token) {
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error(`Twitch API failed: ${res.status}`);
  return res.json();
}

async function checkTwitchUsers(usernames, hours) {
  const token = await getTwitchToken();
  const unique = [...new Set(usernames.map(normalizeTwitchName).filter(Boolean))];
  const results = new Map();
  if (unique.length === 0) return results;

  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const loginQuery = batch.map(name => `login=${encodeURIComponent(name)}`).join('&');
    const usersData = await twitchApi(`/users?${loginQuery}`, token);

    const loginToUser = new Map();
    for (const user of usersData.data || []) loginToUser.set(user.login.toLowerCase(), user);

    const idQuery = [...loginToUser.values()].map(user => `user_id=${encodeURIComponent(user.id)}`).join('&');
    const liveSet = new Set();
    if (idQuery) {
      const streamsData = await twitchApi(`/streams?${idQuery}`, token);
      for (const stream of streamsData.data || []) liveSet.add(stream.user_login.toLowerCase());
    }

    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    for (const name of batch) {
      const user = loginToUser.get(name);
      if (!user) {
        results.set(name, { status: 'not_found' });
        continue;
      }

      if (liveSet.has(name)) {
        results.set(name, { status: 'live' });
        continue;
      }

      const videos = await twitchApi(`/videos?user_id=${encodeURIComponent(user.id)}&type=archive&first=5`, token);
      const recentVod = (videos.data || []).find(video => new Date(video.created_at).getTime() >= cutoff);
      results.set(name, { status: recentVod ? 'vod' : 'none', vodUrl: recentVod?.url });
    }
  }

  return results;
}

function addUniqueMap(map, user, value) {
  if (!map.has(user.id)) map.set(user.id, { user, links: new Set(), inferred: false });
  if (value) map.get(user.id).links.add(value);
}

function findNamedSignedInUsers(content, signedInUsers, keysByUser) {
  const normalizedContent = normalizeName(content);
  const matches = [];

  for (const [userId, user] of signedInUsers.entries()) {
    const keys = keysByUser.get(userId) || [];
    if (keys.some(key => key.length >= 3 && normalizedContent.includes(key))) {
      matches.push(user);
    }
  }

  // Keep this strict: only auto-match by plain text if exactly one signed-in player name is found.
  return matches.length === 1 ? matches : [];
}

async function buildSignupData(guild, signinChannel, twitchChannel, limit) {
  const signinMessages = await fetchMessages(signinChannel, limit);
  const twitchMessages = await fetchMessages(twitchChannel, limit);

  const signedInUsers = new Map();
  const twitchByUser = new Map();
  const looseLinks = new Set();
  const allLinks = new Set();
  const nameMatched = [];

  // Sign-in channel: every @mention is a signed-in player.
  for (const message of signinMessages) {
    for (const user of message.mentions.users.values()) {
      if (!user.bot) signedInUsers.set(user.id, user);
    }
  }

  // Prepare display-name keys for plain-text matching in the Twitch channel.
  const keysByUser = new Map();
  for (const user of signedInUsers.values()) keysByUser.set(user.id, await getMemberKeys(guild, user));

  for (const message of twitchMessages) {
    const links = extractTwitchLinks(message.content);
    if (!links.length) continue;
    links.forEach(link => allLinks.add(link));

    let users = [...message.mentions.users.values()].filter(user => !user.bot);

    // If the Twitch channel has no @mention but contains the Discord name as text,
    // match it against the signed-in users' username / server nickname / display name.
    if (users.length === 0) {
      users = findNamedSignedInUsers(message.content, signedInUsers, keysByUser);
      if (users.length === 1) {
        for (const link of links) nameMatched.push({ user: users[0], link });
      }
    }

    if (users.length > 0) {
      // @User twitch.tv/name OR DiscordName twitch.tv/name.
      // If there are multiple links in one message, keep all links on each matched user.
      for (const user of users) {
        for (const link of links) addUniqueMap(twitchByUser, user, link);
      }
    } else {
      // Link found but we cannot safely assign it to a signed-in Discord user.
      links.forEach(link => looseLinks.add(link));
    }
  }

  const signinsMissingTwitch = [...signedInUsers.values()].filter(user => !twitchByUser.has(user.id));
  const twitchWithoutSignin = [...twitchByUser.values()].filter(entry => !signedInUsers.has(entry.user.id));

  return {
    signedInUsers,
    twitchByUser,
    allLinks,
    looseLinks,
    nameMatched,
    signinsMissingTwitch,
    twitchWithoutSignin,
    signinMessagesScanned: signinMessages.length,
    twitchMessagesScanned: twitchMessages.length
  };
}

async function sendChannelNotice(channel, content) {
  try {
    if (channel && channel.isTextBased && channel.isTextBased()) await channel.send(content);
  } catch (error) {
    console.error(`Could not send notice to ${channel?.id || 'unknown channel'}:`, error.message);
  }
}

client.once('clientReady', () => {
  console.log('==============================');
  console.log('GT ROLE BOT V5.4 LOADED');
  console.log(`Logged in as ${client.user.tag}`);
  console.log('If you still see line numbers from older versions, another Render service is still running.');
  console.log('==============================');
});


process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const shouldReplyPublic = ['checksignup', 'checkstreamproof'].includes(interaction.commandName);

  try {
    // Discord requires an acknowledgement within about 3 seconds. Do this first,
    // before scans, API calls, or any heavy work.
    const deferOptions = shouldReplyPublic ? {} : { flags: MessageFlags.Ephemeral };
    await interaction.deferReply(deferOptions);
  } catch (error) {
    console.error('Failed to defer interaction:', error);
    return;
  }

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.editReply('You need Manage Roles permission to use this command.');
  }

  try {
    if (interaction.commandName === 'giverolefromchannel') {
      const channel = validateTextChannel(interaction.options.getChannel('channel'), 'channel');
      const role = interaction.options.getRole('role');
      const limit = interaction.options.getInteger('limit') || 1000;
      const messages = await fetchMessages(channel, limit);
      const userIds = new Set();
      for (const message of messages) for (const user of message.mentions.users.values()) userIds.add(user.id);

      let added = 0, already = 0, failed = 0;
      for (const userId of userIds) {
        try {
          const member = await interaction.guild.members.fetch(userId);
          if (member.roles.cache.has(role.id)) already++;
          else { await member.roles.add(role); added++; }
        } catch { failed++; }
      }
      return interaction.editReply(`Success\nRole: ${role}\nMessages scanned: ${messages.length}\nUsers found: ${userIds.size}\nNewly added: ${added}\nAlready had role: ${already}\nFailed: ${failed}`);
    }

    if (interaction.commandName === 'takerolefromchannel') {
      const channel = validateTextChannel(interaction.options.getChannel('channel'), 'channel');
      const role = interaction.options.getRole('role');
      const limit = interaction.options.getInteger('limit') || 1000;
      const messages = await fetchMessages(channel, limit);
      const userIds = new Set();
      for (const message of messages) for (const user of message.mentions.users.values()) userIds.add(user.id);

      let removed = 0, didNotHave = 0, failed = 0;
      for (const userId of userIds) {
        try {
          const member = await interaction.guild.members.fetch(userId);
          if (!member.roles.cache.has(role.id)) didNotHave++;
          else { await member.roles.remove(role); removed++; }
        } catch { failed++; }
      }
      return interaction.editReply(`Success\nRole: ${role}\nMessages scanned: ${messages.length}\nUsers found: ${userIds.size}\nRemoved: ${removed}\nDid not have role: ${didNotHave}\nFailed: ${failed}`);
    }

    if (interaction.commandName === 'earningsroles') {
      const channel = validateTextChannel(interaction.options.getChannel('channel'), 'channel');
      const limit = interaction.options.getInteger('limit') || 1000;
      const messages = await fetchMessages(channel, limit);
      const allEarningsRoleIds = config.earningsRoles.map(r => r.roleId);

      let updated = 0, alreadyCorrect = 0, skipped = 0, failed = 0;
      for (const message of messages) {
        for (const user of message.mentions.users.values()) {
          const earnings = extractEarningsAfterMention(message.content, user.id);
          if (earnings === null) { skipped++; continue; }
          const roleData = getEarningsRole(earnings);
          if (!roleData) { skipped++; continue; }

          try {
            const member = await interaction.guild.members.fetch(user.id);
            const hasCorrect = member.roles.cache.has(roleData.roleId);
            const hasWrong = allEarningsRoleIds.some(id => id !== roleData.roleId && member.roles.cache.has(id));
            if (hasCorrect && !hasWrong) { alreadyCorrect++; continue; }
            await member.roles.remove(allEarningsRoleIds.filter(id => id !== roleData.roleId)).catch(() => {});
            if (!hasCorrect) await member.roles.add(roleData.roleId);
            updated++;
          } catch { failed++; }
        }
      }

      return interaction.editReply(`Done.\nMessages scanned: ${messages.length}\nUpdated: ${updated}\nAlready correct: ${alreadyCorrect}\nSkipped: ${skipped}\nFailed: ${failed}`);
    }

    if (interaction.commandName === 'checksignup') {
      const signinChannel = validateTextChannel(interaction.options.getChannel('signin_channel'), 'sign-in channel');
      const twitchChannel = validateTextChannel(interaction.options.getChannel('twitch_channel'), 'Twitch channel');
      const limit = interaction.options.getInteger('limit') || 1000;

      const data = await buildSignupData(interaction.guild, signinChannel, twitchChannel, limit);
      const {
        signedInUsers,
        twitchByUser,
        allLinks,
        looseLinks,
        signinsMissingTwitch,
        twitchWithoutSignin,
        signinMessagesScanned,
        twitchMessagesScanned
      } = data;

      const matchedCount = [...signedInUsers.keys()].filter(userId => twitchByUser.has(userId)).length;

      // Short notices in the scanned channels, as requested.
      const shortNotice = `✅ Signup check done. Checked ${signedInUsers.size} sign-ins. ${allLinks.size} Twitch links found. Missing: ${signinsMissingTwitch.length}. Details are in ${interaction.channel}.`;
      await sendChannelNotice(signinChannel, shortNotice);
      if (twitchChannel.id !== signinChannel.id) await sendChannelNotice(twitchChannel, shortNotice);

      // Main result goes publicly into the command channel. Only show problems, not the users that passed.
      const lines = [
        '**Signup Check**',
        `Checked ${signedInUsers.size} sign-ins.`,
        `${allLinks.size} Twitch streams/links are in the Twitch channel.`,
        `${matchedCount} are matched.`,
        `${signinsMissingTwitch.length} are missing.`,
        '',
        `Messages scanned: ${signinMessagesScanned} sign-in messages, ${twitchMessagesScanned} Twitch messages.`,
        '',
        '**Missing Twitch links:**'
      ];

      lines.push(...(signinsMissingTwitch.length ? signinsMissingTwitch.map(user => `❌ ${user}`) : ['✅ None']));

      if (twitchWithoutSignin.length) {
        lines.push('', '**Twitch registrations without sign-in:**');
        lines.push(...twitchWithoutSignin.map(entry => `⚠️ ${entry.user} → ${[...entry.links].map(l => `twitch.tv/${l}`).join(', ')}`));
      }

      if (looseLinks.size) {
        lines.push('', '**Twitch links not safely assigned to a Discord sign-in:**');
        lines.push(...[...looseLinks].map(link => `⚠️ twitch.tv/${link}`));
      }

      lines.push('', '**Expected Twitch channel format:** `DiscordName twitch.tv/twitchname` or `@DiscordName twitch.tv/twitchname`');
      return replyLong(interaction, '', lines, false);
    }

    if (interaction.commandName === 'checkstreamproof') {
      const signinChannel = validateTextChannel(interaction.options.getChannel('signin_channel'), 'sign-in channel');
      const twitchChannel = validateTextChannel(interaction.options.getChannel('twitch_channel'), 'Twitch channel');
      const hours = interaction.options.getInteger('hours') || 24;
      const limit = interaction.options.getInteger('limit') || 1000;

      const data = await buildSignupData(interaction.guild, signinChannel, twitchChannel, limit);
      const {
        signedInUsers,
        twitchByUser,
        allLinks,
        looseLinks,
        signinsMissingTwitch,
        twitchWithoutSignin,
        signinMessagesScanned,
        twitchMessagesScanned
      } = data;

      const matchedEntries = [...twitchByUser.values()].filter(entry => signedInUsers.has(entry.user.id));
      const usernamesToCheck = new Set();
      for (const entry of matchedEntries) {
        for (const link of entry.links) usernamesToCheck.add(link);
      }

      const results = await checkTwitchUsers([...usernamesToCheck], hours);

      const live = [];
      const vod = [];
      const none = [];
      const notFound = [];

      for (const entry of matchedEntries) {
        const links = [...entry.links];
        const statuses = links.map(link => ({ link, result: results.get(link) || { status: 'none' } }));

        const liveResult = statuses.find(item => item.result.status === 'live');
        const vodResult = statuses.find(item => item.result.status === 'vod');
        const notFoundOnly = statuses.every(item => item.result.status === 'not_found');

        if (liveResult) {
          live.push({ user: entry.user, link: liveResult.link });
        } else if (vodResult) {
          vod.push({ user: entry.user, link: vodResult.link, vodUrl: vodResult.result.vodUrl });
        } else if (notFoundOnly) {
          notFound.push({ user: entry.user, links });
        } else {
          none.push({ user: entry.user, links });
        }
      }

      const shortNotice = `✅ Post-cup stream proof check done. Checked ${signedInUsers.size} sign-ins. ${matchedEntries.length} Twitch registrations checked. Live: ${live.length}. VOD: ${vod.length}. No proof: ${none.length}. Details are in ${interaction.channel}.`;
      await sendChannelNotice(signinChannel, shortNotice);
      if (twitchChannel.id !== signinChannel.id) await sendChannelNotice(twitchChannel, shortNotice);

      const lines = [
        '**Post-Cup Stream Proof Check**',
        `Checked ${signedInUsers.size} sign-ins.`,
        `${allLinks.size} Twitch streams/links are in the Twitch channel.`,
        `${matchedEntries.length} signed-in players have a matched Twitch registration.`,
        `${signinsMissingTwitch.length} signed-in players are missing a Twitch registration.`,
        '',
        `Messages scanned: ${signinMessagesScanned} sign-in messages, ${twitchMessagesScanned} Twitch messages.`,
        `VOD lookback: last ${hours} hours.`,
        '',
        `🟢 Live now: ${live.length}`,
        `🟡 Recent VOD found: ${vod.length}`,
        `🔴 No stream proof found: ${none.length}`,
        `⚠️ Twitch user not found: ${notFound.length}`,
        ''
      ];

      lines.push('**Missing Twitch registrations:**');
      lines.push(...(signinsMissingTwitch.length ? signinsMissingTwitch.map(user => `❌ ${user}`) : ['✅ None']));

      lines.push('', '**LIVE NOW:**');
      lines.push(...(live.length ? live.map(item => `🟢 ${item.user} → twitch.tv/${item.link}`) : ['✅ None']));

      lines.push('', `**Recent VOD found, last ${hours}h:**`);
      lines.push(...(vod.length ? vod.map(item => `🟡 ${item.user} → twitch.tv/${item.link}${item.vodUrl ? ` | ${item.vodUrl}` : ''}`) : ['✅ None']));

      lines.push('', '**No stream proof found:**');
      lines.push(...(none.length ? none.map(item => `🔴 ${item.user} → ${item.links.map(link => `twitch.tv/${link}`).join(', ')}`) : ['✅ None']));

      lines.push('', '**Twitch user not found:**');
      lines.push(...(notFound.length ? notFound.map(item => `⚠️ ${item.user} → ${item.links.map(link => `twitch.tv/${link}`).join(', ')}`) : ['✅ None']));

      if (twitchWithoutSignin.length) {
        lines.push('', '**Twitch registrations without sign-in:**');
        lines.push(...twitchWithoutSignin.map(entry => `⚠️ ${entry.user} → ${[...entry.links].map(link => `twitch.tv/${link}`).join(', ')}`));
      }

      if (looseLinks.size) {
        lines.push('', '**Loose Twitch links not assigned to a Discord sign-in:**');
        lines.push(...[...looseLinks].map(link => `⚠️ twitch.tv/${link}`));
      }

      return replyLong(interaction, '', lines, false);
    }
  } catch (error) {
    console.error(error);
    const message = `Error: ${error.message}`;
    if (interaction.deferred || interaction.replied) return interaction.editReply(message).catch(() => {});
    return interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

registerCommands().then(() => client.login(TOKEN));
