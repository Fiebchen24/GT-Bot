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


function normalizeDiscordName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(gt|mask|penta|team|twitch|ttv|yt|youtube|live)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function getMemberMatchKeys(guild, user) {
  const keys = new Set();
  const add = value => {
    const key = normalizeDiscordName(value);
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

function linkMatchesKeys(twitchName, keys) {
  const tw = normalizeDiscordName(twitchName);
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
      const twitchByUser = new Map();
      const twitchLinksWithoutMention = new Set();
      const allTwitchLinks = new Set();

      // 1) Sign-in channel = truth for signed-in Discord users.
      for (const message of signinMessages) {
        for (const user of message.mentions.users.values()) {
          if (!user.bot) signedInUsers.set(user.id, user);
        }
      }

      // 2) Twitch channel preferred format: @DiscordUser twitch.tv/name
      for (const message of twitchMessages) {
        const links = extractTwitchLinks(message.content);
        if (links.length === 0) continue;

        links.forEach(link => allTwitchLinks.add(link));
        const users = [...message.mentions.users.values()].filter(user => !user.bot);

        if (users.length > 0) {
          for (const user of users) {
            // If one message has multiple users and links, we can only safely assign the first link to all.
            // For clean results, use one player per line/message: @User twitch.tv/name
            twitchByUser.set(user.id, { user, links });
          }
        } else {
          links.forEach(link => twitchLinksWithoutMention.add(link));
        }
      }

      // 3) Fallback: if Twitch link was posted without @User, try to match twitch name to Discord name.
      // Example: sign-in @HoldOn + twitch.tv/holdon52 -> matched because holdon52 contains holdon.
      const memberKeysByUser = new Map();
      for (const user of signedInUsers.values()) {
        memberKeysByUser.set(user.id, await getMemberMatchKeys(interaction.guild, user));
      }

      const inferredMatches = [];
      const stillUnassignedLinks = [];

      for (const link of twitchLinksWithoutMention) {
        const candidates = [];
        for (const [userId, user] of signedInUsers.entries()) {
          if (twitchByUser.has(userId)) continue;
          const keys = memberKeysByUser.get(userId) || [];
          if (linkMatchesKeys(link, keys)) candidates.push(user);
        }

        if (candidates.length === 1) {
          const user = candidates[0];
          twitchByUser.set(user.id, { user, links: [link], inferred: true });
          inferredMatches.push(`${user} → twitch.tv/${link}`);
        } else {
          stillUnassignedLinks.push({ link, candidates });
        }
      }

      const signinsMissingTwitch = [...signedInUsers.values()].filter(user => !twitchByUser.has(user.id));
      const twitchWithoutSignin = [...twitchByUser.values()].filter(entry => !signedInUsers.has(entry.user.id));

      const lines = [
        '**Twitch Signup Check**',
        `Sign-ins found: ${signedInUsers.size}`,
        `Twitch links found: ${allTwitchLinks.size}`,
        `Matched by @User: ${[...twitchByUser.values()].filter(x => !x.inferred).length}`,
        `Matched by name fallback: ${inferredMatches.length}`,
        `Sign-ins missing Twitch: ${signinsMissingTwitch.length}`,
        `Twitch registrations without sign-in: ${twitchWithoutSignin.length}`,
        `Unassigned Twitch links: ${stillUnassignedLinks.length}`,
        '',
        '**Sign-ins missing Twitch:**'
      ];

      if (signinsMissingTwitch.length === 0) lines.push('✅ None');
      else signinsMissingTwitch.forEach(user => lines.push(`❌ ${user}`));

      lines.push('', '**Matched by name fallback:**');
      if (inferredMatches.length === 0) lines.push('✅ None');
      else inferredMatches.forEach(item => lines.push(`🟡 ${item}`));

      lines.push('', '**Twitch registrations without sign-in:**');
      if (twitchWithoutSignin.length === 0) lines.push('✅ None');
      else twitchWithoutSignin.forEach(entry => lines.push(`⚠️ ${entry.user} → ${entry.links.map(l => `twitch.tv/${l}`).join(', ')}`));

      lines.push('', '**Twitch links posted without @User and not safely matched:**');
      if (stillUnassignedLinks.length === 0) lines.push('✅ None');
      else for (const item of stillUnassignedLinks) {
        const note = item.candidates.length > 1 ? `ambiguous: ${item.candidates.map(u => u.toString()).join(', ')}` : 'no matching sign-in name';
        lines.push(`⚠️ twitch.tv/${item.link} — ${note}`);
      }

      lines.push('', '**Tip:** best format in Twitch channel is `@Player twitch.tv/name`. Name fallback helps, but @User is always safer.');

      return replyLong(interaction, '', lines);
    }

    if (interaction.commandName === 'checkstreamproof') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const twitchChannel = interaction.options.getChannel('twitch_channel');
      const hours = interaction.options.getInteger('hours') || 24;
      const limit = interaction.options.getInteger('limit') || 100;
      const messages = await fetchMessages(twitchChannel, limit);
      const usernames = new Set();
      for (const message of messages) extractTwitchLinks(message.content).forEach(name => usernames.add(name));

      const results = await checkTwitchUsers([...usernames], hours);
      const live = [], vod = [], none = [], notFound = [];

      for (const name of usernames) {
        const result = results.get(name);
        if (!result || result.status === 'none') none.push(name);
        else if (result.status === 'live') live.push(name);
        else if (result.status === 'vod') vod.push(name);
        else if (result.status === 'not_found') notFound.push(name);
      }

      const lines = [
        '**Stream Proof Check**',
        `Twitch links checked: ${usernames.size}`,
        `Live now: ${live.length}`,
        `Recent VOD in last ${hours}h: ${vod.length}`,
        `No proof found: ${none.length}`,
        `Twitch user not found: ${notFound.length}`,
        '',
        '**LIVE NOW:**'
      ];
      lines.push(...(live.length ? live.map(n => `🟢 twitch.tv/${n}`) : ['✅ None']));
      lines.push('', `**Recent VOD found, last ${hours}h:**`);
      lines.push(...(vod.length ? vod.map(n => `🟡 twitch.tv/${n}`) : ['✅ None']));
      lines.push('', '**No stream proof found:**');
      lines.push(...(none.length ? none.map(n => `🔴 twitch.tv/${n}`) : ['✅ None']));
      lines.push('', '**Twitch user not found:**');
      lines.push(...(notFound.length ? notFound.map(n => `⚠️ twitch.tv/${n}`) : ['✅ None']));

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
