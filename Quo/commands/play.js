const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { formatDuration } = require('../helpers/musicHelpers');
const { hexToDecimal } = require('../helpers/colorHelper');
const config = require('../config');
const emojis = require('../emojis.json');
const GuildSetting = require('../../database/models/GuildSetting');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or add it to the queue')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Song title or URL (YouTube, Spotify, etc.)')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    async autocomplete(interaction) {
        const { client, guild } = interaction;
        const focusedValue = interaction.options.getFocused();

        if (focusedValue.toLowerCase().includes('spotify')) {
            const truncatedUrl = focusedValue.length > 60 ? focusedValue.slice(0, 57) + '...' : focusedValue;
            return interaction.respond([{ 
                name: `Play Spotify: ${truncatedUrl}`, 
                value: focusedValue 
            }]);
        } else if (focusedValue.toLowerCase().includes('youtube')) {
            const truncatedUrl = focusedValue.length > 60 ? focusedValue.slice(0, 57) + '...' : focusedValue;
            return interaction.respond([{ 
                name: `Play Youtube: ${truncatedUrl}`, 
                value: focusedValue 
            }]);
        } else if (/^https?:\/\//.test(focusedValue)) {
            const truncatedUrl = focusedValue.length > 70 ? focusedValue.slice(0, 67) + '...' : focusedValue;
            return interaction.respond([{ 
                name: `Play from URL: ${truncatedUrl}`, 
                value: focusedValue 
            }]);
        }

        if (!client._musicAutocompleteCache) client._musicAutocompleteCache = new Map();
        const searchCache = client._musicAutocompleteCache;

        if (searchCache.has(focusedValue)) {
            return interaction.respond(searchCache.get(focusedValue));
        }

        if (!focusedValue || focusedValue.trim().length === 0) {
            return interaction.respond([]);
        }

        if (!client.aqua || typeof client.aqua.resolve !== 'function') {
            return interaction.respond([]);
        }

        try {
            let source = config.MUSIC.DEFAULT_PLATFORM || 'ytsearch';
            const settings = await GuildSetting.findOne({ where: { guildId: guild.id } });
            if (settings && settings.defaultSource) {
                source = settings.defaultSource;
            }

            const res = await client.aqua.resolve({ query: focusedValue, source: source, requester: interaction.user });
            if (!res || !res.tracks || !Array.isArray(res.tracks) || res.tracks.length === 0) {
                return interaction.respond([]);
            }
            const choices = res.tracks.slice(0, config.MUSIC.AUTOCOMPLETE_LIMIT).map((choice) => ({
                name: `${choice.title.length > 85 ? choice.title.slice(0, 82) + '…' : choice.title} [${formatDuration(choice.duration)}]`,
                value: choice.uri,
            }));
            searchCache.set(focusedValue, choices);
            return interaction.respond(choices);
        } catch (e) {
            return interaction.respond([]);
        }
    },

    async execute(interaction) {
        const { client, member, guild, options, channel } = interaction;
        
        if (!member.voice.channel) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} You need to be in a voice channel to play music!`)
                );
            return interaction.reply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                ephemeral: true 
            });
        }

        await interaction.deferReply();
        const query = options.getString('search');

        if (query.toLowerCase().includes('spotify') && (!config.SPOTIFY.CLIENT_ID || !config.SPOTIFY.CLIENT_SECRET)) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} Spotify is not configured by the bot owner.`)
                );
            return interaction.editReply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            });
        }

        let source = config.MUSIC.DEFAULT_PLATFORM || 'ytsearch';
        const settings = await GuildSetting.findOne({ where: { guildId: guild.id } });
        if (settings && settings.defaultSource) {
            source = settings.defaultSource;
        }

        let res;
        try {
            res = await client.aqua.resolve({ query, source, requester: interaction.user });
        } catch (e) {
            console.error('Aqua resolve error:', e);
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} Failed to search: ${e?.message || 'Unknown error'}`)
                );
            return interaction.editReply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            });
        }

        if (res.loadType === 'playlist') {
            const player = client.aqua.createConnection({
                guildId: guild.id,
                voiceChannel: member.voice.channel.id,
                textChannel: channel.id,
                deaf: true,
            });

            for (const track of res.tracks) {
                track.requester = interaction.user;
                player.queue.add(track);
            }

            if (!player.playing && player.connected) player.play();

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${emojis.music} Playlist ${ (res.playlistInfo || res.playlist)?.name || 'Playlist'}\nAdded **${res.tracks.length}** tracks to the queue!`
                    )
                );
            
            return interaction.editReply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            });
        }

        if (res.loadType === 'search') {
            const filteredTracks = res.tracks.filter((track) => !track.isStream && track.duration > 30000);
            if (!filteredTracks.length) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${emojis.error} No results found (filtered out shorts).`)
                    );
                return interaction.editReply({ 
                    components: [container], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                });
            }
            res.tracks = filteredTracks;
        }

        if (res.loadType === 'error' || res.loadType === 'LOAD_FAILED') {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} Failed to load: ${res.exception?.message || 'Unknown error'}`)
                );
            return interaction.editReply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            });
        }

        if (res.loadType === 'empty' || res.loadType === 'NO_MATCHES') {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} No results found.`)
                );
            return interaction.editReply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            });
        }

        const player = client.aqua.createConnection({
            guildId: guild.id,
            voiceChannel: member.voice.channel.id,
            textChannel: channel.id,
            deaf: true,
        });

        const track = res.tracks[0];
        track.requester = interaction.user;
        player.queue.add(track);

        if (!player.playing && player.connected) player.play();

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${emojis.success} Added **[${track.title}](${track.uri})** to the queue!`
                )
            );

        return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
        });
    },
};

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/8wfT8SfB5Z  (Quo Development )
    + for any queries reach out Community or DM me.
*/
