const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("exitprocess")
        .setDescription("Stops the bot process (only works if you are sphericle)"),
    async execute(interaction) {
        if (interaction.user.id !== "581990926948237322")
            return await interaction.editReply("You are not sphericle....");
        interaction.editReply(
            `Stopping...`
        );
        process.exit();
    },
};
