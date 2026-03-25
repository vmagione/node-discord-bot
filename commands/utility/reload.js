// Importa o construtor usado para declarar o comando slash.
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // Define o comando /reload, que recarrega um comando sem reiniciar o bot.
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads a command.')
        // Adiciona a opção obrigatória com o nome do comando que será recarregado.
        .addStringOption((option) => option.setName('command').setDescription('The command to reload.').setRequired(true)),

    // Executa o recarregamento de um comando já carregado em memória.
    async execute(interaction) {
        // Lê a opção informada pelo usuário e padroniza para letras minúsculas.
        const commandName = interaction.options.getString('command', true).toLowerCase();

        // Busca o comando atual dentro da coleção registrada no cliente.
        const command = interaction.client.commands.get(commandName);
        if (!command) {
            // Encerra a execução se o comando solicitado não existir.
            return interaction.reply(`There is no command with name \`${commandName}\`!`);
        }

        try {
            // Remove o módulo do cache do Node.js para forçar uma nova leitura do arquivo.
            delete require.cache[require.resolve(command.filePath)];

            // Reimporta o arquivo do comando já atualizado em disco.
            const newCommand = require(command.filePath);

            // Mantém o caminho do arquivo para futuros reloads.
            newCommand.filePath = command.filePath;

            // Substitui a versão antiga pela nova dentro da coleção de comandos.
            interaction.client.commands.set(newCommand.data.name, newCommand);

            // Informa ao usuário que o comando foi recarregado.
            await interaction.reply(`Command \`${newCommand.data.name}\` was reloaded!`);
        } catch (error) {
            // Registra o erro no terminal para facilitar a depuração.
            console.error(error);

            // Responde com a mensagem do erro encontrado ao tentar recarregar o comando.
            await interaction.reply(
                `There was an error while reloading a command \`${command.data.name}\`:\n\`${error.message}\``,
            );
        }
    },
};
