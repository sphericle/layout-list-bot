const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const logger = require("log4js").getLogger();
const { submissionResultsID, guildId } = require("../../config.json");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("reliable")
        .setDescription("Staff list management")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("yes")
                .setDescription("Add a yes vote to a level")
        )
        .addSubcommand((subcommand) =>
            subcommand.setName("no").setDescription("Add a no vote to a level")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("accept")
                .setDescription("Accept a level")
                .addStringOption((option) =>
                    option
                        .setName("user")
                        .setDescription(
                            "The user to ping when accepting the level"
                        )
                        .setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("reject")
                .setDescription("Reject a level")
                .addStringOption((option) =>
                    option
                        .setName("reason")
                        .setDescription("The reason for rejecting the level")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("user")
                        .setDescription(
                            "The user to ping when rejecting the level"
                        )
                        .setAutocomplete(true)
                )
        ),
    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused();
        const members = interaction.guild.members.cache;
        const filtered = members
            .filter((member) =>
                member.user.username
                    .toLowerCase()
                    .includes(focusedOption.toLowerCase())
            )
            .map((member) => {
                return {
                    name: member.user.username,
                    value: member.id,
                };
            });
        await interaction.respond(
            filtered.slice(0, 25).map((user) => {
                return { name: user.name, value: user.value };
            })
        );
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getSubcommand() === "yes") {
            // if the current channel is not a thread
            if (!interaction.channel.isThread()) {
                return await interaction.editReply(
                    "You must be in a thread to use this command"
                );
            }

            await interaction.editReply("Fetching thread info...");
            // get the thread name
            const text = interaction.channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            const matchYes = text.match(/(\d+)-\d+$/);
            const matchNo = text.match(/\d+-(\d+)$/);
            let count = 0; // Initialize the yes count to an integer
            if (matchYes) {
                try {
                    count = parseInt(matchYes[1]); // Parse the regex output and add 1 vote to it
                    count += 1;

                    logger.log(`New yes votes: ${count}`);

                    await interaction.editReply({
                        content:
                            "Updating thread name, this could take a while...",
                        ephemeral: true,
                    });

                    // update the thread name
                    await interaction.channel.setName(
                        `${matchLevelName[1]} ${count}-${matchNo[1]}`
                    ); // Set the channel name to the same thing but with the added yes
                } catch (e) {
                    logger.error(`Error: ${e}`);
                    return await interaction.editReply(
                        `Something went wrong: ${e}`
                    );
                }
            } else {
                return await interaction.editReply(
                    "This thread name is not formatted correctly! (Level name #-#)"
                );
            }

            return await interaction.editReply({
                content: "Updated thread name!",
                ephemeral: true,
            });
        } else if (interaction.options.getSubcommand() === "no") {
            await interaction.editReply("Fetching thread info...");
            // if the current channel is not a thread
            if (!interaction.channel.isThread()) {
                return await interaction.editReply(
                    "You must be in a thread to use this command"
                );
            }

            // get the thread name
            const text = interaction.channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            const matchYes = text.match(/(\d+)-\d+$/);
            const matchNo = text.match(/\d+-(\d+)$/);
            let count = 0; // Initialize the yes count to an integer
            if (matchNo) {
                try {
                    count = parseInt(matchNo[1]); // Parse the regex output and add 1 vote to it
                    count += 1;

                    logger.log(`New no votes: ${count}`);

                    await interaction.editReply({
                        content:
                            "Updating thread name, this could take a while...",
                        ephemeral: true,
                    });

                    // update the thread name
                    await interaction.channel.setName(
                        `${matchLevelName[1]} ${matchYes[1]}-${count}`
                    ); // Set the channel name to the same thing but with the added yes
                } catch (e) {
                    logger.error(`Error: ${e}`);
                    return await interaction.editReply(
                        `Something went wrong: ${e}`
                    );
                }
            } else {
                return await interaction.editReply(
                    "This thread name is not formatted correctly! (Level name #-#)"
                );
            }

            return await interaction.editReply("The thread has been updated!");
        } else if (
            interaction.options.getSubcommand() === "accept" ||
            interaction.options.getSubcommand() === "reject"
        ) {
            const guild = await interaction.client.guilds.fetch(guildId);

            const command = interaction.options.getSubcommand();
            const submissionsChannel = guild.channels.cache.get(
                `${submissionResultsID}`
            );

            // if the current channel is not a thread
            if (!interaction.channel.isThread()) {
                return await interaction.editReply(
                    "You must be in a thread to use this command"
                );
            }
            await interaction.editReply("Fetching thread info...");
            // get the thread name
            const text = interaction.channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            if (!matchLevelName) {
                return await interaction.editReply(
                    "This thread name is not formatted correctly! (Level name #-#)"
                );
            }
            const levelName = matchLevelName[1];
            const userToPing = interaction.options.getString("user");

            const embed = new EmbedBuilder()
                .setTitle(
                    command === "accept"
                        ? `Accepted: ${levelName}`
                        : `Rejected: ${levelName}`
                )
                .setColor(command === "accept" ? 0x00ff00 : 0xff0000)
                .setTimestamp();

            if (command === "reject")
                embed.setDescription(
                    `Reason: ${interaction.options.getString("reason")}`
                );
            await interaction.editReply("Sending message...");
            await submissionsChannel.send({
                embeds: [embed],
                content: interaction.options.getString("user")
                    ? `<@${userToPing}>`
                    : "",
            });

            await interaction.editReply({
                content: "Updating thread name...",
                ephemeral: true,
            });
            await interaction.channel.setName(
                `${matchLevelName[1]} (${
                    command === "accept" ? "ACCEPTED" : "REJECTED"
                })`
            ); // Set the channel name to the same thing but with the added yes
            await interaction.editReply({
                content: "The thread has been updated!",
                ephemeral: true,
            });
            if (command === "reject") interaction.channel.setArchived(true);
            return;
        }
    },
};
