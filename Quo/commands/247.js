const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const GuildSetting = require('../../database/models/GuildSetting');
const emojis = require('../emojis.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Toggle 24/7 mode for this server'),

    async execute(interaction) {
        const { guild, member } = interaction;

        if (!member.permissions.has('ManageGuild')) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} You need 'Manage Server' permission to use this command!`));
            return interaction.reply({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2, ephemeral: true });
        }

        let settings = await GuildSetting.findOne({ where: { guildId: guild.id } });
        if (!settings) {
            settings = await GuildSetting.create({ guildId: guild.id });
        }

        settings.twentyFourSeven = !settings.twentyFourSeven;
        await settings.save();

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.success} 24/7 mode is now **${settings.twentyFourSeven ? 'Enabled' : 'Disabled'}**.`));

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
