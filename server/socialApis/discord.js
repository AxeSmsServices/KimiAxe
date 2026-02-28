// discord.js integration for posting messages and announcements

const Discord = require('discord.js');

const client = new Discord.Client();

client.once('ready', () => {
    console.log('Discord bot is ready!');
});

function postMessage(channelId, message) {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
        channel.send(message);
    } else {
        console.log('Channel not found!');
    }
}

// Use this function to post announcements
// postMessage('YOUR_CHANNEL_ID', 'YOUR_MESSAGE');

client.login('YOUR_BOT_TOKEN');
