// Importa o construtor usado para definir comandos slash.
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // Define o comando /user e sua descrição exibida no Discord.
    data: new SlashCommandBuilder().setName('user').setDescription('Provides information about the user.'),

    // Executa a resposta do comando quando ele é chamado.
    async execute(interaction) {
        // "interaction.user" representa a conta do Discord que executou o comando.
        // "interaction.member" representa esse mesmo usuário dentro do servidor atual.
        await interaction.reply(
            `This command was run by ${interaction.user.username}, who joined on ${interaction.member.joinedAt}.`,
        );
    },
};
