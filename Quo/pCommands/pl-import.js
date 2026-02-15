const { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, ComponentType } = require('discord.js');
const { hexToDecimal } = require('../helpers/colorHelper');
const Playlist = require('../../database/models/Playlist');
const PlaylistTrack = require('../../database/models/PlaylistTrack');
const config = require('../config');
const emojis = require('../emojis.json');

module.exports = {
    name: 'pl import',
    aliases: ['playlist-import', 'plimport', 'pl-import'],
    description: 'Import playlist from share code or platform URL (Spotify, YouTube, SoundCloud, Apple Music)',

    async execute(message, args) {
        const { client, author: user } = message;

        if (!args || args.length === 0) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} Please provide a share code or playlist URL!`)
                );
            return message.reply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
            });
        }

        const codeOrUrl = args[0];
        const userId = user.id;

        const PLATFORM_URL_REGEX = /^(https?:\/\/)?(www\.)?(open\.spotify\.com|youtube\.com|youtu\.be|soundcloud\.com|music\.apple\.com)\/.+/i;

        if (PLATFORM_URL_REGEX.test(codeOrUrl.trim())) {
            return _importFromPlatform(message, codeOrUrl);
        }

        try {
            const originalPlaylist = await Playlist.findOne({
                where: { shareCode: codeOrUrl },
                include: [{ model: PlaylistTrack, as: 'tracks' }],
            });

            if (!originalPlaylist) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${emojis.error} Invalid share code! Please check the code and try again.`
                        )
                    );
                return message.reply({ 
                    components: [container], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                });
            }

            let newPlaylistName = originalPlaylist.name;

            const existing = await Playlist.findOne({ 
                where: { userId, name: newPlaylistName } 
            });
            
            if (existing) {
                newPlaylistName = `${newPlaylistName} (Imported)`;
            }

            const playlistCount = await Playlist.count({ where: { userId } });
            if (playlistCount >= config.MUSIC.PLAYLIST_LIMIT) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${emojis.error} You have reached the maximum playlist limit (**${config.MUSIC.PLAYLIST_LIMIT}** playlists)!`
                        )
                    );
                return message.reply({ 
                    components: [container], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                });
            }

            const newPlaylist = await Playlist.create({
                userId: userId,
                name: newPlaylistName,
            });

            const tracksToCopy = originalPlaylist.tracks.map((track) => ({
                playlistId: newPlaylist.id,
                title: track.title,
                identifier: track.identifier,
                author: track.author,
                length: track.length,
                uri: track.uri,
            }));

            await PlaylistTrack.bulkCreate(tracksToCopy);

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${emojis.success} Successfully imported **${tracksToCopy.length}** tracks from **${originalPlaylist.name}** as **${newPlaylist.name}**!`
                    )
                );

            return message.reply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            });
        } catch (error) {
            console.error('Playlist import from code failed:', error);
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${emojis.error} Failed to import playlist. Please try again.`
                    )
                );
            return message.reply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            });
        }
    },
};

async function _importFromPlatform(message, url) {
    const { client, author: user } = message;
    const userId = user.id;

    const loadingContainer = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`${emojis.music} Loading playlist...`)
        );
    const loadingMsg = await message.reply({ 
        components: [loadingContainer], 
        flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
    });

    const res = await client.aqua.resolve({
        query: url,
        requester: user,
    });
    
    if (!res || res.loadType !== 'playlist' || !res.tracks.length) {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${emojis.error} Failed to load playlist! Make sure the URL is valid and public.`
                )
            );
        return loadingMsg.edit({ 
            components: [container], 
            flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
        });
    }

    const playlistName = (res.playlistInfo || res.playlist || {}).name || 'Imported Playlist';
    const tracksFromPlatform = res.tracks;

    const existingPlaylist = await Playlist.findOne({ 
        where: { userId, name: playlistName }
    });
    
    if (existingPlaylist) {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${emojis.music} Playlist Already Exists\nYou already have a playlist named **${playlistName}**. What would you like to do?`
                )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('import_overwrite')
                .setLabel('Overwrite')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('import_copy')
                .setLabel('Create Copy')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('import_cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Secondary)
        );

        container.addActionRowComponents(row);

        const reply = await loadingMsg.edit({ 
            components: [container], 
            flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
        });

        const collector = reply.createMessageComponentCollector({
            filter: (i) => i.user.id === user.id,
            time: 60000,
        });

        collector.on('collect', async (i) => {
            await i.deferUpdate();

            if (i.customId === 'import_overwrite') {
                await PlaylistTrack.destroy({ where: { playlistId: existingPlaylist.id } });
                await _saveTracksToPlaylist(existingPlaylist, tracksFromPlatform);

                const successContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${emojis.success} Overwritten playlist **${playlistName}** with **${tracksFromPlatform.length}** tracks!`
                        )
                    );
                await i.editReply({ 
                    components: [successContainer], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                });
            } else if (i.customId === 'import_copy') {
                let newName = '';
                let copyNum = 1;
                let isNameAvailable = false;

                while (!isNameAvailable) {
                    newName = `${playlistName} (${copyNum})`;
                    const check = await Playlist.findOne({ where: { userId, name: newName } });
                    if (!check) {
                        isNameAvailable = true;
                    } else {
                        copyNum++;
                    }
                }

                const newPlaylist = await Playlist.create({ userId, name: newName });
                await _saveTracksToPlaylist(newPlaylist, tracksFromPlatform);

                const successContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${emojis.success} Created new playlist **${newName}** with **${tracksFromPlatform.length}** tracks!`
                        )
                    );
                await i.editReply({ 
                    components: [successContainer], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                });
            } else if (i.customId === 'import_cancel') {
                const cancelContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${emojis.error} Import cancelled.`)
                    );
                await i.editReply({ 
                    components: [cancelContainer], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                });
            }
            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timeoutContainer = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${emojis.error} Import timed out. Please try again.`)
                    );
                loadingMsg.edit({ 
                    components: [timeoutContainer], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                });
            }
        });
    } else {
        const playlistCount = await Playlist.count({ where: { userId } });
        if (playlistCount >= config.MUSIC.PLAYLIST_LIMIT) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${emojis.error} You have reached the maximum playlist limit (**${config.MUSIC.PLAYLIST_LIMIT}** playlists)!`
                    )
                );
            return message.reply({
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            });
        }

        const newPlaylist = await Playlist.create({ userId, name: playlistName });
        await _saveTracksToPlaylist(newPlaylist, tracksFromPlatform);

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${emojis.success} Successfully imported **${tracksFromPlatform.length}** tracks from playlist **${playlistName}**!`
                )
            );
        await loadingMsg.edit({ 
            components: [container], 
            flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
        });
    }
}

async function _saveTracksToPlaylist(playlist, tracks) {
    const tracksToSave = tracks.map((track) => ({
        playlistId: playlist.id,
        title: track.title,
        identifier: track.identifier,
        author: track.author,
        length: track.duration,
        uri: track.uri,
    }));
    await PlaylistTrack.bulkCreate(tracksToSave);
}

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/8wfT8SfB5Z  (Quo Development )
    + for any queries reach out Community or DM me.
*/
