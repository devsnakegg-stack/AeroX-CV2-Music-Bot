const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const GuildSetting = require('../../database/models/GuildSetting');
const emojis = require('../emojis.json');

module.exports = {
    name: '247',
    description: 'Toggle 24/7 mode for this server',
    aliases: ['24-7'],

    async execute(message, args) {
        const { guild, member } = message;

        if (!member.permissions.has('ManageGuild')) {
            const container = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.error} You need 'Manage Server' permission to use this command!`));
            return message.reply({ components: [container], flags: MessageFlags.IsPersistent | MessageFlags.IsComponentsV2 });
        }

        let settings = await GuildSetting.findOne({ where: { guildId: guild.id } });
        if (!settings) {
            settings = await GuildSetting.create({ guildId: guild.id });
        }

        settings.twentyFourSeven = !settings.twentyFourSeven;
        await settings.save();

        const container = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${emojis.success} 24/7 mode is now **${settings.twentyFourSeven ? 'Enabled' : 'Disabled'}**.`));

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
