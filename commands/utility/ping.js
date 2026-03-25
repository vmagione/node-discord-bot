// Importa o construtor usado para criar comandos slash.
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // Define um cooldown de 5 segundos para evitar spam do comando.
    cooldown: 5,

    // Registra o comando /ping, usado como teste rápido de funcionamento.
    data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),

    // Responde ao usuário confirmando que o bot está ativo.
    async execute(interaction) {
        await interaction.reply('Pong!');
    },
};
