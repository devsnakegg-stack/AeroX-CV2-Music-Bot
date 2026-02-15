const { Events, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const emojis = require('../emojis.json');
const GuildSetting = require('../../database/models/GuildSetting');

const aloneTimeouts = new Map();

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const client = newState.client || oldState.client;
        const guild = newState.guild;
        const player = client.aqua.players.get(guild.id);
        
        if (!player) return;

        if (newState.id === client.user.id) {
            if (!newState.channelId) {
                // Clear inactivity timeout first to prevent duplicate messages
                if (aloneTimeouts.has(guild.id)) {
                    clearTimeout(aloneTimeouts.get(guild.id));
                    aloneTimeouts.delete(guild.id);
                }
                
                const channel = client.channels.cache.get(player.textChannel);
                if (channel) {
                    const container = new ContainerBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `${emojis.stop} I was disconnected from the voice channel. Clearing the queue.`
                            )
                        );
                    await channel.send({
                        components: [container],
                        flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
                    }).catch(() => {});
                }
                
                if (player.updateInterval) clearInterval(player.updateInterval);
                if (player.buttonCollector) {
                    try {
                        player.buttonCollector.stop('botDisconnected');
                    } catch (e) {}
                }
                
                player.destroy();
                
                return;
            }
        }

        const settings = await GuildSetting.findOne({ where: { guildId: guild.id } });
        if (settings && settings.twentyFourSeven) {
             if (aloneTimeouts.has(guild.id)) {
                clearTimeout(aloneTimeouts.get(guild.id));
                aloneTimeouts.delete(guild.id);
            }
            return;
        }
        
        const voiceChannel = guild.channels.cache.get(player.voiceChannel);
        if (!voiceChannel) return;
        
        const members = voiceChannel.members.filter(m => !m.user.bot);
        
        if (members.size === 0) {
            if (!aloneTimeouts.has(guild.id)) {
                const timeout = setTimeout(async () => {
                    const currentPlayer = client.aqua.players.get(guild.id);
                    if (!currentPlayer) {
                        aloneTimeouts.delete(guild.id);
                        return;
                    }
                    
                    const currentVoiceChannel = guild.channels.cache.get(currentPlayer.voiceChannel);
                    if (!currentVoiceChannel) {
                        aloneTimeouts.delete(guild.id);
                        return;
                    }

                    // Re-check settings in case they were toggled during the timeout
                    const currentSettings = await GuildSetting.findOne({ where: { guildId: guild.id } });
                    if (currentSettings && currentSettings.twentyFourSeven) {
                        aloneTimeouts.delete(guild.id);
                        return;
                    }
                    
                    const currentMembers = currentVoiceChannel.members.filter(m => !m.user.bot);
                    if (currentMembers.size === 0) {
                        const channel = client.channels.cache.get(currentPlayer.textChannel);
                        if (channel) {
                            const container = new ContainerBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `${emojis.stop} Left the voice channel due to inactivity. No one was listening.`
                                    )
                                );
                            await channel.send({
                                components: [container],
                                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2
                            }).catch(() => {});
                        }
                        
                        if (currentPlayer.updateInterval) clearInterval(currentPlayer.updateInterval);
                        if (currentPlayer.buttonCollector) {
                            try {
                                currentPlayer.buttonCollector.stop('aloneInChannel');
                            } catch (e) {}
                        }
                        
                        currentPlayer.destroy();
                    }
                    
                    aloneTimeouts.delete(guild.id);
                }, 60000);
                
                aloneTimeouts.set(guild.id, timeout);
            }
        } else {
            if (aloneTimeouts.has(guild.id)) {
                clearTimeout(aloneTimeouts.get(guild.id));
                aloneTimeouts.delete(guild.id);
            }
        }
    },
};

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/8wfT8SfB5Z  (Quo Development )
    + for any queries reach out Community or DM me.
*/
