const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
    enabled: false,
    data: new SlashCommandBuilder()
        .setName("botping")
        .setDescription("Bot ping measurements"),
    async execute(interaction) {
        const sent = await interaction.reply({
            content: "Pinging...",
            fetchReply: true,
            flags: MessageFlags.Ephemeral,
        });
        interaction.editReply(
            `Pong! ${sent.createdTimestamp - interaction.createdTimestamp}ms`
        );
    },
};
