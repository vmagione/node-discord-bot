// Importa o construtor usado para criar comandos slash.
const { SlashCommandBuilder } = require('discord.js');

// Define o comando /gif e a categoria obrigatória da busca.
const data = new SlashCommandBuilder()
    .setName('gif')
    .setDescription('Sends a random gif!')
    .addStringOption((option) =>
        // Limita a escolha do usuário a categorias previamente definidas.
        option
            .setName('category')
            .setDescription('The gif category')
            .setRequired(true)
            .addChoices(
                { name: 'Funny', value: 'gif_funny' },
                { name: 'Meme', value: 'gif_meme' },
                { name: 'Movie', value: 'gif_movie' },
            ),
    );

module.exports = {
    // Define um cooldown de 5 segundos para evitar spam.
    cooldown: 5,

    // Exporta a estrutura do comando.
    data: data,

    // Implementação atual simples usada como placeholder.
    async execute(interaction) {
        await interaction.reply('Gif!');
    },
};
