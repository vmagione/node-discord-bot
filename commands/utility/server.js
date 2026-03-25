// Importa o construtor usado para criar comandos slash.
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // Define o comando /server e a descrição que aparecerá para o usuário.
    data: new SlashCommandBuilder().setName('server').setDescription('Provides information about the server.'),

    // Executa a lógica do comando ao receber a interação.
    async execute(interaction) {
        // "interaction.guild" representa o servidor onde o comando foi executado.
        await interaction.reply(
            `This server is ${interaction.guild.name} and has ${interaction.guild.memberCount} members.`,
        );
    },
};
