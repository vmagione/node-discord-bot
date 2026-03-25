// Importa o construtor usado para criar comandos slash com subcomandos.
const { SlashCommandBuilder } = require('discord.js');

// Monta a definição do comando /info com subcomandos para usuário e servidor.
const data = new SlashCommandBuilder()
    .setName('info')
    .setDescription('Get info about a user or a server!')
    .addSubcommand((subcommand) =>
        // Subcomando que futuramente poderá mostrar detalhes de um usuário específico.
        subcommand
            .setName('user')
            .setDescription('Info about a user')
            .addUserOption((option) => option.setName('target').setDescription('The user')),
    )
    // Subcomando pensado para exibir dados do servidor atual.
    .addSubcommand((subcommand) => subcommand.setName('server').setDescription('Info about the server'));

module.exports = {
    // Define um cooldown de 5 segundos para o comando.
    cooldown: 5,

    // Exporta a estrutura do comando para registro no Discord.
    data: data,

    // Implementação atual simples usada como placeholder até a lógica completa ser criada.
    async execute(interaction) {
        await interaction.reply('Info!');
    },
};
