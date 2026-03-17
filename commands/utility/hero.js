const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const HERO_STATS_URL = 'https://api.opendota.com/api/heroStats';
const HERO_CACHE_TTL_MS = 60 * 60 * 1000;

let heroCache = {
    expiresAt: 0,
    heroes: null,
};

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

function normalizeText(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function getInternalHeroName(hero) {
    return normalizeText(hero.name.replace(/^npc_dota_hero_/, '').replace(/_/g, ' '));
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

function resolveHeroQuery(heroes, rawQuery) {
    const normalizedQuery = normalizeText(rawQuery);
    const aliasTarget = heroAliases.get(normalizedQuery);
    const effectiveQuery = aliasTarget ? normalizeText(aliasTarget) : normalizedQuery;

    const exactMatch = heroes.find((hero) => {
        const name = normalizeText(hero.localized_name);
        const internalName = getInternalHeroName(hero);
        return name === effectiveQuery || internalName === effectiveQuery;
    });

    if (exactMatch) {
        return { hero: exactMatch };
    }

    const startsWithMatches = heroes.filter((hero) => normalizeText(hero.localized_name).startsWith(effectiveQuery));
    if (startsWithMatches.length === 1) {
        return { hero: startsWithMatches[0] };
    }

    const includesMatches = heroes.filter((hero) => {
        const localizedName = normalizeText(hero.localized_name);
        const internalName = getInternalHeroName(hero);
        return localizedName.includes(effectiveQuery) || internalName.includes(effectiveQuery);
    });

    if (includesMatches.length === 1) {
        return { hero: includesMatches[0] };
    }

    const suggestions = (startsWithMatches.length ? startsWithMatches : includesMatches)
        .slice(0, 5)
        .map((hero) => hero.localized_name);

    return { hero: null, suggestions };
}

function formatPrimaryAttr(primaryAttr) {
    const mapping = {
        str: 'Strength',
        agi: 'Agility',
        int: 'Intelligence',
        all: 'Universal',
    };

    return mapping[primaryAttr] ?? primaryAttr;
}

function getHeroColor(primaryAttr) {
    const mapping = {
        str: 0xb22222,
        agi: 0x2e8b57,
        int: 0x4169e1,
        all: 0xdaa520,
    };

    return mapping[primaryAttr] ?? 0x5865f2;
}

function buildHeroEmbed(hero) {
    const roles = Array.isArray(hero.roles) && hero.roles.length ? hero.roles.join(', ') : 'Unknown';
    const talents = [
        `Str: ${hero.base_str} (+${hero.str_gain}/lvl)`,
        `Agi: ${hero.base_agi} (+${hero.agi_gain}/lvl)`,
        `Int: ${hero.base_int} (+${hero.int_gain}/lvl)`,
    ].join('\n');

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
        .setFooter({ text: 'Fonte: OpenDota heroStats' });
}

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('hero')
        .setDescription('Mostra informacoes de um heroi de Dota 2.')
        .addStringOption((option) =>
            option
                .setName('nome')
                .setDescription('Nome do heroi. Ex.: juggernaut, pudge, anti mage, qop')
                .setRequired(true),
        ),
    async execute(interaction) {
        const heroName = interaction.options.getString('nome', true);

        await interaction.deferReply();

        try {
            const heroes = await getHeroes();
            const result = resolveHeroQuery(heroes, heroName);

            if (!result.hero) {
                const suggestions = result.suggestions?.length
                    ? `Voce quis dizer: ${result.suggestions.join(', ')}?`
                    : 'Nao encontrei nenhum heroi com esse nome.';

                await interaction.editReply({
                    content: suggestions,
                });
                return;
            }

            await interaction.editReply({
                embeds: [buildHeroEmbed(result.hero)],
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply({
                content: 'Nao consegui buscar os dados do heroi agora. Tente novamente em instantes.',
            });
        }
    },
};
