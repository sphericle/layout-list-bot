const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("botping")
        .setDescription("Bot ping measurements"),
    async execute(interaction) {
        const sent = await interaction.reply({
            content: "Pinging...",
            withResponse: true,
            flags: MessageFlags.Ephemeral,
        });
        interaction.editReply(
            `Pong! ${
                sent.resource.message.createdTimestamp -
                interaction.createdTimestamp
            }ms`
        );
    },
};
