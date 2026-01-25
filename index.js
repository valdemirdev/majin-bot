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

// ======================
// CONFIG
// ======================
const PORT = process.env.PORT || 3000;

// Twitch (Helix) via USER TOKEN
const TWITCH_BROADCASTER_ID = '1349140023'; // seu broadcaster_user_id
const TWITCH_CLIENT_ID = (process.env.TWITCH_CLIENT_ID || '').trim();
const TWITCH_USER_TOKEN = (process.env.TWITCH_USER_TOKEN || '').trim();
const TWITCH_BROADCASTER_LOGIN = (process.env.TWITCH_BROADCASTER_LOGIN || '').trim();

// Discord
const DISCORD_TOKEN = (process.env.DISCORD_TOKEN || '').trim();
const DISCORD_LIVE_CHANNEL_ID = (process.env.DISCORD_LIVE_CHANNEL_ID || '').trim();

// Anti-spam
let lastLiveNotifyAt = 0;

// ======================
// HTTP HEALTH
// ======================
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('Majin Boo-T online');
  }
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => console.log(`🌐 HTTP rodando na porta ${PORT}`));

// ======================
// DISCORD CLIENT
// ======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel],
});

client.once('ready', () => {
  console.log(`🤖 Discord OK: logado como ${client.user.tag}`);
});

// ======================
// FETCH (Node 18+ tem global, mas deixo compatível)
// ======================
const fetchFn = global.fetch
  ? (...args) => global.fetch(...args)
  : (...args) => import('node-fetch').then(({ default: f }) => f(...args));

// ======================
// TWITCH API HELPER
// ======================
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

// ======================
// EVENTSUB WS (Twitch)
// ======================
const TWITCH_EVENTSUB_WS_URL = 'wss://eventsub.wss.twitch.tv/ws';
let ws;
let sessionId = null;

function connectEventSubWS() {
  console.log('🔌 Conectando no EventSub WS...');
  ws = new WebSocket(TWITCH_EVENTSUB_WS_URL);

  ws.on('open', () => console.log('✅ WS conectado!'));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const type = msg?.metadata?.message_type;

      // Welcome -> pega session.id
      if (type === 'session_welcome') {
        sessionId = msg?.payload?.session?.id;
        console.log('🆔 Session ID:', sessionId);

        // cria subscription stream.online
        await ensureStreamOnlineSubscription(sessionId);
        return;
      }

      // notification -> evento
      if (type === 'notification') {
        const subType = msg?.payload?.subscription?.type;
        if (subType === 'stream.online') {
          const login = msg?.payload?.event?.broadcaster_user_login || TWITCH_BROADCASTER_LOGIN;
          console.log('🔴 stream.online recebido! login:', login || '(sem login no payload)');

          await sendLiveAlert();
        }
        return;
      }

      // keepalive
      if (type === 'session_keepalive') return;

      // reconnect
      if (type === 'session_reconnect') {
        const newUrl = msg?.payload?.session?.reconnect_url;
        console.log('♻️ Reconnect solicitado:', newUrl);
        try { ws.close(); } catch {}
        if (newUrl) connectToReconnectUrl(newUrl);
        return;
      }

      // revocation
      if (type === 'revocation') {
        console.log('⚠️ Subscription revogada:', msg?.payload?.subscription?.type);
        return;
      }
    } catch (e) {
      console.error('❌ Erro processando WS message:', e);
    }
  });

  ws.on('close', (code) => {
    console.log('🔌 WS fechado:', code, ' - reconectando em 5s...');
    sessionId = null;
    setTimeout(connectEventSubWS, 5000);
  });

  ws.on('error', (err) => {
    console.error('❌ WS erro:', err?.message || err);
  });
}

function connectToReconnectUrl(url) {
  console.log('🔌 Conectando no reconnect_url...');
  ws = new WebSocket(url);

  ws.on('open', () => console.log('✅ WS reconnect conectado!'));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const type = msg?.metadata?.message_type;

      if (type === 'session_welcome') {
        sessionId = msg?.payload?.session?.id;
        console.log('🆔 Session ID (reconnect):', sessionId);
        await ensureStreamOnlineSubscription(sessionId);
        return;
      }

      if (type === 'notification') {
        const subType = msg?.payload?.subscription?.type;
        if (subType === 'stream.online') {
          console.log('🔴 stream.online recebido (reconnect)!');
          await sendLiveAlert();
        }
      }
    } catch (e) {
      console.error('❌ Erro processando WS message (reconnect):', e);
    }
  });

  ws.on('close', (code) => {
    console.log('🔌 WS reconnect fechado:', code, ' - voltando para WS padrão em 5s...');
    sessionId = null;
    setTimeout(connectEventSubWS, 5000);
  });

  ws.on('error', (err) => {
    console.error('❌ WS reconnect erro:', err?.message || err);
  });
}

async function ensureStreamOnlineSubscription(session_id) {
  // lista subs e verifica se já existe
  try {
    const subs = await twitchApi('/eventsub/subscriptions', { method: 'GET' });
    const exists = subs?.data?.some(
      (s) =>
        s?.type === 'stream.online' &&
        s?.condition?.broadcaster_user_id === TWITCH_BROADCASTER_ID &&
        s?.transport?.method === 'websocket'
    );

    if (exists) {
      console.log('✅ Subscription stream.online já existe (WS).');
      return;
    }
  } catch (e) {
    console.log('⚠️ Não consegui listar subscriptions (seguindo para tentar criar):', e?.message || e);
  }

  console.log('➕ Criando subscription stream.online (WS)...');

  const body = {
    type: 'stream.online',
    version: '1',
    condition: { broadcaster_user_id: TWITCH_BROADCASTER_ID },
    transport: { method: 'websocket', session_id },
  };

  const created = await twitchApi('/eventsub/subscriptions', { method: 'POST', body });
  console.log('✅ Subscription criada:', created?.data?.[0]?.id || '(sem id)');
}

// ======================
// ✅ LIVE ALERT (EDITADO)
// ======================
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
      `**JOGANDO:** ${gameName}\n` +
      (streamTitle ? `**TÍTULO:** ${streamTitle}\n\n` : `\n`) +
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

// ======================
// START
// ======================
(async () => {
  if (!DISCORD_TOKEN) {
    console.log('❌ Falta DISCORD_TOKEN no Render.');
    process.exit(1);
  }

  try {
    await client.login(DISCORD_TOKEN);
  } catch (e) {
    console.error('❌ Falha no login do Discord:', e?.message || e);
    process.exit(1);
  }

  connectEventSubWS();
})();
