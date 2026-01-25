console.log("✅ WELCOME BUILD FINAL 3000.0 (ANTI-DUP DEFINITIVO)");

const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");

const WELCOME_CHANNEL_ID = "1462159709552378071";
const REGRAS_CHANNEL_ID = "1462147522540736684";
const CARGOS_CHANNEL_ID = "1462166121904865353";
const GERAL_CHANNEL_ID = "1462147707144765502";
const BEERUS_USER_ID = "1344329313977241604";
const TWITCH_URL = "https://twitch.tv/guinnhoo_";

const THEME_COLOR = 0x3b0a77;
const SERVER_DISPLAY_NAME_OVERRIDE = "Hakaiz | Comunidade MMORPG";

const BANNER_FILENAME = "welcome.png";
const BANNER_W = 800;
const BANNER_H = 270;

// ==========================
// ANTI-DUP GLOBAL (REAL)
// ==========================
const recentWelcomes = new Map(); // userId -> timestamp

function canSend(userId) {
  const now = Date.now();
  if (recentWelcomes.has(userId)) {
    const last = recentWelcomes.get(userId);
    if (now - last < 120000) return false; // 2 minutos de bloqueio
  }
  recentWelcomes.set(userId, now);
  setTimeout(() => recentWelcomes.delete(userId), 120000);
  return true;
}

function mentionChannel(id, fallback) {
  if (id && /^\d+$/.test(id)) return `<#${id}>`;
  return fallback;
}

function mentionUser(id, fallback) {
  if (id && /^\d+$/.test(id)) return `<@${id}>`;
  return fallback;
}

function channelUrl(guildId, channelId) {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

// ==========================
// BANNER
// ==========================
async function tryMakeWelcomeBanner(member) {
  let Canvas;
  try {
    Canvas = require("@napi-rs/canvas");
  } catch {
    return null;
  }

  const { createCanvas, loadImage } = Canvas;
  const canvas = createCanvas(BANNER_W, BANNER_H);
  const ctx = canvas.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, BANNER_W, BANNER_H);
  grad.addColorStop(0, "#120016");
  grad.addColorStop(0.5, "#2a0a3b");
  grad.addColorStop(1, "#09000d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BANNER_W, BANNER_H);

  const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
  let avatarImg = null;
  try {
    avatarImg = await loadImage(avatarUrl);
  } catch {}

  const cx = 120;
  const cy = BANNER_H / 2;
  const rad = 72;

  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) ctx.drawImage(avatarImg, cx - rad, cy - rad, rad * 2, rad * 2);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("BEM-VINDO(A)!!", 220, 80);

  ctx.font = "bold 28px sans-serif";
  ctx.fillText(member.displayName, 220, 120);

  ctx.font = "24px sans-serif";
  ctx.fillText(SERVER_DISPLAY_NAME_OVERRIDE, 220, 155);

  // 🔽 TEXTOS CORRIGIDOS (MENORES + QUEBRA)
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("DIVIRTA-SE NO CHAT DA NOSSA", 220, 195);
  ctx.fillText("COMUNIDADE!", 220, 220);

  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("NÃO DEIXA DE CONFERIR OS CANAIS", 220, 245);
  ctx.fillText("DOS BOTÕES ABAIXO", 220, 265);

  return canvas.toBuffer("image/png");
}

// ==========================
// MODULE
// ==========================
function registerWelcomeModule(client) {
  if (client.__welcomeRegistered) {
    console.log("⚠️ Welcome já registrado — ignorando duplicado.");
    return;
  }
  client.__welcomeRegistered = true;
  console.log("✅ Welcome registrado FINAL 3000.0");

  client.on("guildMemberAdd", async (member) => {
    try {
      if (!canSend(member.id)) {
        console.log("⛔ Bloqueado envio duplicado para", member.user.tag);
        return;
      }

      const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
      if (!channel) return;

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
          .setLabel("🟣 Twitch")
          .setURL(TWITCH_URL)
      );

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTimestamp();

      const bannerBuf = await tryMakeWelcomeBanner(member);
      if (bannerBuf) {
        const file = new AttachmentBuilder(bannerBuf, { name: BANNER_FILENAME });
        embed.setImage(`attachment://${BANNER_FILENAME}`);
        await channel.send({ embeds: [embed], components: [row], files: [file] });
      } else {
        await channel.send({ embeds: [embed], components: [row] });
      }

      console.log("✅ Welcome enviado para", member.user.tag);

    } catch (err) {
      console.error("❌ Erro no welcome:", err);
    }
  });
}

module.exports = { registerWelcomeModule };
