console.log('✅ WELCOME BUILD: V6-BOTOES-BANNER');

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");

// CONFIG (SEUS IDS)

const WELCOME_CHANNEL_ID = "1462159709552378071";

// Canais que você quer nos botões
const REGRAS_CHANNEL_ID = "1462147522540736684";
const CARGOS_CHANNEL_ID = "1462166121904865353";

// (Opcional) canal de chat pra mencionar no texto
const GERAL_CHANNEL_ID = "1462147707144765502";

// (Opcional) ID do Beerus para mencionar
const BEERUS_USER_ID = "1344329313977241604";

// Botão da Twitch
const TWITCH_URL = "https://twitch.tv/guinnhoo_";

// Cor temática: Dark Roxo
const THEME_COLOR = 0x3b0a77;

// Nome fixo no banner (como você pediu)
const SERVER_DISPLAY_NAME_OVERRIDE = "Hakaiz | Comunidade MMORPG";

// Banner
const BANNER_FILENAME = "welcome.png";
const BANNER_W = 800;
const BANNER_H = 270;

// HELPERS

function mentionChannel(id, fallbackText) {
  if (id && /^\d{15,25}$/.test(id)) return `<#${id}>`;
  return fallbackText;
}

function mentionUser(id, fallbackText) {
  if (id && /^\d{15,25}$/.test(id)) return `<@${id}>`;
  return fallbackText;
}

function safeText(str, max = 30) {
  if (!str) return "";
  const s = String(str).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// Link direto para um canal (funciona em botão Link)
function channelUrl(guildId, channelId) {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

// BANNER GENERATOR (PNG)
// Requires: npm i @napi-rs/canvas

async function tryMakeWelcomeBanner(member) {
  let Canvas;
  try {
    Canvas = require("@napi-rs/canvas");
  } catch {
    return null; // sem dependência -> sem banner
  }

  const { createCanvas, loadImage } = Canvas;

  const canvas = createCanvas(BANNER_W, BANNER_H);
  const ctx = canvas.getContext("2d");

  // Background gradient (dark roxo)
  const grad = ctx.createLinearGradient(0, 0, BANNER_W, BANNER_H);
  grad.addColorStop(0, "#120016");
  grad.addColorStop(0.45, "#2a0a3b");
  grad.addColorStop(1, "#09000d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BANNER_W, BANNER_H);

  // Glow blobs
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#8a2be2";
  ctx.beginPath();
  ctx.ellipse(120, 60, 170, 120, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5b2cff";
  ctx.beginPath();
  ctx.ellipse(680, 205, 240, 160, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Border gradient
  const borderGrad = ctx.createLinearGradient(0, 0, BANNER_W, 0);
  borderGrad.addColorStop(0, "#b04bff");
  borderGrad.addColorStop(0.5, "#6d2cff");
  borderGrad.addColorStop(1, "#ff4bd8");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 6;

  // Rounded rect border
  const r = 22;
  ctx.beginPath();
  ctx.moveTo(r, 3);
  ctx.arcTo(BANNER_W - 3, 3, BANNER_W - 3, BANNER_H - 3, r);
  ctx.arcTo(BANNER_W - 3, BANNER_H - 3, 3, BANNER_H - 3, r);
  ctx.arcTo(3, BANNER_H - 3, 3, 3, r);
  ctx.arcTo(3, 3, BANNER_W - 3, 3, r);
  ctx.closePath();
  ctx.stroke();

  // Avatar
  const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
  let avatarImg = null;
  try {
    avatarImg = await loadImage(avatarUrl);
  } catch {
    avatarImg = null;
  }

  const cx = 120;
  const cy = BANNER_H / 2;
  const rad = 72;

  // Outer ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad + 8, 0, Math.PI * 2);
  ctx.closePath();
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();

  // Clip avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatarImg) {
    ctx.drawImage(avatarImg, cx - rad, cy - rad, rad * 2, rad * 2);
  } else {
    ctx.fillStyle = "#222";
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  ctx.restore();

  // Text
  const title = "BEM-VINDO(A)!!";
  const name = safeText(member.displayName || member.user.username, 24);
  const server = safeText(SERVER_DISPLAY_NAME_OVERRIDE || member.guild?.name || "Servidor", 34);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px sans-serif";
  ctx.fillText(title, 220, 85);

  ctx.font = "bold 30px sans-serif";
  ctx.globalAlpha = 0.95;
  ctx.fillText(name, 220, 128);

  ctx.font = "24px sans-serif";
  ctx.globalAlpha = 0.9;
  ctx.fillText(server, 220, 162);
  ctx.globalAlpha = 1;

  // New lines (como você pediu)
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.92;
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("DIVIRTA-SE NO CHAT DA NOSSA COMUNIDADE!", 220, 196);
  ctx.globalAlpha = 1;

  // High contrast highlight
  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("NÃO DEIXA DE CONFERIR OS CANAIS DOS BOTÕES ABAIXO", 220, 226);

  return canvas.toBuffer("image/png");
}

// MODULE

function registerWelcomeModule(client) {
  if (client.__welcomeRegistered) {
    console.log('⚠️ Welcome já registrado — ignorando (anti-dup).');
    return;
  }
  client.__welcomeRegistered = true;
  console.log('✅ Welcome registrado (V6).');
  client.on("guildMemberAdd", async (member) => {
    try {
      const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const geral = mentionChannel(GERAL_CHANNEL_ID, "#💬-geral");
      const regrasMention = mentionChannel(REGRAS_CHANNEL_ID, "#📌-regras");
      const cargosMention = mentionChannel(CARGOS_CHANNEL_ID, "#🎭-cargos");
      const beerus = mentionUser(BEERUS_USER_ID, "@Beerus");

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setAuthor({ name: "👋 Bem vindo(a) !!" })
        .setDescription(
          [
            `Olá ${member}, seja bem vindo(a) ao discord do ${beerus}`,
            `nossa comunidade é grata por você fazer parte.`,
            ``,
            `Se apresente no canal ${geral} e se divirta por aqui.`,
            ``,
            `**Se liga nessa dica!**`,
            `Leia as ${regrasMention} e confira ${cargosMention}.`,
            ``,
            `🎥 **Acompanhe as lives diretamente nos botões abaixo ⬇️**`,
          ].join("\n")
        )
        .setTimestamp();

      // ✅ Botões: Regras | Cargos | Twitch
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("📌 Regras")
          .setURL(channelUrl(member.guild.id, REGRAS_CHANNEL_ID)),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("🎭 Cargos")
          .setURL(channelUrl(member.guild.id, CARGOS_CHANNEL_ID)),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel("Twitch")
          .setURL(TWITCH_URL)
      );

      const bannerBuf = await tryMakeWelcomeBanner(member);
      if (bannerBuf) {
        const file = new AttachmentBuilder(bannerBuf, { name: BANNER_FILENAME });
        embed.setImage(`attachment://${BANNER_FILENAME}`);
        await channel.send({ embeds: [embed], components: [row], files: [file] });
      } else {
        await channel.send({ embeds: [embed], components: [row] });
      }
    } catch (err) {
      console.error("❌ Erro ao enviar boas-vindas:", err);
    }
  });
}

module.exports = { registerWelcomeModule };
