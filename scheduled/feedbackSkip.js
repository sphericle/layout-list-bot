const { EmbedBuilder } = require("discord.js");
const { feedbackChannels, clientId } = require("../config.json");
const hours = 4

module.exports = {
    name: "feedbackSkip",
    cron: `0 */${hours} * * *`,
    enabled: true,
    async execute() {
        const { client } = require("../index.js");

        const embed = new EmbedBuilder()
            .setColor(0x34c3eb)
            .setTitle("Scheduled reminder")
            .setDescription("No skipping please! Make sure everyone has gotten feedback before you post. Skipping 3 times = ban from feedback channels.")
            .setFooter({ text: "This message is automatically sent every 4 hours." });

        for (const channelID of feedbackChannels) {
            const channel = await client.channels.cache.get(channelID);
            const messages = await channel.messages.fetch({ limit: 10 });
            
            if (await messages.some(
                (message) => 
                    message.author.id === clientId
            ))
                return;
    
            await channel.send({ embeds: [embed] })
        }
    },
};
