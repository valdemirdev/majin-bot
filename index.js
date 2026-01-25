// Anti-crash / logs úteis
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

require('dotenv').config();

console.log('✅ BUILD: V6-WELCOME-BOTOES-BANNER');
console.log('🔥 MAJIN BOO-T - ULTIMATE FIX (WELCOME WINS LAST) 🔥');

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

// ========= MÓDULOS =========
const { registerWelcomeModule } = require('./src/modules/welcome');

// Se você usa reaction roles, mantém carregado. (Ele NÃO deveria mexer com guildMemberAdd.)
let registerRolesModule = null;
try {
  ({ registerRolesModule } = require('./src/modules/roles'));
  console.log('🧩 Roles module carregado (reaction roles).');
} catch {
  // ok
}

if (registerRolesModule) registerRolesModule(client);

// ========= READY =========
// 🔥 Aqui está o "ultimate fix":
// Quando o bot fica pronto, a gente REMOVE qualquer listener fantasma de guildMemberAdd
// (de qualquer módulo antigo que você ainda esteja carregando sem querer)
// e só então registra o welcome premium.
client.once('ready', () => {
  console.log(`🤖 Majin Boo-T online como ${client.user.tag}`);

  const before = client.listenerCount('guildMemberAdd');
  console.log(`🧹 Limpando guildMemberAdd (antes: ${before})`);
  client.removeAllListeners('guildMemberAdd');
  const after = client.listenerCount('guildMemberAdd');
  console.log(`✅ guildMemberAdd limpo (depois: ${after})`);

  registerWelcomeModule(client);

  console.log(`👂 guildMemberAdd agora: ${client.listenerCount('guildMemberAdd')} (deve ser 1)`);
});

// ========= LOGIN =========
client.login(process.env.DISCORD_TOKEN);

// ========= HEALTHCHECK =========
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
