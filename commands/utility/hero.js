// Importa classes para criar o comando slash e montar embeds de resposta.
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// Endpoint com estatísticas completas dos heróis fornecidas pela OpenDota.
const HERO_STATS_URL = 'https://api.opendota.com/api/heroStats';

// Mantém o cache válido por 1 hora para reduzir chamadas repetidas à API.
const HERO_CACHE_TTL_MS = 60 * 60 * 1000;

// Cache simples em memória com dados de heróis e data de expiração.
let heroCache = {
    expiresAt: 0,
    heroes: null,
};

// Mapeia apelidos comuns usados pelos jogadores para o nome oficial do herói.
const heroAliases = new Map([
    ['aa', 'ancient apparition'],
    ['am', 'anti-mage'],
    ['bara', 'spirit breaker'],
    ['cm', 'crystal maiden'],
    ['dp', 'death prophet'],
    ['es', 'earthshaker'],
    ['et', 'elder titan'],
    ['furion', "nature's prophet"],
    ['kotl', 'keeper of the light'],
    ['lesh', 'leshrac'],
    ['ls', 'lifestealer'],
    ['mag', 'magnus'],
    ['naix', 'lifestealer'],
    ['np', "nature's prophet"],
    ['od', 'outworld destroyer'],
    ['pa', 'phantom assassin'],
    ['pl', 'phantom lancer'],
    ['qop', 'queen of pain'],
    ['sd', 'shadow demon'],
    ['sf', 'shadow fiend'],
    ['ss', 'shadow shaman'],
    ['tb', 'terrorblade'],
    ['ta', 'templar assassin'],
    ['tk', 'tinker'],
    ['tiny', 'tiny'],
    ['vs', 'vengeful spirit'],
    ['wr', 'windranger'],
    ['ww', 'winter wyvern'],
    ['wk', 'wraith king'],
]);

// Normaliza textos para facilitar comparação sem acentos, símbolos ou caixa diferente.
function normalizeText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

// Converte o nome interno da API para um formato legível e comparável.
function getInternalHeroName(hero) {
    return normalizeText(hero.name.replace(/^npc_dota_hero_/, '').replace(/_/g, ' '));
}

// Busca a lista de heróis da OpenDota, reutilizando cache quando possível.
async function getHeroes() {
    // Horário atual usado para validar o cache.
    const now = Date.now();

    // Retorna imediatamente os dados em memória se ainda forem válidos.
    if (heroCache.heroes && heroCache.expiresAt > now) {
        return heroCache.heroes;
    }

    // Faz a requisição HTTP para obter os heróis atualizados.
    const response = await fetch(HERO_STATS_URL, {
        headers: {
            // Identifica o cliente que está consumindo a API.
            'User-Agent': 'node-discord-bot/1.0',
        },
    });

    // Interrompe o fluxo caso a API responda com erro.
    if (!response.ok) {
        throw new Error(`OpenDota returned status ${response.status}.`);
    }

    // Converte a resposta JSON em objetos utilizáveis pelo código.
    const heroes = await response.json();

    // Atualiza o cache para próximas chamadas dentro do período definido.
    heroCache = {
        heroes,
        expiresAt: now + HERO_CACHE_TTL_MS,
    };

    return heroes;
}

// Tenta encontrar um herói pelo nome digitado, incluindo apelidos e correspondências parciais.
function resolveHeroQuery(heroes, rawQuery) {
    // Normaliza o texto recebido do usuário para comparação consistente.
    const normalizedQuery = normalizeText(rawQuery);

    // Verifica se o usuário usou um apelido conhecido.
    const aliasTarget = heroAliases.get(normalizedQuery);

    // Se houver apelido, usa o nome equivalente; caso contrário, usa o próprio texto normalizado.
    const effectiveQuery = aliasTarget ? normalizeText(aliasTarget) : normalizedQuery;

    // Procura correspondência exata pelo nome visível ou pelo nome interno da API.
    const exactMatch = heroes.find((hero) => {
        const name = normalizeText(hero.localized_name);
        const internalName = getInternalHeroName(hero);
        return name === effectiveQuery || internalName === effectiveQuery;
    });

    // Se encontrou um resultado exato, retorna imediatamente.
    if (exactMatch) {
        return { hero: exactMatch };
    }

    // Se não houve correspondência exata, procura nomes que começam com o texto informado.
    const startsWithMatches = heroes.filter((hero) => normalizeText(hero.localized_name).startsWith(effectiveQuery));

    // Se houver apenas um candidato claro, usa esse resultado.
    if (startsWithMatches.length === 1) {
        return { hero: startsWithMatches[0] };
    }

    // Como último passo, procura o texto em qualquer parte do nome visível ou interno.
    const includesMatches = heroes.filter((hero) => {
        const localizedName = normalizeText(hero.localized_name);
        const internalName = getInternalHeroName(hero);
        return localizedName.includes(effectiveQuery) || internalName.includes(effectiveQuery);
    });

    // Se apenas um herói corresponder de forma parcial, ele é retornado.
    if (includesMatches.length === 1) {
        return { hero: includesMatches[0] };
    }

    // Caso ainda exista ambiguidade, prepara sugestões para o usuário.
    const suggestions = (startsWithMatches.length ? startsWithMatches : includesMatches)
        .slice(0, 5)
        .map((hero) => hero.localized_name);

    // Retorna sem herói definido, mas com opções de nomes parecidos.
    return { hero: null, suggestions };
}

// Traduz o atributo principal abreviado da API para uma descrição mais amigável.
function formatPrimaryAttr(primaryAttr) {
    const mapping = {
        str: 'Strength',
        agi: 'Agility',
        int: 'Intelligence',
        all: 'Universal',
    };

    return mapping[primaryAttr] ?? primaryAttr;
}

// Escolhe a cor do embed de acordo com o atributo principal do herói.
function getHeroColor(primaryAttr) {
    const mapping = {
        str: 0xb22222,
        agi: 0x2e8b57,
        int: 0x4169e1,
        all: 0xdaa520,
    };

    return mapping[primaryAttr] ?? 0x5865f2;
}

// Monta o embed com as informações detalhadas do herói selecionado.
function buildHeroEmbed(hero) {
    // Junta as funções do herói em um texto único ou mostra "Unknown" se não houver dados.
    const roles = Array.isArray(hero.roles) && hero.roles.length ? hero.roles.join(', ') : 'Unknown';

    // Agrupa os atributos básicos e seus ganhos por nível em múltiplas linhas.
    const talents = [
        `Str: ${hero.base_str} (+${hero.str_gain}/lvl)`,
        `Agi: ${hero.base_agi} (+${hero.agi_gain}/lvl)`,
        `Int: ${hero.base_int} (+${hero.int_gain}/lvl)`,
    ].join('\n');

    // Cria o embed visual com seções de perfil, atributos, status e combate.
    return new EmbedBuilder()
        .setColor(getHeroColor(hero.primary_attr))
        .setTitle(hero.localized_name)
        .setDescription(`Informacoes basicas do heroi em Dota 2.`)
        .addFields(
            {
                name: 'Perfil',
                value: [
                    `Atributo principal: ${formatPrimaryAttr(hero.primary_attr)}`,
                    `Tipo de ataque: ${hero.attack_type}`,
                    `Funcoes: ${roles}`,
                    `Complexidade: ${hero.complexity ?? 'N/A'}`,
                ].join('\n'),
            },
            {
                name: 'Atributos',
                value: talents,
                inline: true,
            },
            {
                name: 'Status iniciais',
                value: [
                    `Vida: ${hero.base_health}`,
                    `Mana: ${hero.base_mana}`,
                    `Armadura: ${hero.base_armor}`,
                    `Move speed: ${hero.move_speed}`,
                ].join('\n'),
                inline: true,
            },
            {
                name: 'Combate',
                value: [
                    `Dano: ${hero.base_attack_min}-${hero.base_attack_max}`,
                    `Alcance: ${hero.attack_range}`,
                    `Projeteis/swing: ${hero.attack_rate}`,
                ].join('\n'),
                inline: false,
            },
        )
        // Informa a fonte de onde os dados foram retirados.
        .setFooter({ text: 'Fonte: OpenDota heroStats' });
}

module.exports = {
    // Define um cooldown de 5 segundos para o comando.
    cooldown: 5,

    // Registra o comando /hero e o parâmetro obrigatório com o nome do herói.
    data: new SlashCommandBuilder()
        .setName('hero')
        .setDescription('Mostra informacoes de um heroi de Dota 2.')
        .addStringOption((option) =>
            // Recebe o nome do herói, aceitando nome completo ou apelidos comuns.
            option
                .setName('nome')
                .setDescription('Nome do heroi. Ex.: juggernaut, pudge, anti mage, qop')
                .setRequired(true),
        ),

    // Executa a busca e a resposta do comando.
    async execute(interaction) {
        // Lê o nome informado pelo usuário.
        const heroName = interaction.options.getString('nome', true);

        // Ganha mais tempo para responder enquanto faz a consulta externa.
        await interaction.deferReply();

        try {
            // Obtém a lista de heróis atual da OpenDota ou do cache local.
            const heroes = await getHeroes();

            // Tenta resolver o texto digitado para um herói específico.
            const result = resolveHeroQuery(heroes, heroName);

            // Se nenhum herói foi encontrado, responde com sugestões ou mensagem de falha.
            if (!result.hero) {
                const suggestions = result.suggestions?.length
                    ? `Voce quis dizer: ${result.suggestions.join(', ')}?`
                    : 'Nao encontrei nenhum heroi com esse nome.';

                await interaction.editReply({
                    content: suggestions,
                });
                return;
            }

            // Envia o embed com os dados do herói encontrado.
            await interaction.editReply({
                embeds: [buildHeroEmbed(result.hero)],
            });
        } catch (error) {
            // Registra o erro no terminal para depuração.
            console.error(error);

            // Informa ao usuário que houve problema ao consultar a API externa.
            await interaction.editReply({
                content: 'Nao consegui buscar os dados do heroi agora. Tente novamente em instantes.',
            });
        }
    },
};
