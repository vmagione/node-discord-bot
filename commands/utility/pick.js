// Importa classes para criar o comando slash e montar uma resposta visual com embed.
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

// Endpoint público da OpenDota com estatísticas consolidadas dos heróis.
const HERO_STATS_URL = 'https://api.opendota.com/api/heroStats';

// Tempo de vida do cache local: 30 minutos.
const HERO_CACHE_TTL_MS = 30 * 60 * 1000;

// Estrutura simples de cache para evitar chamadas repetidas à API a cada comando.
let heroCache = {
    expiresAt: 0,
    heroes: null,
};

// Traduz o número da posição do Dota para um rótulo mais amigável no embed.
const positionLabels = {
    1: 'Hard Carry',
    2: 'Mid',
    3: 'Offlaner',
    4: 'Soft Support',
    5: 'hard Support',
};

// Define o peso de cada função de herói para cada posição do jogo.
const roleWeightsByPosition = {
    1: {
        Carry: 4,
        Nuker: 1,
        Escape: 1,
        Durable: 1,
        Initiator: 0.5,
        Support: -3,
    },
    2: {
        Nuker: 3,
        Carry: 2,
        Escape: 1.5,
        Initiator: 1,
        Pusher: 1,
        Support: -2
    },
    3: {
        Durable: 3,
        Initiator: 3,
        Disabler: 1.5,
        Escape: 0.5,
        Carry: 0.5,
        Support: -3,
    },
    4: {
        Support: 3,
        Initiator: 2,
        Disabler: 2,
        Nuker: 1,
        Escape: 0.5,
        Carry: -3,
    },
    5: {
        Support: 4,
        Disabler: 1.5,
        Nuker: 0.5,
        Carry: -4,
    },
};

// Garante que um número fique dentro de um intervalo mínimo e máximo.
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Busca a lista de heróis usando cache quando os dados ainda estiverem válidos.
async function getHeroes() {
    // Captura o horário atual para comparar com o vencimento do cache.
    const now = Date.now();

    // Reaproveita os dados em memória se ainda não expiraram.
    if (heroCache.heroes && heroCache.expiresAt > now) {
        return heroCache.heroes;
    }

    // Faz a chamada HTTP para a API da OpenDota.
    const response = await fetch(HERO_STATS_URL, {
        headers: {
            // Envia um identificador simples da aplicação na requisição.
            'User-Agent': 'node-discord-bot/1.0',
        },
    });

    // Interrompe a execução caso a API responda com erro.
    if (!response.ok) {
        throw new Error(`OpenDota returned status ${response.status}.`);
    }

    // Converte a resposta JSON para objetos JavaScript.
    const heroes = await response.json();

    // Atualiza o cache com os novos dados e com o novo tempo de expiração.
    heroCache = {
        heroes,
        expiresAt: now + HERO_CACHE_TTL_MS,
    };

    return heroes;
}

// Calcula a taxa de vitória pública somando várias faixas de matchmaking.
function getPublicWinRate(hero) {
    // Acumula o total de partidas públicas analisadas.
    let picks = 0;

    // Acumula o total de vitórias nessas partidas públicas.
    let wins = 0;

    // A API divide dados públicos em brackets numerados de 1 a 8.
    for (let bracket = 1; bracket <= 8; bracket += 1) {
        picks += hero[`${bracket}_pick`] ?? 0;
        wins += hero[`${bracket}_win`] ?? 0;
    }

    // Evita divisão por zero quando não houver jogos suficientes.
    if (!picks) {
        return 0;
    }

    // Retorna a taxa em formato decimal, por exemplo 0.53 para 53%.
    return wins / picks;
}

// Calcula a taxa de vitória em partidas profissionais.
function getProWinRate(hero) {
    // Se não houver picks profissionais, retorna 0 para não distorcer o cálculo.
    if (!hero.pro_pick) {
        return 0;
    }

    // Divide vitórias por picks em jogos profissionais.
    return hero.pro_win / hero.pro_pick;
}

// Mede o quanto as funções naturais do herói combinam com a posição escolhida.
function getRoleFitScore(hero, position) {
    // Sem posição informada, não existe ajuste de afinidade.
    if (!position) {
        return 0;
    }

    // Recupera a tabela de pesos específica da posição.
    const roleWeights = roleWeightsByPosition[position];

    // Garante que roles seja sempre um array antes de percorrer.
    const roles = Array.isArray(hero.roles) ? hero.roles : [];

    // Soma os pesos das funções do herói para gerar uma pontuação final de encaixe.
    return roles.reduce((score, role) => score + (roleWeights[role] ?? 0), 0);
}

// Combina estatísticas públicas, profissionais e afinidade para gerar uma nota final do herói.
function getHeroScore(hero, position) {
    // Normaliza a lista de roles para evitar erros quando a API não trouxer esse campo.
    const roles = Array.isArray(hero.roles) ? hero.roles : [];

    // Mede desempenho em jogos públicos.
    const publicWinRate = getPublicWinRate(hero);

    // Mede desempenho em jogos profissionais.
    const proWinRate = getProWinRate(hero);

    // Mede o encaixe do herói na posição solicitada.
    const roleFitScore = getRoleFitScore(hero, position);

    // Usa logaritmo para suavizar o peso da presença profissional.
    const proPresenceScore = Math.log10((hero.pro_pick ?? 0) + 1);

    // Soma os picks públicos de todos os brackets e aplica logaritmo para reduzir extremos.
    const pubPresenceScore = Math.log10(
        Array.from({ length: 8 }, (_, index) => hero[`${index + 1}_pick`] ?? 0).reduce((sum, value) => sum + value, 0) + 1,
    );

    // Nota base que mistura desempenho e popularidade do herói.
    let score = (publicWinRate * 100) + (proWinRate * 25) + roleFitScore + (proPresenceScore * 2) + pubPresenceScore;

    // Ajustes extras quando o usuário pede uma posição específica.
    if (position) {
        // Penaliza heróis que praticamente não encaixam na função desejada.
        if (roleFitScore <= 0) {
            score -= 15;
        }

        // Penaliza supports corpo a corpo que não iniciam jogadas, pois costumam ser opções mais frágeis no critério escolhido.
        if ((position === 5 || position === 4) && hero.attack_type === 'Melee' && !roles.includes('Initiator')) {
            score -= 2;
        }

        // Penaliza heróis com perfil de suporte duro quando o pedido é core.
        if ((position === 1 || position === 2) && roles.includes('Hard Support')) {
            score -= 8;
        }
    }

    return {
        score,
        publicWinRate,
        proWinRate,
        roleFitScore,
    };
}

// Embaralha um array para que as sugestões não sejam sempre idênticas.
function shuffle(array) {
    // Copia o array original para não alterar os dados recebidos.
    const items = [...array];

    // Implementa o algoritmo de Fisher-Yates para embaralhamento uniforme.
    for (let index = items.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
}

// Seleciona os melhores candidatos e devolve uma quantidade final de sugestões.
function selectHeroSuggestions(heroes, quantity, position) {
    // Calcula a nota de cada herói, remove opções inviáveis e ordena do melhor para o pior.
    const scoredHeroes = heroes
        .map((hero) => ({
            hero,
            ...getHeroScore(hero, position),
        }))
        .filter((item) => !position || item.roleFitScore > 0)
        .sort((left, right) => right.score - left.score);

    // Cria um conjunto maior de candidatos para permitir alguma variedade aleatória.
    const poolSize = Math.max(quantity * 3, quantity);

    // Pega apenas o topo do ranking antes de embaralhar.
    const candidatePool = scoredHeroes.slice(0, poolSize);

    // Embaralha, recorta a quantidade pedida e reordena para mostrar primeiro as melhores opções sorteadas.
    return shuffle(candidatePool)
        .slice(0, quantity)
        .sort((left, right) => right.score - left.score);
}

// Monta o embed que será enviado ao Discord com as sugestões encontradas.
function buildPickEmbed(suggestions, position) {
    // Define o título de acordo com a posição informada ou com a busca geral.
    const title = position
        ? `Sugestoes para ${positionLabels[position]}`
        : 'Sugestoes de picks de Dota 2';

    // Resume a lógica da recomendação para contextualizar o usuário.
    const description = position
        ? 'Escolhi herois com boa aderencia a posicao e estatisticas fortes no OpenDota.'
        : 'Escolhi herois com base em desempenho geral e presenca nas estatisticas do OpenDota.';

    // Cria um embed visual com uma linha para cada herói sugerido.
    return new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(title)
        .setDescription(description)
        .addFields(
            // Transforma cada sugestão em um campo do embed.
            suggestions.map((suggestion, index) => ({
                name: `${index + 1}. ${suggestion.hero.localized_name}`,
                value: [
                    `Funcoes: ${(Array.isArray(suggestion.hero.roles) ? suggestion.hero.roles : []).join(', ') || 'N/A'}`,
                    `Win rate publica: ${(suggestion.publicWinRate * 100).toFixed(1)}%`,
                    `Win rate pro: ${suggestion.hero.pro_pick ? `${(suggestion.proWinRate * 100).toFixed(1)}%` : 'Sem dados suficientes'}`,
                    position ? `Afinidade com a posicao: ${suggestion.roleFitScore.toFixed(1)}` : `Atributo principal: ${suggestion.hero.primary_attr}`,
                ].join('\n'),
            })),
        )
        // Mostra a origem dos dados para deixar claro de onde veio a informação.
        .setFooter({ text: 'Fonte: OpenDota heroStats' });
}

module.exports = {
    // Define um cooldown de 5 segundos para o comando.
    cooldown: 5,

    // Registra o comando /pick e suas opções de posição e quantidade.
    data: new SlashCommandBuilder()
        .setName('pick')
        .setDescription('Sugere picks de herois de Dota 2 por posicao.')
        .addIntegerOption((option) =>
            // Permite filtrar a recomendação por posição do Dota.
            option
                .setName('posicao')
                .setDescription('Posicao desejada')
                .addChoices(
                    { name: 'Posicao 1', value: 1 },
                    { name: 'Posicao 2', value: 2 },
                    { name: 'Posicao 3', value: 3 },
                    { name: 'Posicao 4', value: 4 },
                    { name: 'Posicao 5', value: 5 },
                ),
        )
        .addIntegerOption((option) =>
            // Permite ao usuário escolher quantas sugestões deseja receber.
            option
                .setName('quantidade')
                .setDescription('Quantidade de sugestoes')
                .setMinValue(1)
                .setMaxValue(10),
        ),

    // Executa a busca das sugestões quando o comando é chamado.
    async execute(interaction) {
        // Lê a posição opcional informada pelo usuário.
        const position = interaction.options.getInteger('posicao');

        // Lê a quantidade opcional de sugestões solicitadas.
        const requestedQuantity = interaction.options.getInteger('quantidade');

        // Define a quantidade final respeitando limites mínimos e máximos.
        const quantity = clamp(requestedQuantity ?? (position ? 3 : 1), 1, 10);

        // Informa ao Discord que o bot está processando a resposta.
        await interaction.deferReply();

        try {
            // Busca a lista de heróis da API ou do cache local.
            const heroes = await getHeroes();

            // Gera a lista de sugestões com base na posição e quantidade.
            const suggestions = selectHeroSuggestions(heroes, quantity, position);

            // Trata o caso em que nenhum herói adequado tenha sido encontrado.
            if (!suggestions.length) {
                await interaction.editReply({
                    content: 'Nao encontrei herois suficientes para essa combinacao agora.',
                });
                return;
            }

            // Envia o embed final com as recomendações calculadas.
            await interaction.editReply({
                embeds: [buildPickEmbed(suggestions, position)],
            });
        } catch (error) {
            // Registra o erro no terminal para investigação futura.
            console.error(error);

            // Informa o usuário que houve falha ao consultar a API externa.
            await interaction.editReply({
                content: 'Nao consegui buscar sugestoes de picks agora. Tente novamente em instantes.',
            });
        }
    },
};
