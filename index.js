require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder
} = require('discord.js');

const {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus
} = require('@discordjs/voice');

const OpenAI = require("openai");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ===== CONFIG =====
let config = {
  status: "đang chill 😴",
  auto: false,
  mode: "AI", // AI | PRESET
  color: 0x00ffff,
  activity: ActivityType.Playing,
  prompt: "Status Discord ngắn, ngầu, Gen Z",
  presetList: ["chill 24/7", "code xuyên đêm", "đang theo dõi bạn 👀"]
};

let connection;
let startTime = Date.now();

// ===== AI =====
async function generateAI() {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: config.prompt },
        { role: "user", content: "Viết status dưới 10 từ" }
      ]
    });
    return res.choices[0].message.content;
  } catch {
    return "lag 🤯";
  }
}

// ===== VOICE =====
function connectVoice(channel) {
  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 3000),
        entersState(connection, VoiceConnectionStatus.Connecting, 3000),
      ]);
    } catch {
      connection.destroy();
      setTimeout(() => connectVoice(channel), 3000);
    }
  });
}

// ===== UI =====
function getEmbed() {
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return new EmbedBuilder()
    .setTitle("⚡ PROMAX DASHBOARD")
    .setColor(config.color)
    .setDescription(
      `🧠 Mode: ${config.mode}\n` +
      `💬 Status: ${config.status}\n` +
      `🔁 Auto: ${config.auto}\n` +
      `🎮 Activity: ${ActivityType[config.activity]}\n` +
      `📡 Ping: ${client.ws.ping}ms\n` +
      `⏱️ Uptime: ${uptime}s`
    );
}

function getUI(channels) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("status").setLabel("Status").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("auto").setLabel("Auto").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("mode").setLabel("Mode").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("reconnect").setLabel("Reconnect").setStyle(ButtonStyle.Danger)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("color").setLabel("Color").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("prompt").setLabel("AI Prompt").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("refresh").setLabel("Refresh").setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("activity")
        .setPlaceholder("Activity")
        .addOptions([
          { label: "Playing", value: "PLAYING" },
          { label: "Watching", value: "WATCHING" },
          { label: "Listening", value: "LISTENING" },
          { label: "Competing", value: "COMPETING" }
        ])
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("voice")
        .setPlaceholder("Voice Channel")
        .addOptions(channels)
    )
  ];
}

// ===== READY =====
client.once('ready', () => {
  console.log("🔥 BOT PROMAX READY");
});

// ===== INTERACTION =====
client.on('interactionCreate', async interaction => {

  if (interaction.user.id !== process.env.OWNER_ID) {
    return interaction.reply({ content: "❌ no quyền", ephemeral: true });
  }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "dashboard") {

      const channels = interaction.guild.channels.cache
        .filter(c => c.type === 2)
        .map(c => ({ label: c.name, value: c.id }));

      const msg = await interaction.reply({
        embeds: [getEmbed()],
        components: getUI(channels),
        fetchReply: true
      });

      setInterval(() => {
        msg.edit({
          embeds: [getEmbed()],
          components: msg.components
        }).catch(() => {});
      }, 5000);
    }
  }

  if (interaction.isButton()) {

    if (interaction.customId === "auto") config.auto = !config.auto;

    if (interaction.customId === "mode") {
      config.mode = config.mode === "AI" ? "PRESET" : "AI";
    }

    if (interaction.customId === "reconnect") {
      if (connection) connection.destroy();
      await interaction.reply({ content: "🔁 reconnect...", ephemeral: true });
    }

    if (interaction.customId === "status" || interaction.customId === "color" || interaction.customId === "prompt") {

      const modal = new ModalBuilder()
        .setCustomId(interaction.customId)
        .setTitle("Input");

      const input = new TextInputBuilder()
        .setCustomId("input")
        .setLabel("Nhập giá trị")
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    await interaction.update({
      embeds: [getEmbed()],
      components: interaction.message.components
    });
  }

  if (interaction.isModalSubmit()) {
    const val = interaction.fields.getTextInputValue("input");

    if (interaction.customId === "status") {
      config.status = val;
      config.auto = false;
    }

    if (interaction.customId === "color") {
      config.color = parseInt(val.replace("#", ""), 16);
    }

    if (interaction.customId === "prompt") {
      config.prompt = val;
    }

    client.user.setActivity(config.status, { type: config.activity });

    await interaction.reply({ content: "✅ updated", ephemeral: true });
  }

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "activity") {
      const val = interaction.values[0];

      if (val === "PLAYING") config.activity = ActivityType.Playing;
      if (val === "WATCHING") config.activity = ActivityType.Watching;
      if (val === "LISTENING") config.activity = ActivityType.Listening;
      if (val === "COMPETING") config.activity = ActivityType.Competing;

      client.user.setActivity(config.status, { type: config.activity });
    }

    if (interaction.customId === "voice") {
      const channel = interaction.guild.channels.cache.get(interaction.values[0]);
      connectVoice(channel);
    }

    await interaction.update({
      embeds: [getEmbed()],
      components: interaction.message.components
    });
  }
});

// ===== AUTO LOOP =====
setInterval(async () => {
  if (config.auto) {
    if (config.mode === "AI") {
      config.status = await generateAI();
    } else {
      config.status = config.presetList[Math.floor(Math.random() * config.presetList.length)];
    }
    client.user.setActivity(config.status, { type: config.activity });
  }
}, 15000);

client.login(process.env.TOKEN);