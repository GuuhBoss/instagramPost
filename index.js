const { Client, GatewayIntentBits } = require("discord.js");
const instagram = require("./instagram.js");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on("ready", (msg) => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on("messageCreate", (msg) => {
    console.log({
        [msg.author.username]: msg.content
    })

    let url = '';
    if (msg.author.username === 'Midjourney Bot' && msg.attachments.size) {
        msg.attachments.map((i) => url = i.url)
        console.log(url)
        instagram.starter(url).then(r => '')
    }
});

client.login(process.env.TOKEN);