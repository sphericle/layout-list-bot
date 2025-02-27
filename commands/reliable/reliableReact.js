// bro why are context menus of type app command

const {
    ContextMenuCommandBuilder,
    ApplicationCommandType,
} = require("discord.js");
const { clientId } = require("../../config.json");

module.exports = {
    enabled: true,
    data: new ContextMenuCommandBuilder()
        .setName("Add Reactions")
        .setType(ApplicationCommandType.Message),
    async execute(interaction) {
        const message = await interaction.channel.messages.fetch(
            interaction.targetId
        );
        const userReactions = message.reactions.cache.some(async (reaction) => {
            const users = await reaction.users.fetch();
            return await users.some((user) => user.id === clientId);
        });

        if (userReactions) {
            return interaction.editReply("Already reacted to this message!");
        }
        await message.react("⬆️");
        await message.react("👍");
        await message.react("⬇️");

        return interaction.editReply("✅");
    },
};
