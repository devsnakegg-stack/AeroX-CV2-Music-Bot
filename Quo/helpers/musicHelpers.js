const { PermissionFlagsBits } = require('discord.js');

function formatDuration(ms) {
    if (typeof ms !== 'number' || isNaN(ms) || ms < 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function createProgressBar(player) {
    if (!player.current || !player.current.duration) return '';
    if (player.current.isStream) return '`00:00|▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬🔴 LIVE`';

    const current = player.position;
    const total = player.current.duration;
    const size = 25;

    let percent = Math.round((current / total) * size);
    if (percent < 0) percent = 0;
    if (percent > size) percent = size;

    const empty = size - percent;
    const safeEmpty = empty < 0 ? 0 : empty;

    const progress = '▬'.repeat(percent) + '🔵' + '▬'.repeat(safeEmpty);
    return `\`${formatDuration(current)}|${progress}|${formatDuration(total)}\``;
}

function hasControlPermission(interactionOrMessage, player) {
    if (!player.current) return false;
    
    const member = interactionOrMessage.member;
    const userId = interactionOrMessage.user?.id || interactionOrMessage.author?.id;
    
    if (member.permissions.has(PermissionFlagsBits.ManageGuild) ||
        member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    const requesterId = player.current.requester?.id;
    if (userId === requesterId) return true;

    return false;
}

module.exports = {
    formatDuration,
    createProgressBar,
    hasControlPermission
};

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/8wfT8SfB5Z  (Quo Development )
    + for any queries reach out Community or DM me.
*/
