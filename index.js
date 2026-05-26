require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType
} = require("discord.js");

const config = require("./config.json");

const requiredEnv = ["TOKEN", "CLIENT_ID", "GUILD_ID"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
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
    .setName("giverolefromchannel")
    .setDescription("Gives a role to everyone mentioned in a selected channel.")
    .addChannelOption(option => option.setName("channel").setDescription("Channel to scan").setRequired(true))
    .addRoleOption(option => option.setName("role").setDescription("Role to give").setRequired(true))
    .addIntegerOption(option => option.setName("limit").setDescription("How many messages to scan, max 100").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("takerolefromchannel")
    .setDescription("Removes a role from everyone mentioned in a selected channel.")
    .addChannelOption(option => option.setName("channel").setDescription("Channel to scan").setRequired(true))
    .addRoleOption(option => option.setName("role").setDescription("Role to remove").setRequired(true))
    .addIntegerOption(option => option.setName("limit").setDescription("How many messages to scan, max 100").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("earningsroles")
    .setDescription("Updates earnings roles based on mentions and earnings numbers in a channel.")
    .addChannelOption(option => option.setName("channel").setDescription("Channel to scan").setRequired(true))
    .addIntegerOption(option => option.setName("limit").setDescription("How many messages to scan, max 100").setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("checktwitchsignins")
    .setDescription("Compares Twitch links with sign-ins and checks Twitch live/recent stream status.")
    .addChannelOption(option =>
      option
        .setName("twitch_channel")
        .setDescription("Channel containing the Twitch links to check")
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName("signins_channel")
        .setDescription("Channel containing the sign-ins")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("limit")
        .setDescription("How many messages per channel to scan, max 100")
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName("hours")
        .setDescription("Recent stream/VOD check window in hours, default 24")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered.");
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
}

function isTextChannel(channel) {
  return channel && [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.PublicThread,
    ChannelType.PrivateThread
  ].includes(channel.type);
}

async function fetchMessages(channel, limit) {
  if (!isTextChannel(channel)) throw new Error("Please select a text channel.");
  return channel.messages.fetch({ limit: Math.min(Math.max(limit || 100, 1), 100) });
}

function collectMentionedUserIds(messages) {
  const userIds = new Set();
  for (const message of messages.values()) {
    for (const user of message.mentions.users.values()) userIds.add(user.id);
  }
  return userIds;
}

function parseMoneyNumber(raw) {
  if (!raw) return null;
  let value = String(raw).trim().toLowerCase().replace(/[$€£]/g, "").replace(/\s/g, "");
  let multiplier = 1;
  if (value.endsWith("k")) {
    multiplier = 1000;
    value = value.slice(0, -1);
  }
  value = value.replace(/,/g, "");
  const number = Number(value);
  if (Number.isNaN(number)) return null;
  return Math.floor(number * multiplier);
}

function extractEarningsAfterMention(content, userId) {
  const regex = new RegExp(`<@!?${userId}>\\s*[$€£]?\\s*([0-9][0-9.,]*\\s*k?)`, "i");
  const match = content.match(regex);
  if (!match) return null;
  return parseMoneyNumber(match[1]);
}

function getEarningsRole(earnings) {
  const sortedRoles = [...config.earningsRoles].sort((a, b) => b.min - a.min);
  return sortedRoles.find(role => earnings >= role.min) || null;
}

function getAllEarningsRoleIds() {
  return config.earningsRoles.map(role => role.roleId).filter(Boolean);
}

async function giveOrTakeRoleFromChannel(interaction, mode) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel("channel");
  const role = interaction.options.getRole("role");
  const limit = interaction.options.getInteger("limit") || 100;

  try {
    const messages = await fetchMessages(channel, limit);
    const userIds = collectMentionedUserIds(messages);
    let added = 0, removed = 0, alreadyHad = 0, didNotHave = 0, failed = 0;

    for (const userId of userIds) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        const hasRole = member.roles.cache.has(role.id);
        if (mode === "give") {
          if (hasRole) { alreadyHad++; continue; }
          await member.roles.add(role);
          added++;
        } else {
          if (!hasRole) { didNotHave++; continue; }
          await member.roles.remove(role);
          removed++;
        }
      } catch (error) {
        console.error(`Failed to ${mode} role for ${userId}:`, error.message);
        failed++;
      }
    }

    if (mode === "give") {
      return interaction.editReply(`Done.\nRole: ${role}\nUsers found: ${userIds.size}\nNewly added: ${added}\nAlready had role: ${alreadyHad}\nFailed: ${failed}`);
    }
    return interaction.editReply(`Done.\nRole: ${role}\nUsers found: ${userIds.size}\nRemoved: ${removed}\nDid not have role: ${didNotHave}\nFailed: ${failed}`);
  } catch (error) {
    return interaction.editReply(`Error: ${error.message}`);
  }
}

async function updateEarningsRoles(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel("channel");
  const limit = interaction.options.getInteger("limit") || 100;
  const allEarningsRoleIds = getAllEarningsRoleIds();
  if (!allEarningsRoleIds.length) return interaction.editReply("No earnings roles are configured in config.json.");

  try {
    const messages = await fetchMessages(channel, limit);
    const latestByUser = new Map();
    const sortedMessages = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const message of sortedMessages) {
      for (const user of message.mentions.users.values()) {
        const earnings = extractEarningsAfterMention(message.content, user.id);
        if (earnings === null) continue;
        latestByUser.set(user.id, { userId: user.id, earnings });
      }
    }

    let updated = 0, unchanged = 0, skipped = 0, failed = 0;
    for (const entry of latestByUser.values()) {
      const roleData = getEarningsRole(entry.earnings);
      if (!roleData) { skipped++; continue; }
      try {
        const member = await interaction.guild.members.fetch(entry.userId);
        const currentEarningsRoles = allEarningsRoleIds.filter(roleId => member.roles.cache.has(roleId));
        const alreadyCorrect = currentEarningsRoles.length === 1 && currentEarningsRoles[0] === roleData.roleId;
        if (alreadyCorrect) { unchanged++; continue; }
        const rolesToRemove = currentEarningsRoles.filter(roleId => roleId !== roleData.roleId);
        if (rolesToRemove.length) await member.roles.remove(rolesToRemove);
        if (!member.roles.cache.has(roleData.roleId)) await member.roles.add(roleData.roleId);
        updated++;
      } catch (error) {
        console.error(`Failed to update earnings role for ${entry.userId}:`, error.message);
        failed++;
      }
    }

    return interaction.editReply(`Done.\nUsers with earnings found: ${latestByUser.size}\nUpdated: ${updated}\nAlready correct: ${unchanged}\nSkipped: ${skipped}\nFailed: ${failed}`);
  } catch (error) {
    return interaction.editReply(`Error: ${error.message}`);
  }
}

function normalizeTwitchName(name) {
  return String(name || "").trim().toLowerCase().replace(/^@/, "");
}

function extractTwitchNames(text) {
  const names = new Set();
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{3,25})(?:[/?#\s]|$)/gi,
    /(?:^|\s)twitch\.tv\/([a-zA-Z0-9_]{3,25})(?:[/?#\s]|$)/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const username = normalizeTwitchName(match[1]);
      if (!["directory", "videos", "settings", "p", "downloads", "jobs"].includes(username)) {
        names.add(username);
      }
    }
  }

  return [...names];
}

function collectTwitchNamesFromMessages(messages) {
  const result = new Map();
  const sortedMessages = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  for (const message of sortedMessages) {
    const twitchNames = extractTwitchNames(message.content);
    for (const twitchName of twitchNames) {
      if (!result.has(twitchName)) {
        result.set(twitchName, {
          twitchName,
          messageUrl: message.url,
          authorTag: message.author?.tag || "unknown"
        });
      }
    }
  }

  return result;
}

let twitchTokenCache = { token: null, expiresAt: 0 };

async function getTwitchToken() {
  if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in Render Environment Variables.");
  }

  if (twitchTokenCache.token && Date.now() < twitchTokenCache.expiresAt) {
    return twitchTokenCache.token;
  }

  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials"
  });

  const response = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, {
    method: "POST"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twitch auth failed: ${response.status} ${body}`);
  }

  const data = await response.json();
  twitchTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 120) * 1000
  };
  return twitchTokenCache.token;
}

async function twitchApi(path) {
  const token = await getTwitchToken();
  const response = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twitch API failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function getTwitchUsersByLogin(logins) {
  const users = new Map();
  const chunks = [];
  for (let i = 0; i < logins.length; i += 100) chunks.push(logins.slice(i, i + 100));

  for (const chunk of chunks) {
    const query = chunk.map(login => `login=${encodeURIComponent(login)}`).join("&");
    const data = await twitchApi(`/users?${query}`);
    for (const user of data.data || []) users.set(normalizeTwitchName(user.login), user);
  }

  return users;
}

async function getLiveStreamsByLogin(logins) {
  const streams = new Map();
  const chunks = [];
  for (let i = 0; i < logins.length; i += 100) chunks.push(logins.slice(i, i + 100));

  for (const chunk of chunks) {
    const query = chunk.map(login => `user_login=${encodeURIComponent(login)}`).join("&");
    const data = await twitchApi(`/streams?${query}`);
    for (const stream of data.data || []) streams.set(normalizeTwitchName(stream.user_login), stream);
  }

  return streams;
}

async function getRecentVideoForUser(userId, hours) {
  const data = await twitchApi(`/videos?user_id=${encodeURIComponent(userId)}&type=archive&first=5`);
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const videos = data.data || [];
  return videos.find(video => new Date(video.created_at).getTime() >= cutoff) || null;
}

function shortenList(items, max = 20) {
  if (!items.length) return "None";
  const visible = items.slice(0, max);
  const extra = items.length - visible.length;
  return visible.join("\n") + (extra > 0 ? `\n...and ${extra} more` : "");
}

async function checkTwitchSignins(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const twitchChannel = interaction.options.getChannel("twitch_channel");
  const signinsChannel = interaction.options.getChannel("signins_channel");
  const limit = interaction.options.getInteger("limit") || 100;
  const hours = interaction.options.getInteger("hours") || 24;

  try {
    const [twitchMessages, signinsMessages] = await Promise.all([
      fetchMessages(twitchChannel, limit),
      fetchMessages(signinsChannel, limit)
    ]);

    const twitchEntries = collectTwitchNamesFromMessages(twitchMessages);
    const signinEntries = collectTwitchNamesFromMessages(signinsMessages);

    const twitchNames = [...twitchEntries.keys()].sort();
    const signinNames = new Set([...signinEntries.keys()]);

    if (!twitchNames.length) {
      return interaction.editReply("No Twitch links found in the selected Twitch channel.");
    }

    const missingFromSignins = twitchNames.filter(name => !signinNames.has(name));
    const matched = twitchNames.filter(name => signinNames.has(name));

    const usersByLogin = await getTwitchUsersByLogin(twitchNames);
    const liveByLogin = await getLiveStreamsByLogin(twitchNames);

    const unknownAccounts = twitchNames.filter(name => !usersByLogin.has(name));
    const offlineNoRecent = [];
    const streamedRecent = [];
    const liveNow = [];

    for (const name of twitchNames) {
      const user = usersByLogin.get(name);
      if (!user) continue;

      const live = liveByLogin.get(name);
      if (live) {
        liveNow.push(`🟢 ${name} — LIVE now`);
        streamedRecent.push(name);
        continue;
      }

      const recentVideo = await getRecentVideoForUser(user.id, hours);
      if (recentVideo) {
        streamedRecent.push(name);
      } else {
        offlineNoRecent.push(`🔴 ${name}`);
      }
    }

    const response = [
      `Twitch Sign-In Check`,
      `Twitch links found: ${twitchNames.length}`,
      `Found in sign-ins: ${matched.length}`,
      `Missing from sign-ins: ${missingFromSignins.length}`,
      `Live now: ${liveNow.length}`,
      `Streamed/VOD in last ${hours}h: ${streamedRecent.length}`,
      `No live/recent VOD found: ${offlineNoRecent.length}`,
      "",
      `Missing from sign-ins:\n${shortenList(missingFromSignins.map(n => `❌ ${n}`), 25)}`,
      "",
      `Live now:\n${shortenList(liveNow, 15)}`,
      "",
      `No live/recent VOD found:\n${shortenList(offlineNoRecent, 25)}`,
      unknownAccounts.length ? `\nUnknown Twitch accounts:\n${shortenList(unknownAccounts.map(n => `⚠️ ${n}`), 15)}` : ""
    ].filter(Boolean).join("\n");

    return interaction.editReply(response.slice(0, 1900));
  } catch (error) {
    console.error("checktwitchsignins failed:", error);
    return interaction.editReply(`Error: ${error.message}`);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({ content: "You need Manage Roles permission to use this command.", ephemeral: true });
  }

  if (interaction.commandName === "giverolefromchannel") return giveOrTakeRoleFromChannel(interaction, "give");
  if (interaction.commandName === "takerolefromchannel") return giveOrTakeRoleFromChannel(interaction, "take");
  if (interaction.commandName === "earningsroles") return updateEarningsRoles(interaction);
  if (interaction.commandName === "checktwitchsignins") return checkTwitchSignins(interaction);
});

registerCommands();
client.login(process.env.TOKEN);
