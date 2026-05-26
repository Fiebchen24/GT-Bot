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

const commands = [
  new SlashCommandBuilder()
    .setName('giverolefromchannel')
    .setDescription('Gives a role to everyone mentioned in a selected channel.')
    .addChannelOption(textChannelOption)
    .addRoleOption(option => option.setName('role').setDescription('Role to give').setRequired(true))
    .addIntegerOption(option => option.setName('limit').setDescription('Messages to scan, max 100').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('takerolefromchannel')
    .setDescription('Removes a role from everyone mentioned in a selected channel.')
    .addChannelOption(textChannelOption)
    .addRoleOption(option => option.setName('role').setDescription('Role to remove').setRequired(true))
    .addIntegerOption(option => option.setName('limit').setDescription('Messages to scan, max 100').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('earningsroles')
    .setDescription('Updates earnings roles based on mentions and earnings numbers in a channel.')
    .addChannelOption(textChannelOption)
    .addIntegerOption(option => option.setName('limit').setDescription('Messages to scan, max 100').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('checksignup')
    .setDescription('Before cup: checks if sign-ins have Twitch links and compares with Twitch link channel.')
    .addChannelOption(option => option
      .setName('signin_channel')
      .setDescription('Channel with sign-ins / Discord mentions')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addChannelOption(option => option
      .setName('twitch_channel')
      .setDescription('Channel with Twitch links')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addIntegerOption(option => option.setName('limit').setDescription('Messages to scan per channel, max 100').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('checkstreamproof')
    .setDescription('After cup: checks Twitch links for live status or recent VODs.')
    .addChannelOption(option => option
      .setName('twitch_channel')
      .setDescription('Channel with Twitch links')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addIntegerOption(option => option.setName('hours').setDescription('How many hours back to check VODs. Default 24').setRequired(false))
    .addIntegerOption(option => option.setName('limit').setDescription('Messages to scan, max 100').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Slash commands registered.');
}

function normalizeTwitchName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '')
    .trim();
}

function extractTwitchLinks(content) {
  const found = new Set();
  const regex = /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{3,25})(?:[/?#\s]|$)/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = normalizeTwitchName(match[1]);
    if (name && !['directory', 'videos', 'settings'].includes(name)) found.add(name);
  }
  return [...found];
}


function parseTwitchRegistrations(messages) {
  const byUserId = new Map();
  const unassignedLinks = new Set();

  for (const message of messages) {
    const usersById = message.mentions.users;
    const lines = String(message.content || '').split(/\r?\n/);
    let messageHadPairedLine = false;

    for (const line of lines) {
      const links = extractTwitchLinks(line);
      if (links.length === 0) continue;

      const mentionIds = [...line.matchAll(/<@!?(\d+)>/g)].map(match => match[1]);
      const validUsers = mentionIds
        .map(id => usersById.get(id))
        .filter(user => user && !user.bot);

      if (validUsers.length === 0) {
        links.forEach(link => unassignedLinks.add(link));
        continue;
      }

      messageHadPairedLine = true;
      validUsers.forEach((user, index) => {
        const link = links[index] || links[0];
        if (!byUserId.has(user.id)) byUserId.set(user.id, { user, links: new Set() });
        byUserId.get(user.id).links.add(link);
      });
    }

    if (!messageHadPairedLine) {
      const links = extractTwitchLinks(message.content);
      const validUsers = [...message.mentions.users.values()].filter(user => !user.bot);

      if (links.length > 0 && validUsers.length > 0) {
        validUsers.forEach((user, index) => {
          const link = links[index] || links[0];
          if (!byUserId.has(user.id)) byUserId.set(user.id, { user, links: new Set() });
          byUserId.get(user.id).links.add(link);
        });
      }
    }
  }

  return {
    byUserId,
    unassignedLinks: [...unassignedLinks]
  };
}

function registrationsToTwitchEntries(registrations) {
  const entries = [];
  for (const registration of registrations.byUserId.values()) {
    for (const twitchName of registration.links) {
      entries.push({ user: registration.user, twitchName });
    }
  }
  for (const twitchName of registrations.unassignedLinks) {
    entries.push({ user: null, twitchName });
  }
  return entries;
}

async function fetchMessages(channel, limit = 100) {
  const messages = await channel.messages.fetch({ limit: Math.min(Math.max(limit, 1), 100) });
  return [...messages.values()].reverse();
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

function chunkLines(title, lines, maxLength = 1850) {
  const chunks = [];
  let current = title ? `${title}\n` : '';

  for (const line of lines) {
    const next = current + line + '\n';
    if (next.length > maxLength) {
      chunks.push(current.trim());
      current = line + '\n';
    } else {
      current = next;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function replyLong(interaction, title, lines) {
  const chunks = chunkLines(title, lines);
  if (chunks.length === 0) return interaction.editReply('No result.');
  await interaction.editReply(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp({ content: chunks[i], flags: MessageFlags.Ephemeral });
  }
}

async function getTwitchToken() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) throw new Error('Missing Twitch API credentials.');

  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, {
    method: 'POST'
  });

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
    for (const user of usersData.data || []) {
      loginToUser.set(user.login.toLowerCase(), user);
    }

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

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: 'You need Manage Roles permission to use this command.', flags: MessageFlags.Ephemeral });
  }

  try {
    if (interaction.commandName === 'giverolefromchannel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const limit = interaction.options.getInteger('limit') || 100;
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
      return interaction.editReply(`Success\nRole: ${role}\nUsers found: ${userIds.size}\nNewly added: ${added}\nAlready had role: ${already}\nFailed: ${failed}`);
    }

    if (interaction.commandName === 'takerolefromchannel') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const limit = interaction.options.getInteger('limit') || 100;
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
      return interaction.editReply(`Success\nRole: ${role}\nUsers found: ${userIds.size}\nRemoved: ${removed}\nDid not have role: ${didNotHave}\nFailed: ${failed}`);
    }

    if (interaction.commandName === 'earningsroles') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const channel = interaction.options.getChannel('channel');
      const limit = interaction.options.getInteger('limit') || 100;
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

      return interaction.editReply(`Done.\nUpdated: ${updated}\nAlready correct: ${alreadyCorrect}\nSkipped: ${skipped}\nFailed: ${failed}`);
    }

    if (interaction.commandName === 'checksignup') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const signinChannel = interaction.options.getChannel('signin_channel');
      const twitchChannel = interaction.options.getChannel('twitch_channel');
      const limit = interaction.options.getInteger('limit') || 100;

      const signinMessages = await fetchMessages(signinChannel, limit);
      const twitchMessages = await fetchMessages(twitchChannel, limit);

      const signedInUsers = new Map();
      for (const message of signinMessages) {
        for (const user of message.mentions.users.values()) {
          if (!user.bot) signedInUsers.set(user.id, user);
        }
      }

      const registrations = parseTwitchRegistrations(twitchMessages);
      const linkedUsers = registrations.byUserId;

      const missingTwitch = [...signedInUsers.values()].filter(user => !linkedUsers.has(user.id));
      const extraTwitch = [...linkedUsers.values()].filter(entry => !signedInUsers.has(entry.user.id));
      const validLinked = [...linkedUsers.values()].filter(entry => signedInUsers.has(entry.user.id));

      const lines = [
        '**Twitch Signup Check**',
        `Sign-ins found: ${signedInUsers.size}`,
        `Twitch registrations with @User: ${linkedUsers.size}`,
        `Valid sign-ins with Twitch: ${validLinked.length}`,
        `Missing Twitch link: ${missingTwitch.length}`,
        `Twitch registrations without sign-in: ${extraTwitch.length}`,
        `Twitch links without @User: ${registrations.unassignedLinks.length}`,
        '',
        '**Missing Twitch link:**'
      ];

      if (missingTwitch.length === 0) lines.push('✅ None');
      else for (const user of missingTwitch) lines.push(`❌ ${user}`);

      lines.push('', '**Twitch registrations without sign-in:**');
      if (extraTwitch.length === 0) lines.push('✅ None');
      else for (const entry of extraTwitch) lines.push(`⚠️ ${entry.user} → twitch.tv/${[...entry.links].join(', twitch.tv/')}`);

      lines.push('', '**Twitch links posted without @User:**');
      if (registrations.unassignedLinks.length === 0) lines.push('✅ None');
      else for (const name of registrations.unassignedLinks) lines.push(`⚠️ twitch.tv/${name}`);

      return replyLong(interaction, '', lines);
    }

    if (interaction.commandName === 'checkstreamproof') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const twitchChannel = interaction.options.getChannel('twitch_channel');
      const hours = interaction.options.getInteger('hours') || 24;
      const limit = interaction.options.getInteger('limit') || 100;
      const messages = await fetchMessages(twitchChannel, limit);

      const registrations = parseTwitchRegistrations(messages);
      const entries = registrationsToTwitchEntries(registrations);
      const usernames = [...new Set(entries.map(entry => entry.twitchName))];

      const results = await checkTwitchUsers(usernames, hours);
      const live = [], vod = [], none = [], notFound = [];

      for (const entry of entries) {
        const result = results.get(entry.twitchName);
        const label = entry.user ? `${entry.user} → twitch.tv/${entry.twitchName}` : `twitch.tv/${entry.twitchName}`;
        if (!result || result.status === 'none') none.push(label);
        else if (result.status === 'live') live.push(label);
        else if (result.status === 'vod') vod.push(label);
        else if (result.status === 'not_found') notFound.push(label);
      }

      const lines = [
        '**Stream Proof Check**',
        `Twitch accounts checked: ${usernames.length}`,
        `Linked Discord users: ${registrations.byUserId.size}`,
        `Links without @User: ${registrations.unassignedLinks.length}`,
        `Live now: ${live.length}`,
        `Recent VOD in last ${hours}h: ${vod.length}`,
        `No proof found: ${none.length}`,
        `Twitch user not found: ${notFound.length}`,
        '',
        '**LIVE NOW:**'
      ];
      lines.push(...(live.length ? live.map(n => `🟢 ${n}`) : ['✅ None']));
      lines.push('', `**Recent VOD found, last ${hours}h:**`);
      lines.push(...(vod.length ? vod.map(n => `🟡 ${n}`) : ['✅ None']));
      lines.push('', '**No stream proof found:**');
      lines.push(...(none.length ? none.map(n => `🔴 ${n}`) : ['✅ None']));
      lines.push('', '**Twitch user not found:**');
      lines.push(...(notFound.length ? notFound.map(n => `⚠️ ${n}`) : ['✅ None']));

      return replyLong(interaction, '', lines);
    }
  } catch (error) {
    console.error(error);
    const message = `Error: ${error.message}`;
    if (interaction.deferred || interaction.replied) return interaction.editReply(message).catch(() => {});
    return interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

registerCommands().then(() => client.login(TOKEN));
