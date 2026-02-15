const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, SeparatorBuilder, SeparatorSpacingSize, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType } = require('discord.js');
const { hexToDecimal } = require('../helpers/colorHelper');
const Favorite = require('../../database/models/Favorite');
const GuildSetting = require('../../database/models/GuildSetting');
const config = require('../config');
const emojis = require('../emojis.json');

function setupMusicEvents(client) {
    client.aqua.on('trackStart', async (player, track) => {
        const channel = client.channels.cache.get(player.textChannel);
        if (!channel) return;

        player._lastPlayedTrack = track;
        
        if (!player._autoplayHistory) {
            player._autoplayHistory = new Set();
        }
        if (track.identifier) {
            player._autoplayHistory.add(track.identifier);
        }

        if (player.nowPlayingMessage && player.nowPlayingMessage.deletable) {
            try {
                await player.nowPlayingMessage.delete().catch(() => {});
            } catch (e) {}
            player.nowPlayingMessage = null;
        }

        if (player.updateInterval) clearInterval(player.updateInterval);

        if (player.buttonCollector) {
            try {
                player.buttonCollector.stop('newTrack');
            } catch (e) {}
            player.buttonCollector = null;
        }

        const nowPlayingText = `## ${emojis.music} Now Playing... \n[${track.title}](${track.uri}) \n\n`;

        function getFirstControlButtonRow(isPaused, disabled = false) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('music_pause_resume')
                    .setEmoji(isPaused ? emojis.play : emojis.pause)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('music_skip')
                    .setEmoji(emojis.skip)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('music_stop')
                    .setEmoji(emojis.stop)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('music_loop')
                    .setEmoji(emojis.loop)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('music_autoplay')
                    .setEmoji(emojis.autoplay)
                    .setStyle(player.isAutoplayEnabled ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(disabled)
            );
        }

        function getSecondControlButtonRow(disabled = false) {
            return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('music_lyrics')
                    .setEmoji(emojis.lyrics)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('music_queue')
                    .setEmoji(emojis.queue)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('music_shuffle')
                    .setEmoji(emojis.shuffle)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('music_filter')
                    .setEmoji(emojis.filter)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled),
                new ButtonBuilder()
                    .setCustomId('music_favorite_add')
                    .setEmoji(emojis.favorite)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(disabled)
            );
        }

        let firstControlButtonRow = getFirstControlButtonRow(player.paused, false);
        let secondControlButtonRow = getSecondControlButtonRow(false);

        const container = new ContainerBuilder();
        
        if (track.artworkUrl || track.thumbnail) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems([new MediaGalleryItemBuilder().setURL(track.artworkUrl || track.thumbnail)])
            );
        }

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(nowPlayingText));

        container
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addActionRowComponents(firstControlButtonRow)
            .addActionRowComponents(secondControlButtonRow)
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

        try {
            const messageOptions = {
                components: [container],
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
            };

            const message = await channel.send(messageOptions);
            player.nowPlayingMessage = message;

            const filter = (i) => i.isButton() && i.message.id === message.id && i.guildId === player.guildId && i.customId.startsWith('music_');
            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                filter,
            });
            player.buttonCollector = collector;

            collector.on('collect', async (interaction) => {
                if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== player.voiceChannel) {
                    const errorContainer = new ContainerBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} You must be in the same voice channel as the bot!`));
                    return interaction.reply({ 
                        components: [errorContainer], 
                        flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                        ephemeral: true 
                    });
                }

                try {
                    switch (interaction.customId) {
                        case 'music_pause_resume': {
                            player.pause(!player.paused);
                            const state = player.paused ? `${emojis.pause} Music paused.` : `${emojis.resume} Music resumed.`;
                            const container = new ContainerBuilder()
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(state));
                            await interaction.reply({ 
                                components: [container], 
                                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                                ephemeral: true 
                            });
                            break;
                        }
                        case 'music_skip': {
                            if (!player.current) {
                                const container = new ContainerBuilder()
                                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} Nothing to skip!`));
                                return interaction.reply({ 
                                    components: [container], 
                                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                                    ephemeral: true 
                                });
                            }
                            player.skip();
                            const container = new ContainerBuilder()
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.skip} Skipped the current track.`));
                            await interaction.reply({ 
                                components: [container], 
                                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                                ephemeral: true 
                            });
                            break;
                        }
                        case 'music_stop': {
                            player.queue.clear();
                            player.destroy();
                            const container = new ContainerBuilder()
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.stop} Stopped music and cleared the queue.`));
                            await interaction.reply({ 
                                components: [container], 
                                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                                ephemeral: true 
                            });
                            break;
                        }
                        case 'music_loop': {
                            if (player.loop === 0) {
                                player.setLoop(1);
                                var msg = `${emojis.loopTrack} Loop track enabled.`;
                            } else if (player.loop === 1) {
                                player.setLoop(2);
                                var msg = `${emojis.loop} Queue repeat enabled.`;
                            } else {
                                player.setLoop(0);
                                var msg = `${emojis.error} Loop disabled.`;
                            }
                            const container = new ContainerBuilder()
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(msg));
                            await interaction.reply({ 
                                components: [container], 
                                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                                ephemeral: true 
                            });
                            break;
                        }
                        case 'music_autoplay': {
                            player.setAutoplay(!player.isAutoplayEnabled);
                            const container = new ContainerBuilder()
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.autoplay} Autoplay ${player.isAutoplayEnabled ? 'enabled' : 'disabled'}.`));
                            await interaction.reply({ 
                                components: [container], 
                                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                                ephemeral: true 
                            });
                            
                            break;
                        }
                        case 'music_lyrics': {
                            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                            
                            try {
                                if (!player.current) {
                                    const container = new ContainerBuilder()
                                        .addTextDisplayComponents(
                                            new TextDisplayBuilder().setContent(`${emojis.error} No track is currently playing!`)
                                        );
                                    return interaction.editReply({ 
                                        components: [container], 
                                        flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                                    });
                                }

                                const track = player.current;
                            let artist, titleForSearch;
                            const separators = ['-', '–', '|'];
                            let potentialSplit = null;
                            const originalTitle = track.title || '';

                            for (const sep of separators) {
                                if (originalTitle.includes(sep)) {
                                    potentialSplit = originalTitle.split(sep);
                                    break;
                                }
                            }

                            if (potentialSplit && potentialSplit.length >= 2) {
                                artist = potentialSplit[0].trim();
                                titleForSearch = potentialSplit.slice(1).join(' ').trim();
                            } else {
                                artist = track.author || '';
                                titleForSearch = originalTitle;
                            }

                            const cleanUpRegex = /official|lyric|video|audio|mv|hd|hq|ft|feat/gi;
                            artist = artist.replace(cleanUpRegex, '').trim();
                            titleForSearch = titleForSearch.replace(cleanUpRegex, '').trim();
                            titleForSearch = titleForSearch.replace(/\(.*?\)|\[.*?\]/g, '').trim();

                            let lyrics = null;
                            let foundRecord = null;
                            let embedArtist = artist;
                            let embedTitle = titleForSearch;

                            try {
                                const params = new URLSearchParams();
                                if (titleForSearch) {
                                    params.set('track_name', titleForSearch);
                                } else if (originalTitle) {
                                    params.set('q', originalTitle);
                                }

                                if (artist) params.set('artist_name', artist);

                                const headers = {
                                    'User-Agent': 'Quo-Music Bot v1.0',
                                };

                                const lrclibUrl = `https://lrclib.net/api/search?${params.toString()}`;
                                const response = await fetch(lrclibUrl, { headers });
                                
                                if (response.status === 200) {
                                    const list = await response.json();
                                    if (Array.isArray(list) && list.length > 0) {
                                        foundRecord = list.find(record => {
                                            return (
                                                record.trackName &&
                                                record.artistName &&
                                                record.trackName.toLowerCase().includes(titleForSearch.toLowerCase()) &&
                                                record.artistName.toLowerCase().includes(artist.toLowerCase())
                                            );
                                        }) || list[0];

                                        if (foundRecord && (foundRecord.plainLyrics || foundRecord.syncedLyrics)) {
                                            lyrics = foundRecord.plainLyrics || foundRecord.syncedLyrics;
                                        }
                                    }
                                }
                            } catch (e) {
                                console.error('LRCLIB API request failed:', e);
                            }

                            if (!lyrics && artist && titleForSearch) {
                                try {
                                    const lyricsOvhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(titleForSearch)}`;
                                    const response = await fetch(lyricsOvhUrl);
                                    
                                    if (response.status === 200) {
                                        const data = await response.json();
                                        if (data && data.lyrics) {
                                            lyrics = data.lyrics;
                                            foundRecord = { source: 'lyrics.ovh' };
                                        }
                                    }
                                } catch (e) {
                                    console.error('Lyrics.ovh API request failed:', e);
                                }
                            }

                            if (!lyrics && config.GENIUS && config.GENIUS.API_KEY) {
                                try {
                                    const Genius = require('genius-lyrics');
                                    const searchQuery = `${artist} ${titleForSearch}`.trim();
                                    
                                    if (searchQuery.length > 0) {
                                        const geniusClient = new Genius.Client(config.GENIUS.API_KEY);
                                        const searches = await geniusClient.songs.search(searchQuery);
                                        
                                        if (searches && searches.length > 0) {
                                            const song = searches[0];
                                            const songLyrics = await song.lyrics();
                                            
                                            if (songLyrics) {
                                                lyrics = songLyrics;
                                                embedArtist = song.artist.name;
                                                embedTitle = song.title;
                                                foundRecord = { source: 'genius' };
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.error('Genius API failed:', e.message);
                                }
                            }

                            if (!lyrics) {
                                try {
                                    const container = new ContainerBuilder()
                                        .addTextDisplayComponents(
                                            new TextDisplayBuilder().setContent(`${emojis.error} Could not find lyrics for this song.`)
                                        );
                                    return await interaction.editReply({ 
                                        components: [container], 
                                        flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                                    });
                                } catch (editError) {
                                    console.error('Failed to send lyrics not found message:', editError);
                                }
                            }

                            const trimmedLyrics = lyrics.length > 3900 ? lyrics.substring(0, 3897) + '...' : lyrics;

                            if (foundRecord && foundRecord.source !== 'genius') {
                                embedArtist = foundRecord.artistName || embedArtist;
                                embedTitle = foundRecord.trackName || embedTitle;
                            }

                            const lyricsSource = foundRecord?.source === 'genius' ? 'genius.com' : foundRecord?.source === 'lyrics.ovh' ? 'lyrics.ovh' : 'lrclib.net';
                            
                            const container = new ContainerBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`## ${emojis.lyrics} ${embedArtist} - ${embedTitle}`)
                                )
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`[View on YouTube](${track.uri})`)
                                )
                                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(trimmedLyrics)
                                )
                                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(`Source: ${lyricsSource}`)
                                );

                            return interaction.editReply({ 
                                components: [container], 
                                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                            });
                            } catch (lyricsError) {
                                console.error('Error in lyrics button handler:', lyricsError);
                                try {
                                    const errorContainer = new ContainerBuilder()
                                        .addTextDisplayComponents(
                                            new TextDisplayBuilder().setContent(`${emojis.error} An error occurred while fetching lyrics.`)
                                        );
                                    await interaction.editReply({ 
                                        components: [errorContainer], 
                                        flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                                    });
                                } catch (finalError) {
                                    console.error('Failed to send error message:', finalError);
                                }
                            }
                            break;
                        }
                        case 'music_queue': {
                            const currentPlayer = client.aqua.players.get(interaction.guildId);
                            if (!currentPlayer || !currentPlayer.current) {
                                const container = new ContainerBuilder()
                                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} No music is currently playing!`));
                                return interaction.reply({ 
                                    components: [container], 
                                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                                    ephemeral: true 
                                });
                            }
                            
                            const command = client.commands.get('queue');
                            if (command) {
                                await command.execute(interaction);
                            }
                            break;
                        }
                        case 'music_shuffle': {
                            if (player.queue.size === 0) {
                                const container = new ContainerBuilder()
                                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} The queue is empty!`));
                                return interaction.reply({ 
                                    components: [container], 
                                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                                    ephemeral: true 
                                });
                            }
                            player.queue.shuffle();
                            const container = new ContainerBuilder()
                                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.shuffle} Queue shuffled.`));
                            await interaction.reply({ 
                                components: [container], 
                                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                                ephemeral: true 
                            });
                            break;
                        }
                        case 'music_filter': {
                            const filterCommand = client.commands.get('filter');
                            if (filterCommand) {
                                await filterCommand.execute(interaction);
                            }
                            break;
                        }
                        case 'music_favorite_add': {
                            const favoriteAddCommand = client.commands.get('favoriteadd');
                            if (favoriteAddCommand) {
                                await favoriteAddCommand.execute(interaction);
                            }
                            break;
                        }
                    }
                } catch (error) {
                    console.error('Button interaction error:', error);
                }
            });

            
            player.updateInterval = setInterval(async () => {
                    if (!player.current || !player.nowPlayingMessage?.editable) {
                        clearInterval(player.updateInterval);
                        return;
                    }

                    const updatedFirstControlButtonRow = getFirstControlButtonRow(player.paused, false);
                    const updatedSecondControlButtonRow = getSecondControlButtonRow(false);

                    const updatedContainer = new ContainerBuilder();

                    if (track.artworkUrl || track.thumbnail) {
                        updatedContainer.addMediaGalleryComponents(
                            new MediaGalleryBuilder().addItems([new MediaGalleryItemBuilder().setURL(track.artworkUrl || track.thumbnail)])
                        );
                    }
                    updatedContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(nowPlayingText));

                    updatedContainer
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
                        .addActionRowComponents(updatedFirstControlButtonRow)
                        .addActionRowComponents(updatedSecondControlButtonRow)
                        .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

                    try {
                        const editOptions = {
                            components: [updatedContainer],
                            flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2,
                        };

                        await player.nowPlayingMessage.edit(editOptions);
                    } catch (e) {
                        clearInterval(player.updateInterval);
                    }
                }, 5000);
        } catch (e) {
            console.error('Error sending now playing message:', e);
        }
    });

    client.aqua.on('trackEnd', async (player, track, data) => {
        if (player.updateInterval) clearInterval(player.updateInterval);
    });

    client.aqua.on('queueEnd', async (player) => {
        if (player.updateInterval) clearInterval(player.updateInterval);
        
        const settings = await GuildSetting.findOne({ where: { guildId: player.guildId } });
        if (settings && settings.twentyFourSeven) return;

        if (!player.isAutoplayEnabled) return;

        const lastTrack = player._lastPlayedTrack || player.current;
        
        if (!lastTrack) return;

        try {
            const channel = client.channels.cache.get(player.textChannel);
            if (!channel) return;

            const trackTitle = lastTrack.title || '';
            const trackArtist = lastTrack.author || '';
            const trackUri = lastTrack.uri || '';
            const trackIdentifier = lastTrack.identifier || '';
            
            let source = config.MUSIC.DEFAULT_PLATFORM || 'ytmsearch';
            if (settings && settings.defaultSource) {
                source = settings.defaultSource;
            }

            let resolve;
            
            if (trackUri && (trackUri.includes('youtube.com') || trackUri.includes('youtu.be'))) {
                resolve = await client.aqua.resolve({
                    query: `https://music.youtube.com/watch?v=${trackIdentifier}&list=RD${trackIdentifier}`,
                    source: source,
                    requester: lastTrack.requester
                });
            }
            
            if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
                const searchQuery = `${trackTitle} ${trackArtist}`.trim();
                resolve = await client.aqua.resolve({
                    query: searchQuery,
                    source: source,
                    requester: lastTrack.requester
                });
            }
            
            if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${emojis.autoplay} Autoplay couldn't find related tracks. Use \`/play\` to add more songs!`)
                    );
                await channel.send({ 
                    components: [container], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                }).catch(() => {});
                return;
            }

            const maxAutoplayTracks = 6;
            const addedTracks = [];
            const seenTracks = new Set();
            
            const normalizeTitle = (title) => {
                return title.toLowerCase()
                    .replace(/\s*\(.*?\)\s*/g, '')
                    .replace(/\s*\[.*?\]\s*/g, '')
                    .replace(/[^\w\s]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
            };
            
            const lastTrackNormalized = normalizeTitle(trackTitle);
            seenTracks.add(lastTrackNormalized);
            
            if (!player._autoplayHistory) {
                player._autoplayHistory = new Set();
            }
            
            for (const track of resolve.tracks) {
                if (addedTracks.length >= maxAutoplayTracks) break;
                
                const currentTitle = normalizeTitle(track.title || '');
                const trackId = track.identifier;
                
                if (trackId && player._autoplayHistory.has(trackId)) {
                    continue;
                }
                
                if (!seenTracks.has(currentTitle) && currentTitle && track.author) {
                    addedTracks.push(track);
                    seenTracks.add(currentTitle);
                }
            }
            
            if (addedTracks.length === 0) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${emojis.autoplay} Autoplay found only duplicates. Use \`/play\` to add more songs!`)
                    );
                await channel.send({ 
                    components: [container], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                }).catch(() => {});
                return;
            }

            for (const track of addedTracks) {
                player.queue.add(track);
            }
            
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${emojis.autoplay} **Autoplay Active**\n\n` +
                        `Added ${addedTracks.length} similar track${addedTracks.length > 1 ? 's' : ''} to queue\n` +
                        `Based on: **${trackTitle}**`
                    )
                );
            await channel.send({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            }).catch(() => {});
            
            if (player.connected && !player.playing) {
                try {
                    player.play();
                } catch (err) {
                    console.error('[Autoplay] Error starting playback:', err);
                }
            }
            
        } catch (error) {
            console.error('[Autoplay] Error:', error);
            const channel = client.channels.cache.get(player.textChannel);
            if (channel) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${emojis.error} Autoplay encountered an error. Use \`/play\` to continue!`)
                    );
                await channel.send({ 
                    components: [container], 
                    flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
                }).catch(() => {});
            }
        }
    });

    client.aqua.on('playerDestroy', (player) => {
        if (player.updateInterval) clearInterval(player.updateInterval);
        if (player.buttonCollector) {
            try {
                player.buttonCollector.stop();
            } catch (e) {}
        }
        if (player._autoplayHistory) {
            player._autoplayHistory.clear();
        }
    });
}

module.exports = { setupMusicEvents };

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/8wfT8SfB5Z  (Quo Development )
    + for any queries reach out Community or DM me.
*/
