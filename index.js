// Anti-crash / logs úteis
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const { registerWelcomeModule } = require('./src/modules/welcome');
const { registerRolesModule } = require('./src/modules/roles');

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

client.once('clientReady', () => {
  console.log(`🤖 Majin BooT online como ${client.user.tag}`);
});

registerWelcomeModule(client);
registerRolesModule(client);

client.login(process.env.DISCORD_TOKEN);

// Healthcheck HTTP (Render gosta disso)
const http = require('http');

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
