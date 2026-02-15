const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { hexToDecimal } = require('../helpers/colorHelper');
const { formatDuration, createProgressBar } = require('../helpers/musicHelpers');
const emojis = require('../emojis.json');

module.exports = {
    name: 'nowplaying',
    description: 'Show the currently playing song',
    aliases: ['np'],

    async execute(message, args) {
        const { client, member, guild } = message;
        
        if (!member.voice.channel) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} You need to be in a voice channel!`));
            return message.reply({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
        }

        const player = client.aqua.players.get(guild.id);
        
        if (!player || !player.current) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} No music is currently playing!`));
            return message.reply({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
        }

        const track = player.current;
        const progressBar = createProgressBar(player);

        const container = new ContainerBuilder();
        
        if (track.thumbnail) {
            container.addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`${emojis.nowplaying} **Now Playing**\n**[${track.title}](${track.uri})**`)
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder()
                            .setDescription(track.title)
                            .setURL(track.thumbnail)
                    )
            );
        } else {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${emojis.nowplaying} **Now Playing**\n**[${track.title}](${track.uri})**`)
            );
        }

        container
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.artist} Artist: ${track.author}`))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.duration} Duration: ${formatDuration(track.duration)}`))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.progress} Progress: ${progressBar}`))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.loopQueue} Loop: ${player.loop === 1 ? `${emojis.loopTrack} Track` : player.loop === 2 ? `${emojis.loopQueue} Queue` : `${emojis.loopOff} Off`}`))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.autoplay} Autoplay: ${player.isAutoplayEnabled ? `${emojis.enabled} On` : `${emojis.disabled} Off`}`))
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.requester} Requested by ${track.requester}`));

        return message.reply({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    },
};

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/8wfT8SfB5Z  (Quo Development )
    + for any queries reach out Community or DM me.
*/
