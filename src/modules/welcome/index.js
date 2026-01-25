console.log("🔥 WELCOME BUILD FINAL 4000.0 — LIMPO E ANTI-DUP 🔥");

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
const TWITCH_URL = "https://twitch.tv/guinnhoo_";

const THEME_COLOR = 0x3b0a77;
const SERVER_DISPLAY_NAME_OVERRIDE = "Hakaiz | Comunidade MMORPG";

const BANNER_FILENAME = "welcome.png";
const BANNER_W = 800;
const BANNER_H = 270;

// ==========================
// ANTI DUP (POR USUÁRIO) + LOCK GLOBAL
// ==========================
const recentWelcomes = new Map(); // userId -> timestamp
let welcomeLocked = false;

function canSend(userId) {
  const now = Date.now();
  const last = recentWelcomes.get(userId);
  if (last && now - last < 180000) return false; // 3 minutos
  recentWelcomes.set(userId, now);
  setTimeout(() => recentWelcomes.delete(userId), 180000);
  return true;
}

function channelUrl(guildId, channelId) {
  return `https://discord.com/channels/${guildId}/${channelId}`;
}

// ==========================
// BANNER (apenas imagem, sem texto fora do banner)
// Requires: npm i @napi-rs/canvas
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

  // Background gradient (dark roxo)
  const grad = ctx.createLinearGradient(0, 0, BANNER_W, BANNER_H);
  grad.addColorStop(0, "#120016");
  grad.addColorStop(0.5, "#2a0a3b");
  grad.addColorStop(1, "#09000d");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BANNER_W, BANNER_H);

  // Avatar
  const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
  let avatarImg = null;
  try {
    avatarImg = await loadImage(avatarUrl);
  } catch {}

  const cx = 120;
  const cy = BANNER_H / 2;
  const rad = 72;

  // Ring
  ctx.save();
  ctx.strokeStyle = "#b04bff";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, rad + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Clip avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.clip();
  if (avatarImg) ctx.drawImage(avatarImg, cx - rad, cy - rad, rad * 2, rad * 2);
  ctx.restore();

  // Text
  const name = String(member.displayName || member.user.username || "Novato").trim();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px sans-serif";
  ctx.fillText("BEM-VINDO(A)!!", 220, 75);

  ctx.font = "bold 26px sans-serif";
  ctx.fillText(name, 220, 115);

  ctx.font = "22px sans-serif";
  ctx.globalAlpha = 0.95;
  ctx.fillText(SERVER_DISPLAY_NAME_OVERRIDE, 220, 150);
  ctx.globalAlpha = 1;

  // Lines smaller to always fit
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("DIVIRTA-SE NO CHAT DA NOSSA COMUNIDADE!", 220, 190);

  ctx.fillStyle = "#ffd166";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("NÃO DEIXA DE CONFERIR OS CANAIS DOS BOTÕES ABAIXO", 220, 220);

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
  console.log("✅ Welcome registrado FINAL 4000.0");

  client.on("guildMemberAdd", async (member) => {
    try {
      // trava global curtinha (evita 2 disparos quase simultâneos)
      if (welcomeLocked) {
        console.log("⛔ Evento bloqueado por LOCK (global).");
        return;
      }

      // trava por usuário (evita repetir pro mesmo cara)
      if (!canSend(member.id)) {
        console.log("⛔ Bloqueado envio duplicado para", member.user?.tag || member.id);
        return;
      }

      welcomeLocked = true;
      setTimeout(() => (welcomeLocked = false), 3500);

      const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
      if (!channel) return;

      const bannerBuf = await tryMakeWelcomeBanner(member);
      if (!bannerBuf) {
        console.log("❌ Banner não gerado (falta @napi-rs/canvas) — mensagem cancelada");
        return;
      }

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

      // ✅ Embed só com a imagem (SEM texto acima do banner)
      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setImage(`attachment://${BANNER_FILENAME}`)
        .setTimestamp();

      const file = new AttachmentBuilder(bannerBuf, { name: BANNER_FILENAME });

      await channel.send({
        embeds: [embed],
        components: [row],
        files: [file],
      });

      console.log("✅ Welcome enviado UMA ÚNICA VEZ para", member.user?.tag || member.id);
    } catch (err) {
      console.error("❌ Erro no welcome:", err);
    }
  });
}

module.exports = { registerWelcomeModule };
