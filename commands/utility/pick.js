const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const HERO_STATS_URL = 'https://api.opendota.com/api/heroStats';
const HERO_CACHE_TTL_MS = 30 * 60 * 1000;

let heroCache = {
    expiresAt: 0,
    heroes: null,
};

const positionLabels = {
    1: 'Hard Carry',
    2: 'Mid',
    3: 'Offlaner',
    4: 'Soft Support',
    5: 'hard Support',
};

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

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

async function getHeroes() {
    const now = Date.now();
    if (heroCache.heroes && heroCache.expiresAt > now) {
        return heroCache.heroes;
    }

    const response = await fetch(HERO_STATS_URL, {
        headers: {
            'User-Agent': 'node-discord-bot/1.0',
        },
    });

    if (!response.ok) {
        throw new Error(`OpenDota returned status ${response.status}.`);
    }

    const heroes = await response.json();
    heroCache = {
        heroes,
        expiresAt: now + HERO_CACHE_TTL_MS,
    };

    return heroes;
}

function getPublicWinRate(hero) {
    let picks = 0;
    let wins = 0;

    for (let bracket = 1; bracket <= 8; bracket += 1) {
        picks += hero[`${bracket}_pick`] ?? 0;
        wins += hero[`${bracket}_win`] ?? 0;
    }

    if (!picks) {
        return 0;
    }

    return wins / picks;
}

function getProWinRate(hero) {
    if (!hero.pro_pick) {
        return 0;
    }

    return hero.pro_win / hero.pro_pick;
}

function getRoleFitScore(hero, position) {
    if (!position) {
        return 0;
    }

    const roleWeights = roleWeightsByPosition[position];
    const roles = Array.isArray(hero.roles) ? hero.roles : [];

    return roles.reduce((score, role) => score + (roleWeights[role] ?? 0), 0);
}

function getHeroScore(hero, position) {
    const roles = Array.isArray(hero.roles) ? hero.roles : [];
    const publicWinRate = getPublicWinRate(hero);
    const proWinRate = getProWinRate(hero);
    const roleFitScore = getRoleFitScore(hero, position);
    const proPresenceScore = Math.log10((hero.pro_pick ?? 0) + 1);
    const pubPresenceScore = Math.log10(
        Array.from({ length: 8 }, (_, index) => hero[`${index + 1}_pick`] ?? 0).reduce((sum, value) => sum + value, 0) + 1,
    );

    let score = (publicWinRate * 100) + (proWinRate * 25) + roleFitScore + (proPresenceScore * 2) + pubPresenceScore;

    if (position) {
        if (roleFitScore <= 0) {
            score -= 15;
        }

        if ((position === 5 || position === 4) && hero.attack_type === 'Melee' && !roles.includes('Initiator')) {
            score -= 2;
        }

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

function shuffle(array) {
    const items = [...array];
    for (let index = items.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }
    return items;
}

function selectHeroSuggestions(heroes, quantity, position) {
    const scoredHeroes = heroes
        .map((hero) => ({
            hero,
            ...getHeroScore(hero, position),
        }))
        .filter((item) => !position || item.roleFitScore > 0)
        .sort((left, right) => right.score - left.score);

    const poolSize = Math.max(quantity * 3, quantity);
    const candidatePool = scoredHeroes.slice(0, poolSize);

    return shuffle(candidatePool)
        .slice(0, quantity)
        .sort((left, right) => right.score - left.score);
}

function buildPickEmbed(suggestions, position) {
    const title = position
        ? `Sugestoes para ${positionLabels[position]}`
        : 'Sugestoes de picks de Dota 2';

    const description = position
        ? 'Escolhi herois com boa aderencia a posicao e estatisticas fortes no OpenDota.'
        : 'Escolhi herois com base em desempenho geral e presenca nas estatisticas do OpenDota.';

    return new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(title)
        .setDescription(description)
        .addFields(
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
        .setFooter({ text: 'Fonte: OpenDota heroStats' });
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('pick')
        .setDescription('Sugere picks de herois de Dota 2 por posicao.')
        .addIntegerOption((option) =>
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
            option
                .setName('quantidade')
                .setDescription('Quantidade de sugestoes')
                .setMinValue(1)
                .setMaxValue(10),
        ),
    async execute(interaction) {
        const position = interaction.options.getInteger('posicao');
        const requestedQuantity = interaction.options.getInteger('quantidade');
        const quantity = clamp(requestedQuantity ?? (position ? 3 : 1), 1, 10);

        await interaction.deferReply();

        try {
            const heroes = await getHeroes();
            const suggestions = selectHeroSuggestions(heroes, quantity, position);

            if (!suggestions.length) {
                await interaction.editReply({
                    content: 'Nao encontrei herois suficientes para essa combinacao agora.',
                });
                return;
            }

            await interaction.editReply({
                embeds: [buildPickEmbed(suggestions, position)],
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: 'Nao consegui buscar sugestoes de picks agora. Tente novamente em instantes.',
            });
        }
    },
};
