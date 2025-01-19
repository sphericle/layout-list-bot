const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ActionRowBuilder,
    ButtonStyle,
    AttachmentBuilder,
    MessageFlags
} = require("discord.js");
const logger = require("log4js").getLogger();
const Sequelize = require("sequelize");
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
            subcommand.setName("accept").setDescription("Accept a level")
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
                        .setName("images")
                        .setDescription(
                            "Links to images to send along with the rejection message (used so the images embed)"
                        )
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
        return await interaction.respond(
            filtered.slice(0, 25).map((user) => {
                return { name: user.name, value: user.value };
            })
        );
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getSubcommand() === "yes") {
            const { db } = require("../../index.js");
            // if the current channel is not a thread
            if (!(await interaction.channel.isThread())) {
                return await interaction.editReply(
                    "Bro lock in this isnt a reliable thread"
                );
            }

            await interaction.editReply("Checking thread name...");
            // get the thread name
            const text = await interaction.channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            const matchYes = text.match(/(\d+)-\d+$/);
            const matchNo = text.match(/\d+-(\d+)$/);
            let count = 0; // Initialize the yes count to an integer
            if (matchYes) {
                try {
                    count = parseInt(matchYes[1]); // Parse the regex output and add 1 vote to it
                    count += 1;

                    await interaction.editReply({
                        content:
                            "Changing thread name, this could take a while...",
                        flags: MessageFlags.Ephemeral,
                    });

                    // get last 10 messages in channel
                    const messages = await interaction.channel.messages.fetch({
                        limit: 10,
                    });

                    // find the most recent message that contains "vote: "
                    const voteMessage = messages.find((msg) =>
                        msg.content.toLowerCase().includes("vote:")
                    );

                    // pin the message
                    if (voteMessage)
                        await voteMessage.pin(
                            `Vote added by ${interaction.user.username}`
                        );

                    const message = await interaction.channel.send(
                        `The vote is now at **${count}-${matchNo[1]}**. The thread name is being updated!!`
                    );

                    await interaction.channel.setName(
                        `${matchLevelName[1]} ${count}-${matchNo[1]}`
                    ); // Set the channel name to the same thing but with the added yes

                    await message.delete();

                    // update entry in db
                    await db.levelsInVoting.update(
                        { yeses: count },
                        { where: { discordid: await interaction.channel.id } }
                    );

                    const dbEntry = await db.levelsInVoting.findOne({
                        where: { discordid: await interaction.channel.id },
                    });

                    if (dbEntry) {
                        const entry = dbEntry.dataValues;

                        let shared = entry.shared.split(";");
                        shared.pop();

                        for (const user of shared) {
                            const submitterDb = await db.submitters.findOne({
                                where: {
                                    discordid: Sequelize.where(
                                        Sequelize.fn(
                                            "LOWER",
                                            Sequelize.col("discordid")
                                        ),
                                        "LIKE",
                                        "%" + user + "%"
                                    ),
                                },
                            });

                            // check if the user has dmFlag set to true
                            if (submitterDb.dataValues.dmFlag) {
                                // get user by id of entry.submitter
                                const submitter =
                                    await interaction.guild.members.fetch(
                                        entry.submitter
                                    );
                                await submitter.send(
                                    `The level _${matchLevelName[1]}_ has received a new yes vote!\nThe vote is now at **${count}-${matchNo[1]}**.\n-# _To disable these messages, use the \`/vote dm\` command._`
                                );
                            }
                        }
                    }
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

            // ping user if needed
            return await interaction.editReply("Updated!");
        } else if (interaction.options.getSubcommand() === "no") {
            const { db } = require("../../index.js");
            await interaction.editReply("Checking thread name...");
            // if the current channel is not a thread
            if (!interaction.channel.isThread()) {
                return await interaction.editReply(
                    "Bro lock in this isnt a reliable thread"
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

                    await interaction.editReply({
                        content:
                            "Changing thread name, this could take a while...",
                        flags: MessageFlags.Ephemeral,
                    });

                    // get last 10 messages in channel
                    const messages = await interaction.channel.messages.fetch({
                        limit: 10,
                    });

                    // find the most recent message that contains "vote: "
                    const voteMessage = messages.find((msg) =>
                        msg.content.toLowerCase().includes("vote:")
                    );

                    // pin the message
                    if (voteMessage) await voteMessage.pin();

                    const message = await interaction.channel.send(
                        `The vote is now at **${matchYes[1]}-${count}**.`
                    );

                    await interaction.channel.setName(
                        `${matchLevelName[1]} ${matchYes[1]}-${count}`
                    ); // Set the channel name to the same thing but with the added no

                    await message.delete();

                    // update entry in db
                    await db.levelsInVoting.update(
                        { nos: count },
                        { where: { discordid: await interaction.channel.id } }
                    );

                    const dbEntry = await db.levelsInVoting.findOne({
                        where: { discordid: await interaction.channel.id },
                    });

                    if (dbEntry) {
                        const entry = dbEntry.dataValues;

                        let shared = entry.shared.split(";");
                        shared.pop();

                        for (const user of shared) {
                            const submitterDb = await db.submitters.findOne({
                                where: {
                                    discordid: Sequelize.where(
                                        Sequelize.fn(
                                            "LOWER",
                                            Sequelize.col("discordid")
                                        ),
                                        "LIKE",
                                        "%" + user + "%"
                                    ),
                                },
                            });

                            // check if the user has dmFlag set to true
                            if (submitterDb.dataValues.dmFlag) {
                                // get user by id of entry.submitter
                                const submitter =
                                    await interaction.guild.members.fetch(
                                        entry.submitter
                                    );
                                await submitter.send(
                                    `The level _${matchLevelName[1]}_ has received a no vote...\nThe vote is now at **${matchYes[1]}-${count}**.\n-# _To disable these messages, use the \`/vote dm\` command._`
                                );
                            }
                        }
                    }
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

            // ping user if needed
            return await interaction.editReply("Updated!");
        } else if (
            interaction.options.getSubcommand() === "accept" ||
            interaction.options.getSubcommand() === "reject"
        ) {
            const guild = await interaction.client.guilds.fetch(guildId);
            const { db } = require("../../index.js");

            const command = interaction.options.getSubcommand();
            const submissionsChannel = guild.channels.cache.get(
                `${submissionResultsID}`
            );

            const submission = await db.levelsInVoting.findOne({
                where: { discordid: interaction.channel.id },
            });

            // if the current channel is not a thread
            if (!interaction.channel.isThread()) {
                return await interaction.editReply(
                    "Bro lock in this isnt a reliable thread"
                );
            }
            await interaction.editReply("Fetching thread info...");
            // get the thread name
            const text = interaction.channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            if (!matchLevelName) {
                return await interaction.editReply(
                    "This thread's name is not formatted correctly! (Level name #-#)"
                );
            }
            const levelName = matchLevelName[1];

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
            const shared = submission.shared.split(";");
            shared.pop();
            logger.log(shared);
            let pingMessage = "";
            for (const user of shared) pingMessage += `<@${user}> `;

            // add links to message
            const rawImgs = interaction.options.getString("images");
            let attachments = [];
            if (rawImgs) {
                const imgs = rawImgs.split(",");
                for (const img of imgs) {
                    const attachment = new AttachmentBuilder(img.trim());
                    attachments.push(attachment);
                }
            }

            const submissionMessage = await submissionsChannel.send({
                embeds: [embed],
                content: pingMessage,
                files: attachments,
            });

            await submissionMessage.react("👍");
            await submissionMessage.react("👎");

            await interaction.editReply({
                content: "Updating thread name...",
                flags: MessageFlags.Ephemeral,
            });

            const message = await interaction.channel.send(
                `This level has been ${
                    command === "accept" ? "accepted" : "rejected"
                }.`
            );

            await interaction.channel.setName(
                `${matchLevelName[1]} (${
                    command === "accept" ? "ACCEPTED" : "REJECTED"
                })`
            ); // Set the channel name to the same thing but with the added yes

            await message.delete();

            // Create button to remove the message
            const deleteThread = new ButtonBuilder()
                .setCustomId("deleteThread")
                .setLabel("Delete Thread")
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(deleteThread);

            await interaction.editReply({
                content: "The thread has been updated!",
                components: command === "reject" ? [row] : [],
                flags: MessageFlags.Ephemeral,
            });
            if (command === "reject") {
                interaction.channel.setArchived(true);
                interaction.channel.setLocked(true);
            }

            await db.levelsInVoting.destroy({
                where: { discordid: interaction.channel.id },
            });

            return;
        }
    },
};
