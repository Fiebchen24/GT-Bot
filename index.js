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
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel to scan")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("Role to give")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("limit")
        .setDescription("How many messages to scan, max 100")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("takerolefromchannel")
    .setDescription("Removes a role from everyone mentioned in a selected channel.")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel to scan")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName("role")
        .setDescription("Role to remove")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("limit")
        .setDescription("How many messages to scan, max 100")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  new SlashCommandBuilder()
    .setName("earningsroles")
    .setDescription("Updates earnings roles based on mentions and earnings numbers in a channel.")
    .addChannelOption(option =>
      option
        .setName("channel")
        .setDescription("Channel to scan")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("limit")
        .setDescription("How many messages to scan, max 100")
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
  return (
    channel &&
    [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.PublicThread,
      ChannelType.PrivateThread
    ].includes(channel.type)
  );
}

async function fetchMessages(channel, limit) {
  if (!isTextChannel(channel)) {
    throw new Error("Please select a text channel.");
  }

  return channel.messages.fetch({
    limit: Math.min(Math.max(limit || 100, 1), 100)
  });
}

function collectMentionedUserIds(messages) {
  const userIds = new Set();

  for (const message of messages.values()) {
    for (const user of message.mentions.users.values()) {
      userIds.add(user.id);
    }
  }

  return userIds;
}

function parseMoneyNumber(raw) {
  if (!raw) return null;

  let value = String(raw).trim().toLowerCase();
  value = value.replace(/[$€£]/g, "").replace(/\s/g, "");

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

    let added = 0;
    let removed = 0;
    let alreadyHad = 0;
    let didNotHave = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        const member = await interaction.guild.members.fetch(userId);
        const hasRole = member.roles.cache.has(role.id);

        if (mode === "give") {
          if (hasRole) {
            alreadyHad++;
            continue;
          }

          await member.roles.add(role);
          added++;
        } else {
          if (!hasRole) {
            didNotHave++;
            continue;
          }

          await member.roles.remove(role);
          removed++;
        }
      } catch (error) {
        console.error(`Failed to ${mode} role for ${userId}:`, error.message);
        failed++;
      }
    }

    if (mode === "give") {
      return interaction.editReply(
        `Done.\nRole: ${role}\nUsers found: ${userIds.size}\nNewly added: ${added}\nAlready had role: ${alreadyHad}\nFailed: ${failed}`
      );
    }

    return interaction.editReply(
      `Done.\nRole: ${role}\nUsers found: ${userIds.size}\nRemoved: ${removed}\nDid not have role: ${didNotHave}\nFailed: ${failed}`
    );
  } catch (error) {
    return interaction.editReply(`Error: ${error.message}`);
  }
}

async function updateEarningsRoles(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel("channel");
  const limit = interaction.options.getInteger("limit") || 100;
  const allEarningsRoleIds = getAllEarningsRoleIds();

  if (!allEarningsRoleIds.length) {
    return interaction.editReply("No earnings roles are configured in config.json.");
  }

  try {
    const messages = await fetchMessages(channel, limit);

    const latestByUser = new Map();

    const sortedMessages = [...messages.values()].sort(
      (a, b) => a.createdTimestamp - b.createdTimestamp
    );

    for (const message of sortedMessages) {
      for (const user of message.mentions.users.values()) {
        const earnings = extractEarningsAfterMention(message.content, user.id);
        if (earnings === null) continue;

        latestByUser.set(user.id, {
          userId: user.id,
          earnings
        });
      }
    }

    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of latestByUser.values()) {
      const roleData = getEarningsRole(entry.earnings);

      if (!roleData) {
        skipped++;
        continue;
      }

      try {
        const member = await interaction.guild.members.fetch(entry.userId);
        const currentEarningsRoles = allEarningsRoleIds.filter(roleId =>
          member.roles.cache.has(roleId)
        );

        const alreadyCorrect =
          currentEarningsRoles.length === 1 && currentEarningsRoles[0] === roleData.roleId;

        if (alreadyCorrect) {
          unchanged++;
          continue;
        }

        const rolesToRemove = currentEarningsRoles.filter(roleId => roleId !== roleData.roleId);

        if (rolesToRemove.length) {
          await member.roles.remove(rolesToRemove);
        }

        if (!member.roles.cache.has(roleData.roleId)) {
          await member.roles.add(roleData.roleId);
        }

        updated++;
      } catch (error) {
        console.error(`Failed to update earnings role for ${entry.userId}:`, error.message);
        failed++;
      }
    }

    return interaction.editReply(
      `Done.\nUsers with earnings found: ${latestByUser.size}\nUpdated: ${updated}\nAlready correct: ${unchanged}\nSkipped: ${skipped}\nFailed: ${failed}`
    );
  } catch (error) {
    return interaction.editReply(`Error: ${error.message}`);
  }
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return interaction.reply({
      content: "You need Manage Roles permission to use this command.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "giverolefromchannel") {
    return giveOrTakeRoleFromChannel(interaction, "give");
  }

  if (interaction.commandName === "takerolefromchannel") {
    return giveOrTakeRoleFromChannel(interaction, "take");
  }

  if (interaction.commandName === "earningsroles") {
    return updateEarningsRoles(interaction);
  }
});

registerCommands();
client.login(process.env.TOKEN);
