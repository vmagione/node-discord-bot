// Importa o construtor usado para definir comandos slash.
const { SlashCommandBuilder } = require('discord.js');

// Monta a estrutura do comando /echo e suas opções.
const data = new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Replies with your input!')
    // Texto que o bot deve repetir de volta.
    .addStringOption((option) => option.setName('input').setDescription('The input to echo back').setRequired(true))
    // Canal opcional para onde a resposta poderia ser enviada.
    .addChannelOption((option) => option.setName('channel').setDescription('The channel to echo into'))
    // Flag opcional para uma resposta visível apenas para o usuário.
    .addBooleanOption((option) =>
        option.setName('ephemeral').setDescription('Whether or not the echo should be ephemeral'),
    );

module.exports = {
    // Define um cooldown de 5 segundos para o comando.
    cooldown: 5,

    // Exporta a definição do comando para o carregador principal.
    data: data,

    // Implementação atual simples usada como placeholder.
    async execute(interaction) {
        await interaction.reply('Echo!');
    },
};
