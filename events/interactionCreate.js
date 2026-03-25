// Importa classes usadas para manipular interações, cooldowns e respostas privadas.
const { Collection, Events, MessageFlags } = require('discord.js');

module.exports = {
    // Este evento dispara sempre que qualquer interação é criada no Discord.
    name: Events.InteractionCreate,

    // Função principal que trata a execução dos comandos slash.
    async execute(interaction) {
        // Ignora interações que não sejam comandos do tipo chat input (/comando).
        if (!interaction.isChatInputCommand()) return;

        // Busca o comando correspondente pelo nome digitado pelo usuário.
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            // Registra erro quando o comando não está carregado no cliente.
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        // Acessa a coleção global de cooldowns armazenada no cliente.
        const { cooldowns } = interaction.client;

        // Cria um espaço exclusivo de controle de tempo para esse comando, se ainda não existir.
        if (!cooldowns.has(command.data.name)) {
            cooldowns.set(command.data.name, new Collection());
        }

        // Guarda o horário atual em milissegundos.
        const now = Date.now();

        // Recupera a coleção de usuários que já usaram esse comando recentemente.
        const timestamps = cooldowns.get(command.data.name);

        // Define um cooldown padrão de 3 segundos caso o comando não configure outro valor.
        const defaultCooldownDuration = 3;

        // Converte a duração do cooldown para milissegundos.
        const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

        // Verifica se o usuário atual ainda está dentro do tempo de espera.
        if (timestamps.has(interaction.user.id)) {
            // Calcula quando o cooldown desse usuário termina.
            const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
            if (now < expirationTime) {
                // Converte o tempo final para timestamp Unix, formato aceito pelo Discord.
                const expiredTimestamp = Math.round(expirationTime / 1_000);

                // Responde de forma privada informando quando o comando poderá ser usado novamente.
                return interaction.reply({
                    content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`,
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

        // Registra o uso atual do comando por esse usuário.
        timestamps.set(interaction.user.id, now);

        // Agenda a remoção automática do usuário da lista quando o cooldown terminar.
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

        try {
            // Executa a lógica real do comando.
            await command.execute(interaction);
        } catch (error) {
            // Mostra no terminal qualquer falha ocorrida durante a execução.
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                // Se já houve resposta inicial, envia uma mensagem complementar informando o erro.
                await interaction.followUp({
                    content: 'There was an error while executing this command!',
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                // Se ainda não houve resposta, envia a mensagem de erro como resposta principal.
                await interaction.reply({
                    content: 'There was an error while executing this command!',
                    flags: MessageFlags.Ephemeral,
                });
            }
        }
    },
};
