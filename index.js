const { Client, GatewayIntentBits } = require("discord.js");
const instagram = require("./instagram.js");
const imgur = require("./imgur.js");
const Jimp = require("jimp");
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

client.on("messageCreate",  async (msg) => {
    console.log({
        [msg.author.username]: msg.content
    })

    let caption = msg.content.substring(
        msg.content.indexOf("*") + 1,
        msg.content.lastIndexOf("*")
    );

    let url = '';
    if (msg.author.username === 'Midjourney Bot' && msg.attachments.size) {
        msg.attachments.map((i) => url = i.url)
        console.log(url)
        if (url.slice(url.lastIndexOf('.') + 1) === 'png') {
            // Read the PNG file and convert it to editable format
            const image = await new Promise((resolve, reject) => {
                Jimp.read(url, function (err, image) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(image);
                    }
                });
            });

            // Convert image to JPG and store it to
            url = `./output/image_${Date.now()}.jpg`;
            await image.writeAsync(url);
            console.log(url);

            url = await imgur.newUrl(url);
            console.log(url);
        }
        instagram.starter(url, caption).then(r => '')
    }
});

client.login(process.env.TOKEN);