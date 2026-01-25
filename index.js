// Anti-crash / logs úteis
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

require('dotenv').config();

console.log('🔥 MAJIN BOO-T - UPGRADE V3 (BANNER + EMBED CLEAN) 🔥');

const http = require('http');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Módulos
const { registerWelcomeModule } = require('./src/modules/welcome');

// Roles module (mantém se você usa reaction roles)
let registerRolesModule = null;
try {
  ({ registerRolesModule } = require('./src/modules/roles'));
  console.log('🧩 Roles module carregado (reaction roles).');
} catch {
  // ok se não existir
}

client.once('clientReady', () => {
  console.log(`🤖 Majin Boo-T online como ${client.user.tag}`);
});

registerWelcomeModule(client);
if (registerRolesModule) registerRolesModule(client);

client.login(process.env.DISCORD_TOKEN);

// Healthcheck
const PORT = process.env.PORT || 3001;

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
