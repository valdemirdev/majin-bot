// Anti-crash / logs úteis
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

require('dotenv').config();

console.log('🔥 WEBSOCKET TWITCH ATIVO - BUILD NOVO 🔥');

const http = require('http');
const WebSocket = require('ws');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const { registerWelcomeModule } = require('./src/modules/welcome');
const { registerRolesModule } = require('./src/modules/roles');

// ==========================
// fetch (Node 18+ tem nativo; fallback p/ node-fetch se não tiver)
// ==========================
let fetchFn = global.fetch;
if (!fetchFn) {
  try {
    // node-fetch v3 é ESM-only; preferimos v2 ou usar import dinâmico.
    // Aqui tentamos import dinâmico para funcionar nos dois casos.
    fetchFn = async (...args) => {
      const mod = await import('node-fetch');
      return mod.default(...args);
    };
    console.log('ℹ️ fetch nativo não encontrado, usando node-fetch (import dinâmico).');
  } catch (e) {
    console.log('❌ Sem fetch nativo e falhou ao carregar node-fetch.');
    console.log('➡️ Rode: npm i node-fetch');
    throw e;
  }
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
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

registerWelcomeModule(client);
registerRolesModule(client);

// ==========================
// Twitch EventSub via WebSocket (LIVE ALERT)
// ==========================
const TWITCH_BROADCASTER_ID = '1349140023'; // seu broadcaster_user_id
let lastLiveNotifyAt = 0; // anti-spam simples

async function getAppAccessToken() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Faltam TWITCH_CLIENT_ID ou TWITCH_CLIENT_SECRET no Render.');
  }

  const url =
    `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}` +
    `&client_secret=${encodeURIComponent(clientSecret)}` +
    `&grant_type=client_credentials`;

  const r = await fetchFn(url, { method: 'POST' });
  const data = await r.json().catch(() => ({}));

  if (!data.access_token) {
    throw new Error('Falha ao obter access_token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

async function twitchApi(accessToken, path, { method = 'GET', body } = {}) {
  const r = await fetchFn(`https://api.twitch.tv/helix${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID,
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

async function ensureWsSubscription(accessToken, sessionId) {
  // evita criar subscription duplicada
  const list = await twitchApi(accessToken, '/eventsub/subscriptions', { method: 'GET' });

  const exists = (list?.data || []).some((s) =>
    s?.type === 'stream.online' &&
    s?.condition?.broadcaster_user_id === TWITCH_BROADCASTER_ID &&
    s?.transport?.method === 'websocket' &&
    s?.status === 'enabled'
  );

  if (exists) {
    console.log('✅ Subscription WS já existe e está enabled. Não vou criar outra.');
    return;
  }

  const payload = {
    type: 'stream.online',
    version: '1',
    condition: { broadcaster_user_id: TWITCH_BROADCASTER_ID },
    transport: { method: 'websocket', session_id: sessionId },
  };

  const res = await twitchApi(accessToken, '/eventsub/subscriptions', {
    method: 'POST',
    body: payload,
  });

  const sub = res?.data?.[0];
  console.log('✅ Subscription WS criada:', sub?.id || res);
}

async function sendLiveAlert() {
  const channelId = process.env.DISCORD_LIVE_CHANNEL_ID;
  const login = process.env.TWITCH_BROADCASTER_LOGIN;

  if (!channelId) {
    console.log('⚠️ DISCORD_LIVE_CHANNEL_ID não configurado no Render.');
    return;
  }
  if (!login) {
    console.log('⚠️ TWITCH_BROADCASTER_LOGIN não configurado no Render.');
    return;
  }

  // anti-spam: se avisou nos últimos 120s, não repete
  const now = Date.now();
  if (now - lastLiveNotifyAt < 120_000) {
    console.log('⏭️ Ignorando alerta repetido (anti-spam).');
    return;
  }
  lastLiveNotifyAt = now;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.log('❌ Canal de live não encontrado. Confira DISCORD_LIVE_CHANNEL_ID.');
    return;
  }

  await channel.send(`🔴 **LIVE AGORA!**\nhttps://twitch.tv/${login}`);
  console.log('✅ Alerta de live enviado no Discord');
}

async function startTwitchEventSubWS() {
  console.log('🚀 Iniciando Twitch EventSub WS...');
  console.log('🌩️ Conectando no EventSub WebSocket da Twitch...');

  const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

  ws.on('open', () => {
    console.log('✅ WebSocket Twitch conectado.');
  });

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString('utf8'));
    } catch {
      return;
    }

    const messageType = msg?.metadata?.message_type;

    if (messageType === 'session_welcome') {
      const sessionId = msg?.payload?.session?.id;
      console.log('✅ session_welcome. session_id =', sessionId);

      try {
        const accessToken = await getAppAccessToken();
        await ensureWsSubscription(accessToken, sessionId);
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
      const newUrl = msg?.payload?.session?.reconnect_url;
      console.log('♻️ Twitch pediu reconnect:', newUrl || '(sem url)');
      try { ws.close(); } catch {}
      return;
    }
  });

  ws.on('close', () => {
    console.log('⚠️ WebSocket Twitch fechou. Reconectando em 5s...');
    setTimeout(() => startTwitchEventSubWS().catch(console.error), 5000);
  });

  ws.on('error', (err) => {
    console.error('❌ Erro WebSocket Twitch:', err?.message || err);
  });
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
