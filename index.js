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
    .setName('voicechannelcreate')
    .setDescription('Creates a voice channel in a selected category.')
    .addChannelOption(option => option
      .setName('category')
      .setDescription('Category where the voice channel should be created')
      .addChannelTypes(ChannelType.GuildCategory)
      .setRequired(true))
    .addStringOption(option => option
      .setName('name')
      .setDescription('Name of the new voice channel')
      .setMaxLength(100)
      .setRequired(true))
    .addIntegerOption(option => option
      .setName('user_limit')
      .setDescription('Optional user limit. 0 = no limit')
      .setMinValue(0)
      .setMaxValue(99)
      .setRequired(false))
    .addIntegerOption(option => option
      .setName('amount')
      .setDescription('How many voice channels to create. Default 1, max 50')
      .setMinValue(1)
      .setMaxValue(50)
      .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('voicechanneldelete')
    .setDescription('Deletes a selected voice channel.')
    .addChannelOption(option => option
      .setName('voice_channel')
      .setDescription('Voice channel to delete')
      .addChannelTypes(ChannelType.GuildVoice)
      .setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

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
    .setDescription('After cup: checks Twitch links from one channel for live status or recent VODs.')
    .addChannelOption(option => option
      .setName('twitch_channel')
      .setDescription('Channel with Discord names + Twitch links')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setRequired(true))
    .addIntegerOption(option => option.setName('hours').setDescription('How many hours back to check VODs. Default 24').setMinValue(1).setMaxValue(168).setRequired(false))
    .addIntegerOption(scanLimitOption)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName('postcupcheck')
    .setDescription('After cup: checks only the Twitch link channel for live status or recent VODs.')
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
  console.log('GT Role Bot V6 command set active.');
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

function hasDiscordScreenshare(content) {
  return /\b(?:dc(?:\s*ss)?|discord\s*(?:ss|screen\s*share|screenshare))\b/i.test(String(content || ''));
}

function getDiscordScreenshareLabel(content) {
  return cleanRegistrationLabel(String(content || '').replace(/\b(?:dc(?:\s*ss)?|discord\s*(?:ss|screen\s*share|screenshare))\b/ig, '')) || 'Discord screenshare';
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


function extractTwitchLinkMatches(content) {
  const matches = [];
  const regex = /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{3,25})(?:[/?#\s]|$)/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = normalizeTwitchName(match[1]);
    if (name && !['directory', 'videos', 'settings', 'popout'].includes(name)) {
      matches.push({ name, index: match.index });
    }
  }
  return matches;
}

function cleanRegistrationLabel(value) {
  return String(value || '')
    .replace(/<@!?\d+>/g, '')
    .replace(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{3,25})(?:[/?#\s]|$)/gi, '')
    .replace(/[`*_~>|]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—:|•\s]+|[-–—:|•\s]+$/g, '')
    .trim();
}

async function buildTwitchProofData(twitchChannel, limit) {
  const twitchMessages = await fetchMessages(twitchChannel, limit);
  const registrations = new Map();
  const dcScreenshares = [];

  for (const message of twitchMessages) {
    const links = extractTwitchLinkMatches(message.content);
    const hasDcSs = hasDiscordScreenshare(message.content);
    if (!links.length && !hasDcSs) continue;

    const mentions = [...message.mentions.users.values()].filter(user => !user.bot);
    const mentionLabel = mentions.length ? mentions.map(user => `${user}`).join(', ') : null;

    for (const link of links) {
      if (!registrations.has(link.name)) {
        const beforeLink = message.content.slice(0, link.index);
        const textLabel = cleanRegistrationLabel(beforeLink) || cleanRegistrationLabel(message.content);
        registrations.set(link.name, {
          twitch: link.name,
          label: mentionLabel || textLabel || `twitch.tv/${link.name}`,
          messageUrl: message.url
        });
      }
    }

    if (hasDcSs && !links.length) {
      dcScreenshares.push({
        label: mentionLabel || getDiscordScreenshareLabel(message.content),
        messageUrl: message.url
      });
    }
  }

  return { registrations: [...registrations.values()], dcScreenshares, twitchMessagesScanned: twitchMessages.length };
}

function matchScore(twitchName, keys) {
  const tw = normalizeName(twitchName);
  if (tw.length < 3) return 0;

  let best = 0;
  for (const key of keys || []) {
    if (!key || key.length < 3) continue;
    if (tw === key) best = Math.max(best, 100);
    else if (tw.startsWith(key) || key.startsWith(tw)) best = Math.max(best, 85);
    else if (tw.includes(key) || key.includes(tw)) best = Math.max(best, 65);
  }
  return best;
}

function findBestUserForTwitch(twitchName, signedInUsers, keysByUser) {
  let bestUser = null;
  let bestScore = 0;
  let tied = false;

  for (const [userId, user] of signedInUsers.entries()) {
    const score = matchScore(twitchName, keysByUser.get(userId));
    if (score > bestScore) {
      bestUser = user;
      bestScore = score;
      tied = false;
    } else if (score > 0 && score === bestScore) {
      tied = true;
    }
  }

  // If two signed-in users match the same Twitch name equally, do not guess.
  if (!bestUser || bestScore < 65 || tied) return null;
  return bestUser;
}

function extractMentionIdsFromLine(line) {
  const ids = [];
  const regex = /<@!?(\d+)>/g;
  let match;
  while ((match = regex.exec(line)) !== null) ids.push(match[1]);
  return ids;
}

function buildSigninTeams(signinMessages) {
  const signedInUsers = new Map();
  const teams = [];
  const seenTeamKeys = new Set();

  for (const message of signinMessages) {
    const lines = String(message.content || '').split(/\r?\n/);

    for (const line of lines) {
      const ids = [...new Set(extractMentionIdsFromLine(line))];
      const users = ids
        .map(id => message.mentions.users.get(id))
        .filter(user => user && !user.bot);

      if (!users.length) continue;

      for (const user of users) signedInUsers.set(user.id, user);

      // One line = one team. For duos/trios/squads, only one player on the line needs proof.
      const teamKey = users.map(user => user.id).sort().join('-');
      if (!seenTeamKeys.has(teamKey)) {
        seenTeamKeys.add(teamKey);
        teams.push({ users, messageUrl: message.url, raw: line.trim() });
      }
    }
  }

  return { signedInUsers, teams };
}

function teamHasProof(team, twitchByUser) {
  return team.users.some(user => twitchByUser.has(user.id));
}

function formatTeam(team) {
  return team.users.map(user => `${user}`).join(' + ');
}

async function buildSignupData(guild, signinChannel, twitchChannel, limit) {
  const signinMessages = await fetchMessages(signinChannel, limit);
  const twitchMessages = await fetchMessages(twitchChannel, limit);

  const { signedInUsers, teams: signinTeams } = buildSigninTeams(signinMessages);
  const twitchByUser = new Map();
  const looseLinks = new Set();
  const allLinks = new Set();
  const nameMatched = [];
  const dcScreenshares = [];
  const looseDcScreenshares = [];

  // Keys for matching @DiscordName to twitch.tv/name or plain "DiscordName DC ss".
  const keysByUser = new Map();
  for (const user of signedInUsers.values()) {
    keysByUser.set(user.id, await getMemberKeys(guild, user));
  }

  for (const message of twitchMessages) {
    const links = extractTwitchLinks(message.content);
    const hasDcSs = hasDiscordScreenshare(message.content);
    if (!links.length && !hasDcSs) continue;

    links.forEach(link => allLinks.add(link));

    const mentionedUsers = [...message.mentions.users.values()].filter(user => !user.bot);
    const mentionedSignedInUsers = mentionedUsers.filter(user => signedInUsers.has(user.id));

    // Discord screenshare is allowed instead of a Twitch link.
    // Examples supported in the Twitch channel:
    // @Player DC
    // @Player DC ss
    // PlayerName DC
    // PlayerName DC ss
    // PlayerName discord screenshare
    if (hasDcSs) {
      let ssMatchedUsers = mentionedSignedInUsers;

      if (!ssMatchedUsers.length) {
        ssMatchedUsers = findNamedSignedInUsers(message.content, signedInUsers, keysByUser);
      }

      if (ssMatchedUsers.length) {
        for (const user of ssMatchedUsers) {
          addUniqueMap(twitchByUser, user, 'DC SS');
          dcScreenshares.push({ user, label: getDiscordScreenshareLabel(message.content) });
        }
      } else {
        looseDcScreenshares.push(getDiscordScreenshareLabel(message.content));
      }
    }

    for (const link of links) {
      let matchedUsers = [];

      // Best case: Twitch channel line contains @DiscordName twitch.tv/name.
      // Only count mentioned users that are actually signed in.
      if (mentionedSignedInUsers.length) {
        matchedUsers = mentionedSignedInUsers;
      }

      // Main requested logic: sign-in is @name, Twitch link has name after .tv/name.
      // Match the Twitch username against signed-in Discord display/user/server names.
      if (!matchedUsers.length) {
        const bestUser = findBestUserForTwitch(link, signedInUsers, keysByUser);
        if (bestUser) {
          matchedUsers = [bestUser];
          nameMatched.push({ user: bestUser, link });
        }
      }

      if (matchedUsers.length) {
        for (const user of matchedUsers) addUniqueMap(twitchByUser, user, link);
      } else {
        looseLinks.add(link);
      }
    }
  }

  const teamsMissingTwitch = signinTeams.filter(team => !teamHasProof(team, twitchByUser));
  const matchedTeams = signinTeams.filter(team => teamHasProof(team, twitchByUser));
  const signinsMissingTwitch = [...signedInUsers.values()].filter(user => !twitchByUser.has(user.id));
  const twitchWithoutSignin = [...twitchByUser.values()].filter(entry => !signedInUsers.has(entry.user.id));

  return {
    signedInUsers,
    signinTeams,
    matchedTeams,
    teamsMissingTwitch,
    twitchByUser,
    allLinks,
    looseLinks,
    nameMatched,
    dcScreenshares,
    looseDcScreenshares,
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
  console.log('GT ROLE BOT V6.2 LOADED');
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

  const shouldReplyPublic = ['checksignup', 'checkstreamproof', 'postcupcheck'].includes(interaction.commandName);

  try {
    // Discord requires an acknowledgement within about 3 seconds. Do this first,
    // before scans, API calls, or any heavy work.
    const deferOptions = shouldReplyPublic ? {} : { flags: MessageFlags.Ephemeral };
    await interaction.deferReply(deferOptions);
  } catch (error) {
    console.error('Failed to defer interaction:', error);
    return;
  }

  const channelManagementCommands = ['voicechannelcreate', 'voicechanneldelete'];
  const needsManageChannels = channelManagementCommands.includes(interaction.commandName);
  const requiredPermission = needsManageChannels ? PermissionFlagsBits.ManageChannels : PermissionFlagsBits.ManageRoles;
  const requiredPermissionName = needsManageChannels ? 'Manage Channels' : 'Manage Roles';

  if (!interaction.member.permissions.has(requiredPermission)) {
    return interaction.editReply(`You need ${requiredPermissionName} permission to use this command.`);
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


    if (interaction.commandName === 'voicechannelcreate') {
      const category = interaction.options.getChannel('category');
      const name = interaction.options.getString('name', true).trim();
      const userLimit = interaction.options.getInteger('user_limit') ?? 0;
      const amount = interaction.options.getInteger('amount') ?? 1;

      if (!category || category.type !== ChannelType.GuildCategory) {
        return interaction.editReply('Error: Please select a valid category.');
      }

      if (!name) {
        return interaction.editReply('Error: Please enter a valid channel name.');
      }

      const createdChannels = [];
      const failedChannels = [];

      for (let i = 1; i <= amount; i++) {
        const channelName = amount === 1 ? name : `${name} ${i}`;

        try {
          const created = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildVoice,
            parent: category.id,
            userLimit,
            reason: `Created by ${interaction.user.tag} using /voicechannelcreate`
          });

          createdChannels.push(created);
        } catch (error) {
          console.error(`Failed to create voice channel ${channelName}:`, error);
          failedChannels.push(channelName);
        }
      }

      const createdList = createdChannels.map(channel => `✅ ${channel}`).join('
') || 'None';
      const failedList = failedChannels.map(channelName => `❌ ${channelName}`).join('
') || 'None';

      const response = [
        `Voice channels requested: ${amount}`,
        `Created: ${createdChannels.length}`,
        `Failed: ${failedChannels.length}`,
        `Category: ${category.name}`,
        `User limit: ${userLimit === 0 ? 'No limit' : userLimit}`,
        '',
        'Created channels:',
        createdList
      ];

      if (failedChannels.length > 0) {
        response.push('', 'Failed channels:', failedList);
      }

      return sendLongInteractionReply(interaction, response.join('
'));
    }

    if (interaction.commandName === 'voicechanneldelete') {
      const voiceChannel = interaction.options.getChannel('voice_channel');

      if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
        return interaction.editReply('Error: Please select a valid voice channel.');
      }

      const channelName = voiceChannel.name;
      await voiceChannel.delete(`Deleted by ${interaction.user.tag} using /voicechanneldelete`);

      return interaction.editReply(`✅ Voice channel deleted: ${channelName}`);
    }

    if (interaction.commandName === 'checksignup') {
      const signinChannel = validateTextChannel(interaction.options.getChannel('signin_channel'), 'sign-in channel');
      const twitchChannel = validateTextChannel(interaction.options.getChannel('twitch_channel'), 'Twitch channel');
      const limit = interaction.options.getInteger('limit') || 1000;

      const data = await buildSignupData(interaction.guild, signinChannel, twitchChannel, limit);
      const {
        signedInUsers,
        signinTeams,
        matchedTeams,
        teamsMissingTwitch,
        twitchByUser,
        allLinks,
        looseLinks,
        dcScreenshares,
        looseDcScreenshares,
        twitchWithoutSignin,
        signinMessagesScanned,
        twitchMessagesScanned
      } = data;

      const matchedCount = matchedTeams.length;
      const totalPlayers = signedInUsers.size;

      // Short notices in the scanned channels, as requested.
      const shortNotice = `✅ Signup check done. Checked ${signinTeams.length} teams / ${totalPlayers} players. ${allLinks.size} Twitch links + ${dcScreenshares.length} DC SS found. Missing teams: ${teamsMissingTwitch.length}. Details are in ${interaction.channel}.`;
      await sendChannelNotice(signinChannel, shortNotice);
      if (twitchChannel.id !== signinChannel.id) await sendChannelNotice(twitchChannel, shortNotice);

      // Main result goes publicly into the command channel. Only show problems, not the users that passed.
      const lines = [
        '**Signup Check**',
        `Checked ${signinTeams.length} sign-in teams / ${totalPlayers} players.`,
        `${allLinks.size} Twitch streams/links are in the Twitch channel.`,
        `${dcScreenshares.length} Discord screenshares are counted.`,
        `${matchedCount} teams are matched.`,
        `${teamsMissingTwitch.length} teams are missing proof.`,
        '',
        `Messages scanned: ${signinMessagesScanned} sign-in messages, ${twitchMessagesScanned} Twitch messages.`,
        '',
        '**Missing Twitch links:**'
      ];

      lines.push(...(teamsMissingTwitch.length ? teamsMissingTwitch.map(team => `❌ ${formatTeam(team)}`) : ['✅ None']));

      if (twitchWithoutSignin.length) {
        lines.push('', '**Twitch registrations without sign-in:**');
        lines.push(...twitchWithoutSignin.map(entry => `⚠️ ${entry.user} → ${[...entry.links].map(l => `twitch.tv/${l}`).join(', ')}`));
      }

      if (looseLinks.size) {
        lines.push('', '**Twitch links not safely assigned to a Discord sign-in:**');
        lines.push(...[...looseLinks].map(link => `⚠️ twitch.tv/${link}`));
      }

      if (looseDcScreenshares.length) {
        lines.push('', '**DC SS entries not safely assigned to a Discord sign-in:**');
        lines.push(...looseDcScreenshares.map(label => `⚠️ ${label} → DC SS`));
      }

      lines.push('', '**Matching rule:** One sign-in line = one team. If several players are in one line, only one player from that team needs a Twitch link or `DC` / `DC ss`. Twitch proof is matched by the name after `twitch.tv/name`.');
      return replyLong(interaction, '', lines, false);
    }

    if (interaction.commandName === 'checkstreamproof' || interaction.commandName === 'postcupcheck') {
      const twitchChannel = validateTextChannel(interaction.options.getChannel('twitch_channel'), 'Twitch channel');
      const hours = interaction.options.getInteger('hours') || 24;
      const limit = interaction.options.getInteger('limit') || 1000;

      const { registrations, dcScreenshares, twitchMessagesScanned } = await buildTwitchProofData(twitchChannel, limit);
      const usernamesToCheck = registrations.map(entry => entry.twitch);
      const results = await checkTwitchUsers(usernamesToCheck, hours);

      const live = [];
      const vod = [];
      const none = [];
      const notFound = [];

      for (const entry of registrations) {
        const result = results.get(entry.twitch) || { status: 'none' };
        if (result.status === 'live') live.push(entry);
        else if (result.status === 'vod') vod.push({ ...entry, vodUrl: result.vodUrl });
        else if (result.status === 'not_found') notFound.push(entry);
        else none.push(entry);
      }

      const shortNotice = `✅ Post-cup stream proof check done. Checked ${registrations.length} Twitch links + ${dcScreenshares.length} DC SS entries. Live: ${live.length}. VOD: ${vod.length}. No proof: ${none.length}. Details are in ${interaction.channel}.`;
      await sendChannelNotice(twitchChannel, shortNotice);

      const lines = [
        '**Post-Cup Stream Proof Check**',
        `Checked ${registrations.length} Twitch links + ${dcScreenshares.length} DC SS entries from ${twitchChannel}.`,
        `Messages scanned: ${twitchMessagesScanned}.`,
        `VOD lookback: last ${hours} hours.`,
        '',
        `🟢 Live now: ${live.length}`,
        `🟡 Recent VOD found: ${vod.length}`,
        `🔴 No stream proof found: ${none.length}`,
        `⚠️ Twitch user not found: ${notFound.length}`,
        `🟣 Discord screenshare/manual proof: ${dcScreenshares.length}`,
        ''
      ];

      lines.push('**LIVE NOW:**');
      lines.push(...(live.length ? live.map(item => `🟢 ${item.label} → twitch.tv/${item.twitch}`) : ['✅ None']));

      lines.push('', `**Recent VOD found, last ${hours}h:**`);
      lines.push(...(vod.length ? vod.map(item => `🟡 ${item.label} → twitch.tv/${item.twitch}${item.vodUrl ? ` | ${item.vodUrl}` : ''}`) : ['✅ None']));

      lines.push('', '**Discord screenshare/manual proof:**');
      lines.push(...(dcScreenshares.length ? dcScreenshares.map(item => `🟣 ${item.label} → DC SS`) : ['✅ None']));

      lines.push('', '**No stream proof found:**');
      lines.push(...(none.length ? none.map(item => `🔴 ${item.label} → twitch.tv/${item.twitch}`) : ['✅ None']));

      lines.push('', '**Twitch user not found:**');
      lines.push(...(notFound.length ? notFound.map(item => `⚠️ ${item.label} → twitch.tv/${item.twitch}`) : ['✅ None']));

      lines.push('', '**Matching rule:** Twitch proof is matched by the name after `twitch.tv/name`. `DC` / `DC` / `DC ss` / `Discord screenshare` counts as manual proof.');
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
