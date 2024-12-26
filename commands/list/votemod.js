const { SlashCommandBuilder } = require("discord.js");
const {
    guildId,
    reliableThreadID,
    staffRole,
    submissionsChannelID,
} = require("../../config.json");
const logger = require("log4js").getLogger();

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("votemod")
        .setDescription("Moderator commands for levels in voting")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setsubmissions")
                .setDescription(
                    "Set the submission count of all users for the month to 0"
                )
                .addStringOption((option) =>
                    option
                        .setName("user")
                        .setDescription("The user to reset the submissions for")
                        .setAutocomplete(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("submissions")
                        .setDescription("The new submission count")
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("debugclear")
                .setDescription(
                    "Set the submission count of all users for the month to 0"
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("setvote")
                .setDescription("Update the information of a level in voting")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("ban")
                .setDescription("Submission ban a user")
                .addStringOption((option) =>
                    option
                        .setName("submitteruser")
                        .setDescription("The user to ban from submitting")
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("unban")
                        .setDescription("Whether to unban this user")
                        .addChoices(
                            { name: "Yes", value: 1 },
                            { name: "No", value: 0 }
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("voteinsert")
                .setDescription("debug")
                .addStringOption((option) =>
                    option
                        .setName("submitteruser")
                        .setDescription("The name of the user to insert")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const { db } = require("../../index.js");
        const subcommand = interaction.options.getSubcommand();
        if (
            subcommand === "submitban" ||
            subcommand === "setsubmissions" ||
            subcommand === "voteinsert"
        ) {
            const members = interaction.guild.members.cache;
            const filtered = members
                .filter((member) =>
                    member.user.username
                        .toLowerCase()
                        .includes(focused.value.toLowerCase())
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
        } 
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        // setsubmissions
        // debugclear
        // setvote
        // submitban (rename to ban)
        // voteinsert

        if (interaction.options.getSubcommand() === "setsubmissions") {
            const { db } = require("../../index.js");

            const cmdUser = interaction.options.getString("user");
            const count = interaction.options.getInteger("submissions");

            // set submissions to 0
            try {
                await db.submitters.update(
                    { submissions: count || 0 },
                    { where: cmdUser ? { discordid: cmdUser } : {} }
                );
            } catch (error) {
                logger.info(`Failed to reset submissions: ${error}`);
                return await interaction.editReply(
                    ":x: Something went wrong while resetting the submissions; please try again later"
                );
            }

            return await interaction.editReply(
                ":white_check_mark: Submissions have been reset"
            );
        } else if (interaction.options.getSubcommand() === "debugclear") {
            const { db } = require("../../index.js");

            try {
                await db.levelsInVoting.destroy({ where: {} });
                await db.submitters.destroy({ where: {} });
            } catch (error) {
                logger.error(error);
                return interaction.editReply(
                    ":x: An error occurred while clearing the levels in voting. Please try again later."
                );
            }

            return interaction.editReply(":white_check_mark: Levels cleared!");
        } else if (interaction.options.getSubcommand() === "voteinsert") {
            const { db } = require("../../index.js");

            const text = await interaction.channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            const user = await interaction.options.getString("submitteruser");
            const matchYes = text.match(/(\d+)-\d+$/);
            const matchNo = text.match(/\d+-(\d+)$/);

            const submitter = await db.submitters.findOne({
                where: { discordid: user },
            });
            if (!submitter) {
                // create submitter
                await db.submitters.create({
                    discordid: user,
                    submissions: 0,
                    dmFlag: false,
                    banned: false,
                });
            }

            await db.levelsInVoting.create({
                levelname: matchLevelName[1],
                submitter: user,
                discordid: interaction.channel.id,
                yeses: matchYes[1],
                nos: matchNo[1],
            });
            interaction.editReply(":white_check_mark: Vote inserted!");
        } else if (interaction.options.getSubcommand() === "setvote") {
            const { db } = require("../../index.js");

            const text = await interaction.channel.name;
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            const matchYes = text.match(/(\d+)-\d+$/);
            const matchNo = text.match(/\d+-(\d+)$/);

            const level = await db.levelsInVoting.findOne({
                where: { discordid: interaction.channel.id },
            });

            if (!level)
                return await interaction.editReply(":x: level not found");

            db.levelsInVoting.update(
                {
                    levelname: matchLevelName[1],
                    yeses: matchYes[1],
                    nos: matchNo[1],
                },
                {
                    where: {
                        discordid: interaction.channel.id,
                    },
                }
            );
        } else if (interaction.options.getSubcommand() === "submitban") {
            const { db } = require("../../index.js");
            const user = await interaction.options.getString("submitteruser");
            const unban = await interaction.options.getInteger("unban");
            if (unban === 1) {
                await db.submitters.update(
                    {
                        banned: false,
                    },
                    {
                        where: {
                            discordid: user,
                        },
                    }
                );
                return await interaction.editReply(
                    "The user has been unbanned"
                );
            }
            await db.submitters.update(
                {
                    banned: true,
                },
                {
                    where: {
                        discordid: user,
                    },
                }
            );

            const guild = await interaction.client.guilds.fetch(guildId);

            const levels = await db.levelsInVoting.findAll({
                where: { submitter: user },
            });

            levels.forEach(async (level) => {
                // get discord thread associated with level.discordid
                const channel = await guild.channels.cache.get(level.discordid);

                await channel.send(
                    `:x: The submitter of this level has been submission banned, rejecting...`
                );

                await channel.setName(`${level.levelname} (REJECTED)`);

                await channel.setArchived(true);
            });

            await db.levelsInVoting.destroy({
                where: { submitter: user },
            });

            return await interaction.editReply(
                ":x: This user has been banned!"
            );
        }
    },
};