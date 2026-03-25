// Importa as classes usadas para enviar os comandos slash para a API do Discord.
const { REST, Routes } = require('discord.js');

// Lê os identificadores e o token necessários para autenticar a publicação dos comandos.
const { clientId, guildId, token } = require('./config.json');

// Importa módulos do Node.js para leitura da estrutura de pastas.
const fs = require('node:fs');
const path = require('node:path');

// Array que receberá a versão JSON de todos os comandos que serão publicados.
const commands = [];

// Localiza a pasta principal onde os comandos estão organizados por categoria.
const foldersPath = path.join(__dirname, 'commands');

// Lê todas as subpastas existentes dentro de "commands".
const commandFolders = fs.readdirSync(foldersPath);
for (const folder of commandFolders) {
    // Monta o caminho da subpasta atual.
    const commandsPath = path.join(foldersPath, folder);

    // Filtra somente arquivos JavaScript, ignorando outros tipos de arquivo.
    const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

    // Converte cada comando para JSON, formato exigido pela API do Discord.
    for (const file of commandFiles) {
        // Cria o caminho absoluto do arquivo a ser importado.
        const filePath = path.join(commandsPath, file);

        // Importa o comando para acessar sua definição.
        const command = require(filePath);

        // Apenas comandos com "data" e "execute" entram na publicação.
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            // Mostra um aviso quando algum comando está incompleto.
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// Cria o cliente REST autenticado para se comunicar com a API do Discord.
const rest = new REST().setToken(token);

// Executa a publicação dos comandos de forma assíncrona.
(async () => {
    try {
        // Informa no terminal quantos comandos serão atualizados no servidor.
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Substitui todos os comandos slash da guilda pelos definidos atualmente no projeto.
        const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

        // Mostra quantos comandos foram recarregados com sucesso.
        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        // Registra erros para facilitar a depuração de falhas no deploy.
        console.error(error);
    }
})();
