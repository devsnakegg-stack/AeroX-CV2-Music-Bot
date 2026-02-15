const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { formatDuration } = require('../helpers/musicHelpers');
const { hexToDecimal } = require('../helpers/colorHelper');
const config = require('../config');
const emojis = require('../emojis.json');
const GuildSetting = require('../../database/models/GuildSetting');

module.exports = {
    name: 'play',
    description: 'Play a song or add it to the queue',
    
    async execute(message, args) {
        const { client, member, guild, channel } = message;
        
        if (!member.voice.channel) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} You need to be in a voice channel to play music!`)
                );
            return message.reply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
            });
        }

        if (!args || args.length === 0) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} Please provide a song title or URL!`)
                );
            return message.reply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
            });
        }

        const query = args.join(' ');

        if (query.toLowerCase().includes('spotify') && (!config.SPOTIFY.CLIENT_ID || !config.SPOTIFY.CLIENT_SECRET)) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} Spotify is not configured by the bot owner.`)
                );
            return message.reply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
            });
        }

        const searchContainer = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${emojis.music} Searching for **${query}**...`)
            );
        const loadingMsg = await message.reply({ 
            components: [searchContainer], 
            flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
        });

        let source = config.MUSIC.DEFAULT_PLATFORM || 'ytsearch';
        const settings = await GuildSetting.findOne({ where: { guildId: guild.id } });
        if (settings && settings.defaultSource) {
            source = settings.defaultSource;
        }

        let res;
        try {
            res = await client.aqua.resolve({ query, source, requester: message.author });
        } catch (e) {
            console.error('Aqua resolve error:', e);
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} Failed to search: ${e?.message || 'Unknown error'}`)
                );
            return loadingMsg.edit({ 
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
                track.requester = message.author;
                player.queue.add(track);
            }

            if (!player.playing && player.connected) player.play();

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${emojis.music} Playlist ${ (res.playlistInfo || res.playlist)?.name || 'Playlist'}\nAdded **${res.tracks.length}** tracks to the queue!`
                    )
                );
            return loadingMsg.edit({ 
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
                return loadingMsg.edit({ 
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
            return loadingMsg.edit({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
            });
        }

        if (res.loadType === 'empty' || res.loadType === 'NO_MATCHES') {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} No results found.`)
                );
            return loadingMsg.edit({ 
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
        track.requester = message.author;
        player.queue.add(track);

        if (!player.playing && player.connected) player.play();

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${emojis.success} Added **[${track.title}](${track.uri})** to the queue!`
                )
            );
        return loadingMsg.edit({
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
