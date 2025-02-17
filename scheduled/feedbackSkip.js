const { EmbedBuilder } = require("discord.js");
const { clientId } = require("../config.json");
const hours = 4;

module.exports = {
    name: "feedbackSkip",
    cron: `0 */${hours} * * *`,
    enabled: true,
    async execute() {
        const { client, db } = require("../index.js");

        const embed = new EmbedBuilder()
            .setColor(0x34c3eb)
            .setTitle("Scheduled reminder")
            .setDescription(
                "No skipping please! Make sure everyone has gotten feedback before you post. Skipping 3 times = ban from feedback channels."
            )
            .setFooter({
                text: "This message is automatically sent every 4 hours.",
            });

        const dbMessages = await db.feedbackMsg.findAll();
        for (const dbMessage of dbMessages) {
            const channel = await client.channels.cache.get(
                dbMessage.feedbackId
            );
            const messages = await channel.messages.fetch({ limit: 10 });

            if (
                await messages.some((message) => message.author.id === clientId)
            )
                return;

            const message = await channel.messages.fetch(dbMessage.messageId);
            await message.delete();

            const sentMessage = await channel.send({ embeds: [embed] });

            await db.feedbackMsg.update(
                { messageId: sentMessage.id },
                { where: { feedbackID: dbMessage.feedbackId } }
            );
            await sentMessage.react('🤓')
        }
    },
};
