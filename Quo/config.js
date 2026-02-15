
module.exports = {
    BOT_TOKEN: process.env.BOT_TOKEN || '',
    CLIENT_ID: process.env.CLIENT_ID || '',
    OWNER_ID: process.env.OWNER_ID || '',
    PREFIX: ',',
    
    
    LAVALINK: {
        HOSTS: process.env.LAVALINK_HOSTS || '',
        PORTS: process.env.LAVALINK_PORTS || '',
        PASSWORDS: process.env.LAVALINK_PASSWORDS || '',
        SECURES: process.env.LAVALINK_SECURES || ''
    },
    
    
    MUSIC: {
        DEFAULT_PLATFORM: 'ytsearch',
        AUTOCOMPLETE_LIMIT: 5,
        PLAYLIST_LIMIT: 3
    },
    
    
    SPOTIFY: {
        CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
        CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || ''
    },
    
    
    GENIUS: {
        API_KEY: process.env.GENIUS_API_KEY || ''
    }
};

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/8wfT8SfB5Z  (Quo Development )
    + for any queries reach out Community or DM me.
*/