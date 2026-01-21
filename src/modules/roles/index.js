// Reaction Roles (estilo Carl): reage em 1 mensagem -> ganha/remove cargo

const ROLES_CHANNEL_ID = '1462166121904865353';
const ROLES_MESSAGE_ID = '1462168036386803844';

// Mapeamento CORRETO: emoji -> roleId
const EMOJI_TO_ROLE = {
  '⭐': '1462151477333332141',   // Cargo 1
  '🔔': '1462168849930649815',  // Cargo 2
  '⚔️': '1462157588698497199',  // Cargo 3
  '🤖': '1462166903694037256',  // Cargo 4
};

function normalizeEmoji(reaction) {
  return reaction.emoji.id ?? reaction.emoji.name;
}

async function handleReaction(reaction, user, add) {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message?.partial) await reaction.message.fetch();
  } catch {
    return;
  }

  // Filtro: somente a mensagem correta
  if (reaction.message.channelId !== ROLES_CHANNEL_ID) return;
  if (reaction.message.id !== ROLES_MESSAGE_ID) return;

  const key = normalizeEmoji(reaction);
  const roleId = EMOJI_TO_ROLE[key];
  if (!roleId) return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  try {
    if (add) {
      await member.roles.add(roleId);
      console.log(`✅ ADD ${key} -> ${member.user.tag}`);
    } else {
      await member.roles.remove(roleId);
      console.log(`✅ REMOVE ${key} -> ${member.user.tag}`);
    }
  } catch (err) {
    console.error('❌ Erro ao alterar cargo:', err?.message ?? err);
    console.error('👉 Verifique: Gerenciar Cargos + cargo do bot acima do cargo alvo.');
  }
}

function registerRolesModule(client) {
  client.on('messageReactionAdd', (reaction, user) =>
    handleReaction(reaction, user, true)
  );

  client.on('messageReactionRemove', (reaction, user) =>
    handleReaction(reaction, user, false)
  );

  console.log('🧩 Roles module carregado (reaction roles).');
}

module.exports = { registerRolesModule };
