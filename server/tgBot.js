'use strict';

const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);

// Command to start the bot
bot.start((ctx) => {
    ctx.reply('Welcome to the Social Media Manager Bot! Use /help to see all commands.');
});

// Command to show help
bot.command('help', (ctx) => {
    ctx.reply(`Available commands:\n/tech_post - Manage tech posts\n/finance_post - Manage finance posts\n/entertainment_post - Manage entertainment posts\n/showAll - Show all posts\n/add_post {platform} {content} - Add a new post to a platform\n/remove_post {id} - Remove a post by ID\n`);
});

// Command to add a post
bot.command('add_post', (ctx) => {
    const { message } = ctx;
    const args = message.text.split(' ').slice(1);
    if (args.length < 2) {
        return ctx.reply('Usage: /add_post {platform} {content}.');
    }
    const [platform, ...contentArr] = args;
    const content = contentArr.join(' ');
    // TODO: Add functionality to store the post
    ctx.reply(`Post added to ${platform}: ${content}`);
});

// Command to remove a post
bot.command('remove_post', (ctx) => {
    const { message } = ctx;
    const postId = message.text.split(' ')[1];
    if (!postId) {
        return ctx.reply('Usage: /remove_post {id}.');
    }
    // TODO: Add functionality to remove the post
    ctx.reply(`Post with ID ${postId} removed.`);
});

// Command to show all posts
bot.command('showAll', (ctx) => {
    // TODO: Retrieve and show all posts
    ctx.reply('Showing all posts...');
});

// Command to manage platform-specific posts
bot.command('tech_post', (ctx) => {
    ctx.reply('Managing Tech Posts...');
});

bot.command('finance_post', (ctx) => {
    ctx.reply('Managing Finance Posts...');
});

bot.command('entertainment_post', (ctx) => {
    ctx.reply('Managing Entertainment Posts...');
});

// Launch the bot
bot.launch();
console.log('Bot is launched and running...');

process.on('SIGINT', () => {
    bot.stop('SIGINT');
});
process.on('SIGTERM', () => {
    bot.stop('SIGTERM');
});