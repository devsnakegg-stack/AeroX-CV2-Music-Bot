const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const GuildSetting = require('../../database/models/GuildSetting');
const emojis = require('../emojis.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setsource')
        .setDescription('Set the default music source for this server')
        .addStringOption(option =>
            option.setName('source')
                .setDescription('The music source to use by default')
                .setRequired(true)
                .addChoices(
                    { name: 'Spotify', value: 'spsearch' },
                    { name: 'YouTube Music', value: 'ytmsearch' },
                    { name: 'YouTube', value: 'ytsearch' },
                    { name: 'SoundCloud', value: 'scsearch' },
                    { name: 'Apple Music', value: 'amsearch' }
                )
        ),

    async execute(interaction) {
        const { guild, member, options } = interaction;

        if (!member.permissions.has('ManageGuild')) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} You need 'Manage Server' permission to use this command!`));
            return interaction.reply({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, ephemeral: true });
        }

        const source = options.getString('source');

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

        return interaction.reply({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
    },
};

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/8wfT8SfB5Z  (Quo Development )
    + for any queries reach out Community or DM me.
*/
