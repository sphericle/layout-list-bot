const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("updatedata")
        .setDescription("Updates the cache data from the list"),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const { cache } = require("../../index.js");
        await cache.updateLevels();
        await cache.updatePacks();
        await cache.updateUsers();
        await cache.updateArchived();

        await interaction.editReply(":white_check_mark: Updated data!");
    },
};
