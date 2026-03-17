const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('dog')
    .setNameLocalizations({
        pl: 'pies',
        de: 'hund',
    })
    .setDescription('Get a cute picture of a dog!')
    .setDescriptionLocalizations({
        pl: 'Słodkie zdjęcie pieska!',
        de: 'Poste ein niedliches Hundebild!',
    })
    .addStringOption((option) =>
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
    cooldown: 5,
    data: data,
    async execute(interaction) {
        await interaction.reply('Dog!');
    },
};