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
