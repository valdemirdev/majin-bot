const WELCOME_CHANNEL_ID = '1462159709552378071';

function registerWelcomeModule(client) {
  client.on('guildMemberAdd', async (member) => {
    console.log('👋 guildMemberAdd disparou para:', member.user.tag);

    try {
      const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID);
      if (!channel) return;

      await channel.send(`🎉 Bem-vindo(a), ${member}!`);
    } catch (err) {
      console.error('Erro ao enviar boas-vindas:', err);
    }
  });
}

module.exports = { registerWelcomeModule };
