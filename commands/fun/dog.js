// Importa o construtor usado para criar comandos slash.
const { SlashCommandBuilder } = require('discord.js');

// Define o comando /dog, incluindo localizacoes de nome e descricao.
const data = new SlashCommandBuilder()
    .setName('dog')
    // Localiza o nome do comando para outros idiomas suportados.
    .setNameLocalizations({
        pl: 'pies',
        de: 'hund',
    })
    .setDescription('Get a cute picture of a dog!')
    // Localiza a descricao principal do comando.
    .setDescriptionLocalizations({
        pl: 'Słodkie zdjęcie pieska!',
        de: 'Poste ein niedliches Hundebild!',
    })
    .addStringOption((option) =>
        // Adiciona a opcao de raca do cachorro, tambem com traducoes.
        option
            .setName('breed')
            .setDescription('Breed of dog')
            .setNameLocalizations({
                pl: 'rasa',
                de: 'rasse',
            })
            .setDescriptionLocalizations({
                pl: 'Rasa psa',
                de: 'Hunderasse',
            }),
    );

module.exports = {
    // Define um cooldown de 5 segundos para o comando.
    cooldown: 5,

    // Exporta a definicao para o carregador de comandos.
    data: data,

    // Implementacao atual simples usada como placeholder.
    async execute(interaction) {
        await interaction.reply('Dog!');
    },
};
