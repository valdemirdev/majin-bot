// Anti-crash / logs úteis
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

require('dotenv').config();

console.log('🔥 LIVE ALERT TWITCH (EVENTSUB WS + USER TOKEN) - BUILD NOVO 🔥');

const http = require('http');
const WebSocket = require('ws');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { registerWelcomeModule } = require('./src/modules/welcome');
const { registerRolesModule } = require('./src/modules/roles');

// ==========================
// fetch (Node 18+ tem nativo; fallback p/ node-fetch se não tiver)
// ==========================
let fetchFn = global.fetch;
if (!fetchFn) {
  fetchFn = async (...args) => {
    const mod = await import('node-fetch');
    return mod.default(...args);
  };
  console.log('ℹ️ fetch nativo não encontrado, usando node-fetch (import dinâmico).');
}

// ==========================
// Discord Client
// ==========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// ✅ Registra módulos só UMA vez, depois do bot estar pronto
client.once('ready', () => {
  console.log(`✅ Logado como ${client.user.tag}`);
  // Evita duplicação se algum deploy/hot-reload reaproveitar processo
  client.removeAllListeners('guildMemberAdd');
  registerWelcomeModule(client);
  registerRolesModule(client);
});



// ==========================
// Twitch EventSub via WebSocket (LIVE ALERT)
// ==========================
const TWITCH_BROADCASTER_ID = '1349140023'; // seu broadcaster_user_id

// Envs "limpas" (trim evita espaço invisível)
const TWITCH_CLIENT_ID = (process.env.TWITCH_CLIENT_ID || '').trim();
const TWITCH_USER_TOKEN = (process.env.TWITCH_USER_TOKEN || '').trim();
const TWITCH_BROADCASTER_LOGIN = (process.env.TWITCH_BROADCASTER_LOGIN || '').trim();
const DISCORD_LIVE_CHANNEL_ID = (process.env.DISCORD_LIVE_CHANNEL_ID || '').trim();

// Logs seguros (não expõem token)
console.log('🔎 TWITCH_CLIENT_ID length:', TWITCH_CLIENT_ID.length, 'tem espaço?', /\s/.test(TWITCH_CLIENT_ID));
console.log('🔎 TWITCH_USER_TOKEN length:', TWITCH_USER_TOKEN.length, 'tem espaço?', /\s/.test(TWITCH_USER_TOKEN));
console.log('🔎 TWITCH_BROADCASTER_LOGIN:', TWITCH_BROADCASTER_LOGIN ? '(ok)' : '(faltando)');
console.log('🔎 DISCORD_LIVE_CHANNEL_ID:', DISCORD_LIVE_CHANNEL_ID ? '(ok)' : '(faltando)');

let lastLiveNotifyAt = 0; // anti-spam simples

async function twitchApi(path, { method = 'GET', body } = {}) {
  if (!TWITCH_CLIENT_ID) throw new Error('Falta TWITCH_CLIENT_ID no Render.');
  if (!TWITCH_USER_TOKEN) throw new Error('Falta TWITCH_USER_TOKEN no Render.');

  const r = await fetchFn(`https://api.twitch.tv/helix${path}`, {
    method,
    headers: {
      // ✅ USER TOKEN AQUI
      'Authorization': `Bearer ${TWITCH_USER_TOKEN}`,
      'Client-Id': TWITCH_CLIENT_ID,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`Twitch API ${method} ${path} -> ${r.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function ensureWsSubscription(sessionId) {
  // evita duplicar
  const list = await twitchApi('/eventsub/subscriptions', { method: 'GET' });

  const exists = (list?.data || []).some((s) =>
    s?.type === 'stream.online' &&
    s?.condition?.broadcaster_user_id === TWITCH_BROADCASTER_ID &&
    s?.transport?.method === 'websocket' &&
    (s?.status === 'enabled' || s?.status === 'pending')
  );

  if (exists) {
    console.log('✅ Subscription WS já existe (enabled/pending).');
    return;
  }

  const payload = {
    type: 'stream.online',
    version: '1',
    condition: { broadcaster_user_id: TWITCH_BROADCASTER_ID },
    transport: { method: 'websocket', session_id: sessionId },
  };

  const res = await twitchApi('/eventsub/subscriptions', { method: 'POST', body: payload });
  console.log('✅ Subscription WS criada:', res?.data?.[0]?.id || '(sem id)');
}

async function sendLiveAlert() {
  if (!DISCORD_LIVE_CHANNEL_ID) {
    console.log('⚠️ DISCORD_LIVE_CHANNEL_ID não configurado no Render.');
    return;
  }
  if (!TWITCH_BROADCASTER_LOGIN) {
    console.log('⚠️ TWITCH_BROADCASTER_LOGIN não configurado no Render.');
    return;
  }

  // anti-spam: 120s
  const now = Date.now();
  if (now - lastLiveNotifyAt < 120_000) {
    console.log('⏭️ Ignorando alerta repetido (anti-spam).');
    return;
  }
  lastLiveNotifyAt = now;

  const channel = await client.channels.fetch(DISCORD_LIVE_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.log('❌ Canal de live não encontrado. Confira DISCORD_LIVE_CHANNEL_ID.');
    return;
  }

  const twitchUrl = `https://twitch.tv/${TWITCH_BROADCASTER_LOGIN}`;

  // Puxa dados do stream (jogo/título) + avatar do canal
  let gameName = '—';
  let streamTitle = null;
  let avatarUrl = null;

  try {
    const [streamsRes, userRes] = await Promise.all([
      twitchApi(`/streams?user_id=${TWITCH_BROADCASTER_ID}`, { method: 'GET' }),
      twitchApi(`/users?id=${TWITCH_BROADCASTER_ID}`, { method: 'GET' }),
    ]);

    const stream = streamsRes?.data?.[0];
    if (stream?.game_name) gameName = stream.game_name;
    if (stream?.title) streamTitle = stream.title;

    const user = userRes?.data?.[0];
    if (user?.profile_image_url) avatarUrl = user.profile_image_url;
  } catch (e) {
    console.log('⚠️ Falha ao puxar infos da Twitch (vai mandar embed básico):', e?.message || e);
  }

  const embed = new EmbedBuilder()
    .setTitle('🔴 ONLINE NA TWITCH !!!')
    .setURL(twitchUrl)
    .setDescription(
      `**JOGANDO:** ${gameName}
` +
      (streamTitle ? `**TÍTULO:** ${streamTitle}

` : `
`) +
      `Clique no botão abaixo e venha acompanhar!`
    )
    .setTimestamp();

  if (avatarUrl) embed.setThumbnail(avatarUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('ASSISTIR NA TWITCH')
      .setStyle(ButtonStyle.Link)
      .setURL(twitchUrl)
  );

  await channel.send({ embeds: [embed], components: [row] });
  console.log('✅ Alerta de live (EMBED + BOTÃO) enviado no Discord');
}


async function startTwitchEventSubWS() {
  console.log('🚀 Iniciando Twitch EventSub WS...');
  console.log('🌩️ Conectando no EventSub WebSocket da Twitch...');

  const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

  ws.on('open', () => console.log('✅ WebSocket Twitch conectado.'));

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString('utf8')); } catch { return; }

    const messageType = msg?.metadata?.message_type;

    if (messageType === 'session_welcome') {
      const sessionId = msg?.payload?.session?.id;
      console.log('✅ session_welcome. session_id =', sessionId);

      try {
        await ensureWsSubscription(sessionId);
      } catch (e) {
        console.error('❌ Erro ao criar/garantir subscription WS:', e?.message || e);
      }
      return;
    }

    if (messageType === 'notification') {
      const subType = msg?.payload?.subscription?.type;
      if (subType === 'stream.online') {
        console.log('🔴 Evento stream.online recebido!');
        await sendLiveAlert();
      }
      return;
    }

    if (messageType === 'session_keepalive') return;

    if (messageType === 'session_reconnect') {
      console.log('♻️ Twitch pediu reconnect. Reiniciando WS...');
      try { ws.close(); } catch {}
    }
  });

  ws.on('close', () => {
    console.log('⚠️ WebSocket Twitch fechou. Reconectando em 5s...');
    setTimeout(() => startTwitchEventSubWS().catch(console.error), 5000);
  });

  ws.on('error', (err) => console.error('❌ Erro WebSocket Twitch:', err?.message || err));
}

// ==========================
// Ready + Login
// ==========================
client.once('clientReady', () => {
  console.log(`🤖 Majin BooT online como ${client.user.tag}`);
  startTwitchEventSubWS().catch(console.error);
});

client.login(process.env.DISCORD_TOKEN);

// ==========================
// Healthcheck HTTP (Render gosta disso)
// ==========================
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Majin Boo-T online');
}).listen(PORT, () => {
  console.log(`🌐 Healthcheck rodando na porta ${PORT}`);
});
