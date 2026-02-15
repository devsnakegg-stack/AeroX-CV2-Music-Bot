const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const GuildSetting = require('../../database/models/GuildSetting');
const emojis = require('../emojis.json');

module.exports = {
    name: 'setsource',
    aliases: ['source', 'defaultsource'],
    description: 'Set the default music source for this server',

    async execute(message, args) {
        const { guild, member } = message;

        if (!member.permissions.has('ManageGuild')) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} You need 'Manage Server' permission to use this command!`));
            return message.reply({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
        }

        const sourceInput = args[0]?.toLowerCase();

        const sourceMap = {
            'spotify': 'spsearch',
            'ytmusic': 'ytmsearch',
            'youtube': 'ytsearch',
            'soundcloud': 'scsearch',
            'applemusic': 'amsearch',
            'apple': 'amsearch',
            'yt': 'ytsearch',
            'ytm': 'ytmsearch',
            'sp': 'spsearch',
            'sc': 'scsearch'
        };

        const source = sourceMap[sourceInput];

        if (!source) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} Please provide a valid source: Spotify, YTmusic, YouTube, SoundCloud, Apple Music`));
            return message.reply({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
        }

        let settings = await GuildSetting.findOne({ where: { guildId: guild.id } });
        if (!settings) {
            settings = await GuildSetting.create({ guildId: guild.id });
        }

        settings.defaultSource = source;
        await settings.save();

        const sourceNames = {
            'spsearch': 'Spotify',
            'ytmsearch': 'YouTube Music',
            'ytsearch': 'YouTube',
            'scsearch': 'SoundCloud',
            'amsearch': 'Apple Music'
        };

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.success} Default music source set to **${sourceNames[source]}**.`));

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
