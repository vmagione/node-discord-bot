# Node Discord Bot

Bot em Node.js com `discord.js` para estudar e evoluir comandos slash no Discord. O projeto carrega comandos automaticamente por pasta, registra eventos do bot e ja inclui exemplos simples e comandos mais completos voltados para Dota 2.

<img width="376" height="444" alt="Preview do bot" src="https://github.com/user-attachments/assets/64dcbcce-3cc5-4eeb-b9fd-ad490df4de35" />

## O que ele faz

- Inicia um bot Discord com suporte a comandos slash.
- Carrega comandos automaticamente das pastas `commands/fun` e `commands/utility`.
- Trata interacoes e cooldowns no evento principal.
- Inclui comandos basicos como `/ping`, `/user`, `/server` e `/reload`.
- Inclui comandos de Dota 2 como `/hero` e `/pick`, consumindo dados da OpenDota.

## Como usar

1. Instale as dependencias:

```bash
npm install
```

2. Crie um arquivo `config.json` na raiz com esta estrutura:

```json
{
  "token": "SEU_TOKEN_DO_BOT",
  "public_key": "SUA_PUBLIC_KEY",
  "clientId": "SEU_CLIENT_ID",
  "guildId": "ID_DO_SERVIDOR"
}
```

3. No Discord Developer Portal, crie a aplicacao, habilite o bot e adicione-o ao seu servidor com as permissoes de `bot` e `applications.commands`.

4. Registre os comandos slash no servidor:

```bash
npm run deploy
```

5. Inicie o bot:

```bash
npm start
```

## Estrutura rapida

- `index.js`: inicializa o cliente, carrega comandos e eventos.
- `deploy-commands.js`: publica os comandos slash na guild configurada.
- `events/`: eventos principais do bot.
- `commands/`: comandos organizados por categoria.

## Observacoes

- Os comandos `/hero` e `/pick` dependem da API publica da OpenDota.
- Alguns comandos ainda estao como base de exemplo e podem ser expandidos.
