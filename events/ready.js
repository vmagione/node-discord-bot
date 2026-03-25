// Importa o enum de eventos do discord.js para evitar nomes escritos manualmente.
const { Events } = require('discord.js');

module.exports = {
    // Define qual evento este módulo representa.
    name: Events.ClientReady,

    // Indica que esse evento deve rodar apenas uma vez quando o bot conectar.
    once: true,

    // Função executada quando o cliente termina de iniciar.
    execute(client) {
        // Exibe no terminal que o bot está online e autenticado.
        console.log(`Ready! Logged in as ${client.user.tag}`);
    },
};
