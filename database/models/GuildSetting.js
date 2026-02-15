const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');
const BaseModel = require('../BaseModel');

class GuildSetting extends BaseModel {}

GuildSetting.init({
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    twentyFourSeven: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    defaultSource: {
        type: DataTypes.STRING,
        defaultValue: 'ytsearch'
    }
}, {
    sequelize,
    modelName: 'GuildSetting',
});

module.exports = GuildSetting;

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/8wfT8SfB5Z  (Quo Development )
    + for any queries reach out Community or DM me.
*/
