const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("botping")
        .setDescription("Bot ping measurements"),
    async execute(interaction) {
        const sent = await interaction.reply({
            content: "Pinging...",
            fetchReply: true,
            ephemeral: true,
        });
        interaction.editReply(
            `Pong! ${sent.createdTimestamp - interaction.createdTimestamp}ms`
        );
    },
};
