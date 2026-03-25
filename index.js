// Importa módulos nativos do Node.js para navegar pelas pastas do projeto.
const fs = require('node:fs');
const path = require('node:path');

// Importa as classes principais do discord.js usadas para iniciar o bot.
const { Client, Collection, GatewayIntentBits } = require('discord.js');

// Lê o token do bot a partir do arquivo de configuração local.
const { token } = require('./config.json');

// Cria a instância principal do bot informando quais eventos ele pode receber.
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Armazena todos os comandos carregados, usando o nome do comando como chave.
client.commands = new Collection();

// Guarda informações de cooldown para evitar spam de comandos.
client.cooldowns = new Collection();

// Monta o caminho absoluto da pasta que contém os comandos.
const foldersPath = path.join(__dirname, 'commands');

// Lista todas as subpastas de comandos, como "utility" e "fun".
const commandFolders = fs.readdirSync(foldersPath);

// Percorre cada categoria de comando para carregar seus arquivos.
for (const folder of commandFolders) {
    // Monta o caminho da categoria atual.
    const commandsPath = path.join(foldersPath, folder);

    // Seleciona apenas arquivos JavaScript que representam comandos válidos.
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

    // Lê cada comando da pasta atual e registra no bot.
    for (const file of commandFiles) {
        // Constrói o caminho completo do arquivo do comando.
        const filePath = path.join(commandsPath, file);

        // Importa o módulo do comando para acessar seus dados e execução.
        const command = require(filePath);

        // Só registra comandos que exportam os campos obrigatórios para o Discord funcionar.
        if ('data' in command && 'execute' in command) {
            // Guarda o caminho do arquivo para permitir recarregamento posterior.
            command.filePath = filePath;

            // Salva o comando na coleção principal do cliente.
            client.commands.set(command.data.name, command);
        } else {
            // Exibe um aviso quando algum arquivo não segue o formato esperado.
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}
// Monta o caminho da pasta de eventos do bot.
const eventsPath = path.join(__dirname, 'events');

// Busca apenas os arquivos JavaScript da pasta de eventos.
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

// Registra todos os eventos encontrados no cliente do Discord.
for (const file of eventFiles) {
    // Caminho completo do arquivo do evento atual.
    const filePath = path.join(eventsPath, file);

    // Importa a definição do evento.
    const event = require(filePath);

    // Eventos marcados com "once" rodam apenas uma vez durante a vida do bot.
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        // Eventos comuns ficam ouvindo continuamente enquanto o bot estiver online.
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Faz login no Discord usando o token configurado e inicia o bot.
client.login(token);
