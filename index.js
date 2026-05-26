require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags
} = require("discord.js");

const config = require("./config.json");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const TOKEN = process.env.TOKEN || process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("Missing TOKEN, CLIENT_ID or GUILD_ID in environment variables.");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("giverolefromchannel")
    .setDescription("Gives a role to everyone mentioned in a selected channel.")
    .addChannelOption(option =>
      option.setName("channel").setDescription("Channel to scan").setRequired(true)
    )
    .addRoleOption(option =>
      option.setName("role").setDescription("Role to give").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("limit").setDescription("Messages to scan, max 1000").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("takerolefromchannel")
    .setDescription("Removes a role from everyone mentioned in a selected channel.")
    .addChannelOption(option =>
      option.setName("channel").setDescription("Channel to scan").setRequired(true)
    )
    .addRoleOption(option =>
      option.setName("role").setDescription("Role to remove").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("limit").setDescription("Messages to scan, max 1000").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("earningsroles")
    .setDescription("Updates earnings roles from mentions and earnings numbers.")
    .addChannelOption(option =>
      option.setName("channel").setDescription("Channel to scan").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("limit").setDescription("Messages to scan, max 1000").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("checksignup")
    .setDescription("Checks if signed-in players have Twitch links.")
    .addChannelOption(option =>
      option.setName("signup_channel").setDescription("Channel with sign-ins").setRequired(true)
    )
    .addChannelOption(option =>
      option.setName("twitch_channel").setDescription("Channel with Twitch links").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("limit").setDescription("Messages to scan, max 1000").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("checkstreamproof")
    .setDescription("Checks if Twitch channels are live or have recent VODs.")
    .addChannelOption(option =>
      option.setName("twitch_channel").setDescription("Channel with Twitch links").setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName("hours").setDescription("How many hours back to check VODs").setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName("limit").setDescription("Messages to scan, max 1000").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
  console.log("Slash commands registered.");
}

async function fetchMessages(channel, limit = 1000) {
  const finalLimit = Math.min(Math.max(limit, 1), 1000);
  let messages = [];
  let lastId = null;

  while (messages.length < finalLimit) {
    const fetchLimit = Math.min(100, finalLimit - messages.length);

    const options = { limit: fetchLimit };
    if (lastId) options.before = lastId;

    const batch = await channel.messages.fetch(options);
    if (!batch.size) break;

    messages.push(...batch.values());
    lastId = batch.last().id;

    if (batch.size < fetchLimit) break;
  }

  return messages;
}

function splitText(text, maxLength = 1800) {
  const lines = text.split("\n");
  const chunks = [];
  let current = "";

  for (const line of lines) {
    if ((current + "\n" + line).length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current += current ? `\n${line}` : line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function replyLong(interaction, text) {
  const chunks = splitText(text);

  await interaction.editReply(chunks.shift() || "No result.");

  for (const chunk of chunks) {
    await interaction.followUp({
      content: chunk,
      flags: MessageFlags.Ephemeral
    });
  }
}

function extractTwitchLinks(content) {
  const regex = /(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)/gi;
  const links = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const username = match[1].toLowerCase();

    if (
      username &&
      !["directory", "videos", "settings", "subscriptions", "login", "signup"].includes(username)
    ) {
      links.push(username);
    }
  }

  return links;
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function extractEarningsAfterMention(content, userId) {
  const mentionRegex = new RegExp(`<@!?${userId}>\\s*\\$?([\\d.,]+)`, "i");
  const match = content.match(mentionRegex);

  if (!match) return null;

  const cleaned = match[1].replace(/,/g, "").replace(/\./g, "");
  const earnings = parseInt(cleaned, 10);

  return Number.isNaN(earnings) ? null : earnings;
}

function getEarningsRole(earnings) {
  const sortedRoles = [...config.earningsRoles].sort((a, b) => b.min - a.min);
  return sortedRoles.find(role => earnings >= role.min);
}

function collectMentions(messages) {
  const userIds = new Set();

  for (const message of messages) {
    for (const user of message.mentions.users.values()) {
      userIds.add(user.id);
    }
  }

  return userIds;
}

function collectSignupUsers(messages) {
  const users = new Map();

  for (const message of messages) {
    for (const user of message.mentions.users.values()) {
      users.set(user.id, user);
    }
  }

  return users;
}

function collectTwitchRegistrations(messages, signupUsers) {
  const linkedByUserId = new Map();
  const looseLinks = new Set();

  for (const message of messages) {
    const links = extractTwitchLinks(message.content);
    if (!links.length) continue;

    const mentionedUsers = [...message.mentions.users.values()];

    if (mentionedUsers.length > 0) {
      for (let i = 0; i < mentionedUsers.length; i++) {
        const user = mentionedUsers[i];
        const twitchName = links[i] || links[0];

        linkedByUserId.set(user.id, {
          user,
          twitchName
        });
      }
    } else {
      for (const link of links) {
        looseLinks.add(link);
      }
    }
  }

  const usedLooseLinks = new Set();

  for (const [userId, user] of signupUsers.entries()) {
    if (linkedByUserId.has(userId)) continue;

    const possibleNames = [
      normalizeName(user.username),
      normalizeName(user.globalName || ""),
      normalizeName(user.displayName || "")
    ].filter(Boolean);

    for (const twitchName of looseLinks) {
      const cleanTwitch = normalizeName(twitchName);

      if (
        possibleNames.some(name =>
          cleanTwitch.includes(name) || name.includes(cleanTwitch)
        )
      ) {
        linkedByUserId.set(userId, {
          user,
          twitchName,
          fallback: true
        });

        usedLooseLinks.add(twitchName);
        break;
      }
    }
  }

  for (const used of usedLooseLinks) {
    looseLinks.delete(used);
  }

  return {
    linkedByUserId,
    looseLinks
  };
}

let twitchTokenCache = {
  token: null,
  expiresAt: 0
};

async function getTwitchToken() {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in Render Environment.");
  }

  if (twitchTokenCache.token && Date.now() < twitchTokenCache.expiresAt) {
    return twitchTokenCache.token;
  }

  const url =
    `https://id.twitch.tv/oauth2/token` +
    `?client_id=${TWITCH_CLIENT_ID}` +
    `&client_secret=${TWITCH_CLIENT_SECRET}` +
    `&grant_type=client_credentials`;

  const res = await fetch(url, { method: "POST" });

  if (!res.ok) {
    throw new Error(`Twitch token error: ${res.status}`);
  }

  const data = await res.json();

  twitchTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000
  };

  return twitchTokenCache.token;
}

async function twitchApi(path) {
  const token = await getTwitchToken();

  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      "Client-ID": TWITCH_CLIENT_ID,
      "Authorization": `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`Twitch API error: ${res.status}`);
  }

  return res.json();
}

async function getTwitchUsers(usernames) {
  const clean = [...new Set(usernames.map(u => u.toLowerCase()))].filter(Boolean);
  const result = new Map();

  for (let i = 0; i < clean.length; i += 100) {
    const chunk = clean.slice(i, i + 100);
    const query = chunk.map(name => `login=${encodeURIComponent(name)}`).join("&");

    const data = await twitchApi(`/users?${query}`);

    for (const user of data.data || []) {
      result.set(user.login.toLowerCase(), user);
    }
  }

  return result;
}

async function getLiveStreams(usernames) {
  const clean = [...new Set(usernames.map(u => u.toLowerCase()))].filter(Boolean);
  const result = new Map();

  for (let i = 0; i < clean.length; i += 100) {
    const chunk = clean.slice(i, i + 100);
    const query = chunk.map(name => `user_login=${encodeURIComponent(name)}`).join("&");

    const data = await twitchApi(`/streams?${query}`);

    for (const stream of data.data || []) {
      result.set(stream.user_login.toLowerCase(), stream);
    }
  }

  return result;
}

async function getRecentVideos(userIds, hoursBack) {
  const result = new Map();
  const since = Date.now() - hoursBack * 60 * 60 * 1000;

  for (const user of userIds) {
    const data = await twitchApi(`/videos?user_id=${user.id}&type=archive&first=5`);

    const recent = (data.data || []).find(video => {
      const created = new Date(video.created_at).getTime();
      return created >= since;
    });

    if (recent) {
      result.set(user.login.toLowerCase(), recent);
    }
  }

  return result;
}

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: "You need Manage Roles permission to use this command.",
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const commandName = interaction.commandName;

    if (commandName === "giverolefromchannel") {
      const channel = interaction.options.getChannel("channel");
      const role = interaction.options.getRole("role");
      const limit = interaction.options.getInteger("limit") || 1000;

      const messages = await fetchMessages(channel, limit);
      const userIds = collectMentions(messages);

      let added = 0;
      let alreadyHad = 0;
      let failed = 0;

      for (const userId of userIds) {
        try {
          const member = await interaction.guild.members.fetch(userId);

          if (member.roles.cache.has(role.id)) {
            alreadyHad++;
            continue;
          }

          await member.roles.add(role);
          added++;
        } catch {
          failed++;
        }
      }

      return replyLong(
        interaction,
        `**Give Role From Channel**\n\n` +
        `Role: ${role}\n` +
        `Messages scanned: ${messages.length}\n` +
        `Users found: ${userIds.size}\n\n` +
        `✅ Newly added: ${added}\n` +
        `➖ Already had role: ${alreadyHad}\n` +
        `❌ Failed: ${failed}`
      );
    }

    if (commandName === "takerolefromchannel") {
      const channel = interaction.options.getChannel("channel");
      const role = interaction.options.getRole("role");
      const limit = interaction.options.getInteger("limit") || 1000;

      const messages = await fetchMessages(channel, limit);
      const userIds = collectMentions(messages);

      let removed = 0;
      let didNotHave = 0;
      let failed = 0;

      for (const userId of userIds) {
        try {
          const member = await interaction.guild.members.fetch(userId);

          if (!member.roles.cache.has(role.id)) {
            didNotHave++;
            continue;
          }

          await member.roles.remove(role);
          removed++;
        } catch {
          failed++;
        }
      }

      return replyLong(
        interaction,
        `**Take Role From Channel**\n\n` +
        `Role: ${role}\n` +
        `Messages scanned: ${messages.length}\n` +
        `Users found: ${userIds.size}\n\n` +
        `✅ Removed: ${removed}\n` +
        `➖ Did not have role: ${didNotHave}\n` +
        `❌ Failed: ${failed}`
      );
    }

    if (commandName === "earningsroles") {
      const channel = interaction.options.getChannel("channel");
      const limit = interaction.options.getInteger("limit") || 1000;

      const messages = await fetchMessages(channel, limit);
      const allEarningsRoleIds = config.earningsRoles.map(r => r.roleId);

      let updated = 0;
      let alreadyCorrect = 0;
      let skipped = 0;
      let failed = 0;

      for (const message of messages) {
        for (const user of message.mentions.users.values()) {
          const earnings = extractEarningsAfterMention(message.content, user.id);

          if (earnings === null) {
            skipped++;
            continue;
          }

          const roleData = getEarningsRole(earnings);

          if (!roleData) {
            skipped++;
            continue;
          }

          try {
            const member = await interaction.guild.members.fetch(user.id);

            const hasCorrectRole = member.roles.cache.has(roleData.roleId);
            const hasWrongEarningsRole = allEarningsRoleIds.some(
              roleId => roleId !== roleData.roleId && member.roles.cache.has(roleId)
            );

            if (hasCorrectRole && !hasWrongEarningsRole) {
              alreadyCorrect++;
              continue;
            }

            await member.roles.remove(allEarningsRoleIds).catch(() => {});
            await member.roles.add(roleData.roleId);

            updated++;
          } catch {
            failed++;
          }
        }
      }

      return replyLong(
        interaction,
        `**Earnings Role Update**\n\n` +
        `Messages scanned: ${messages.length}\n\n` +
        `✅ Updated: ${updated}\n` +
        `➖ Already correct: ${alreadyCorrect}\n` +
        `⚠️ Skipped: ${skipped}\n` +
        `❌ Failed: ${failed}`
      );
    }

    if (commandName === "checksignup") {
      const signupChannel = interaction.options.getChannel("signup_channel");
      const twitchChannel = interaction.options.getChannel("twitch_channel");
      const limit = interaction.options.getInteger("limit") || 1000;

      const signupMessages = await fetchMessages(signupChannel, limit);
      const twitchMessages = await fetchMessages(twitchChannel, limit);

      const signupUsers = collectSignupUsers(signupMessages);
      const { linkedByUserId, looseLinks } = collectTwitchRegistrations(twitchMessages, signupUsers);

      const missing = [];
      const matched = [];
      const fallbackMatched = [];
      const extra = [];

      for (const [userId, user] of signupUsers.entries()) {
        const registration = linkedByUserId.get(userId);

        if (!registration) {
          missing.push(`<@${userId}>`);
        } else if (registration.fallback) {
          fallbackMatched.push(`<@${userId}> → twitch.tv/${registration.twitchName}`);
        } else {
          matched.push(`<@${userId}> → twitch.tv/${registration.twitchName}`);
        }
      }

      for (const [userId, registration] of linkedByUserId.entries()) {
        if (!signupUsers.has(userId)) {
          extra.push(`<@${userId}> → twitch.tv/${registration.twitchName}`);
        }
      }

      const loose = [...looseLinks].map(name => `twitch.tv/${name}`);

      let output =
        `**Signup Check**\n\n` +
        `Signup channel: ${signupChannel}\n` +
        `Twitch channel: ${twitchChannel}\n\n` +
        `Signups found: **${signupUsers.size}**\n` +
        `Twitch registrations matched: **${matched.length + fallbackMatched.length}**\n` +
        `Missing Twitch links: **${missing.length}**\n` +
        `Extra Twitch registrations: **${extra.length}**\n` +
        `Loose Twitch links: **${loose.length}**\n\n`;

      if (missing.length) {
        output += `**❌ Missing Twitch Link**\n${missing.join("\n")}\n\n`;
      } else {
        output += `**✅ No missing Twitch links.**\n\n`;
      }

      if (extra.length) {
        output += `**⚠️ Twitch link but no signup**\n${extra.join("\n")}\n\n`;
      }

      if (loose.length) {
        output += `**⚠️ Loose Twitch links without @User**\n${loose.join("\n")}\n\n`;
      }

      if (fallbackMatched.length) {
        output += `**🟡 Matched by name fallback**\n${fallbackMatched.join("\n")}\n\n`;
      }

      return replyLong(interaction, output);
    }

    if (commandName === "checkstreamproof") {
      const twitchChannel = interaction.options.getChannel("twitch_channel");
      const hours = interaction.options.getInteger("hours") || 24;
      const limit = interaction.options.getInteger("limit") || 1000;

      const twitchMessages = await fetchMessages(twitchChannel, limit);

      const dummySignup = new Map();

      for (const message of twitchMessages) {
        for (const user of message.mentions.users.values()) {
          dummySignup.set(user.id, user);
        }
      }

      const { linkedByUserId, looseLinks } = collectTwitchRegistrations(twitchMessages, dummySignup);

      const entries = [];

      for (const [userId, registration] of linkedByUserId.entries()) {
        entries.push({
          discordMention: `<@${userId}>`,
          twitchName: registration.twitchName
        });
      }

      for (const twitchName of looseLinks) {
        entries.push({
          discordMention: null,
          twitchName
        });
      }

      const twitchNames = [...new Set(entries.map(e => e.twitchName.toLowerCase()))];

      if (!twitchNames.length) {
        return replyLong(interaction, "No Twitch links found.");
      }

      const twitchUsers = await getTwitchUsers(twitchNames);
      const liveStreams = await getLiveStreams(twitchNames);
      const recentVideos = await getRecentVideos([...twitchUsers.values()], hours);

      const live = [];
      const vod = [];
      const noProof = [];
      const notFound = [];

      for (const entry of entries) {
        const name = entry.twitchName.toLowerCase();
        const label = entry.discordMention
          ? `${entry.discordMention} → twitch.tv/${name}`
          : `twitch.tv/${name}`;

        if (!twitchUsers.has(name)) {
          notFound.push(label);
          continue;
        }

        if (liveStreams.has(name)) {
          live.push(label);
          continue;
        }

        if (recentVideos.has(name)) {
          vod.push(label);
          continue;
        }

        noProof.push(label);
      }

      let output =
        `**Stream Proof Check**\n\n` +
        `Twitch channel: ${twitchChannel}\n` +
        `VOD timeframe: last **${hours} hours**\n` +
        `Twitch links checked: **${entries.length}**\n\n`;

      if (live.length) {
        output += `**🟢 Live Now**\n${live.join("\n")}\n\n`;
      }

      if (vod.length) {
        output += `**🟡 Recent VOD Found**\n${vod.join("\n")}\n\n`;
      }

      if (noProof.length) {
        output += `**🔴 No Live / No Recent VOD**\n${noProof.join("\n")}\n\n`;
      }

      if (notFound.length) {
        output += `**⚠️ Twitch account not found**\n${notFound.join("\n")}\n\n`;
      }

      return replyLong(interaction, output);
    }
  } catch (error) {
    console.error(error);

    const message =
      `Something went wrong.\n\n` +
      `Error:\n\`${error.message || "Unknown error"}\``;

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(message).catch(() => {});
    }

    return interaction.reply({
      content: message,
      flags: MessageFlags.Ephemeral
    }).catch(() => {});
  }
});

registerCommands()
  .then(() => client.login(TOKEN))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });