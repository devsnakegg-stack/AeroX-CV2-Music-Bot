const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const { hexToDecimal } = require('../helpers/colorHelper');
const Favorite = require('../../database/models/Favorite');
const config = require('../config');
const emojis = require('../emojis.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('favoriteplay')
        .setDescription('Play all songs from your favorites')
        .addBooleanOption(option =>
            option.setName('append')
                .setDescription('Append the songs to the current queue')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        const { client, member, guild, channel } = interaction;
        
        if (!member.voice.channel) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} You need to be in a voice channel!`)
                );
            return interaction.reply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, 
                ephemeral: true 
            });
        }

        await interaction.deferReply();

        const append = interaction.options.getBoolean('append') || false;
        const userId = interaction.user.id;

        const favorites = await Favorite.findAll({
            where: { userId },
            order: [['createdAt', 'ASC']],
        });

        if (!favorites || favorites.length === 0) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`${emojis.error} You don't have any favorite songs yet!`)
                );
            return interaction.editReply({ 
                components: [container], 
                flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 
            });
        }

        let player = client.aqua.players.get(guild.id);
        
        if (player && !append) {
            player.queue.clear();
        }

        if (!player) {
            player = client.aqua.createConnection({
                guildId: guild.id,
                voiceChannel: member.voice.channel.id,
                textChannel: channel.id,
                deaf: true,
            });
            if (player.isAutoplayEnabled === undefined) player.isAutoplayEnabled = false;
        }

        let added = 0;
        for (const fav of favorites) {
            try {
                const aquaTrack = await client.aqua.resolve({ query: fav.uri, requester: interaction.user });
                if (aquaTrack.tracks && aquaTrack.tracks[0]) {
                    player.queue.add(aquaTrack.tracks[0]);
                    added++;
                }
            } catch (e) {
                console.error(`Failed to resolve favorite: ${fav.title}`, e);
            }
        }

        if (!player.playing && player.connected) player.play();

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${emojis.success} ${append ? 'Added' : 'Loaded'} **${added}** songs from your favorites to the queue!`
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
