const { SlashCommandBuilder } = require("discord.js");
const {
    guildId,
    reliableThreadID,
    staffRole,
    submissionsChannelID,
} = require("../../config.json");
const logger = require("log4js").getLogger();
const Sequelize = require("sequelize");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("vote")
        .setDescription("Commands to manage your levels submitted to the Layout List.")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("submit")
                .setDescription("Submit a level to be voted on by the reliable team")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The name of the level to submit")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("verifier")
                        .setDescription("The name of the verifier")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("verification")
                        .setDescription(
                            "The link to the level's verification video"
                        )
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("creators")
                        .setDescription(
                            "The list of the creators of the level, each separated by a comma"
                        )
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("author")
                        .setDescription(
                            "The name of the person who uploaded the level on GD"
                        )
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("id")
                        .setDescription("The level's ID in Geometry Dash")
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("songname")
                        .setDescription(
                            "The name of this level's song. Required if there is a NONG."
                        )
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("percent")
                        .setDescription(
                            "The minimum percent players need to get a record on this level (list percent)"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("password")
                        .setDescription("The GD password of the level to place")
                )
                .addStringOption((option) =>
                    option
                        .setName("raw")
                        .setDescription(
                            "The verifier's raw footage (if the level is extreme+)"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("opinion")
                        .setDescription(
                            "Where do you think this level should be placed?"
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName("enjoyment")
                        .setDescription(
                            "The verifier's enjoyment rating (1-10) for their list profile."
                        )
                )
                .addAttachmentOption((option) =>
                    option
                        .setName("nong")
                        .setDescription(
                            "The NONG file for this level. You can also paste a link in the song-name field"
                        )
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("dm")
                .setDescription(
                    "Toggle DMs when someone votes for your level"
                )
                .addIntegerOption((option) =>
                    option
                        .setName("status")
                        .setDescription("Whether to enable or disable DMs")
                        .addChoices(
                            { name: "Enable", value: 1 },
                            { name: "Disable", value: 0 }
                        )
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("status")
                .setDescription("Check the status of a level you submitted")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription(
                            "The name of the level you want to check"
                        )
                        .setAutocomplete(true)
                        .setRequired(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("share")
                .setDescription("Allow another user to see the vote of a level you submitted")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription(
                            "The name of the level you want to share"
                        )
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("user")
                        .setDescription(
                            "The user you want to share the level's vote with"
                        )
                        .setAutocomplete(true)
                        .setRequired(true)
                )
        ),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const { db } = require("../../index.js");
        if (focused.name === "levelname") {
            // if user has staff role, show all levels in voting
            let levels;
            if (await interaction.member.roles.cache.has(staffRole))
                levels = await db.levelsInVoting.findAll();
            else
                levels = await db.levelsInVoting.findAll({
                    where: { shared: 
                                Sequelize.where(
                                    Sequelize.fn("LOWER", Sequelize.col("shared")),
                                    "LIKE",
                                    "%" + interaction.user.id + "%"
                                ), 
                            },
                });
            return await interaction.respond(
                levels
                    .filter((lvl) =>
                        lvl.levelname
                            .toLowerCase()
                            .includes(focused.value.toLowerCase())
                    )
                    .slice(0, 25)
                    .map((lvl) => ({
                        name: lvl.levelname,
                        value: `${lvl.discordid}`,
                    }))
            );
        } else if (focused.name === "user") {
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
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "submit") {
            const { db } = require("../../index.js");

            const levelname = interaction.options.getString("levelname");
            const verifier = interaction.options.getString("verifier");
            const verification = interaction.options.getString("verification");
            const creators = interaction.options.getString("creators");
            const author = interaction.options.getString("author");
            const id = interaction.options.getInteger("id");
            const songname = interaction.options.getString("songname");
            const percent = interaction.options.getInteger("percent");
            const password = interaction.options.getString("password");
            const raw = interaction.options.getString("raw");
            const opinion = interaction.options.getString("opinion");
            const nong = interaction.options.getAttachment("nong");
            const enjoyment = interaction.options.getInteger("enjoyment");

            if (enjoyment && (enjoyment > 10 || enjoyment < 1)) 
                return await interaction.editReply(":x: The verifier's enjoyment should be a whole number from 1-10.");

            // get the submitter from the db
            let user;
            try {
                user = await db.submitters.findOne({
                    where: {
                        discordid: interaction.user.id,
                    },
                });

                if (!user) {
                    const userResult = await db.submitters.create({
                        discordid: interaction.user.id,
                        submissions: 0,
                        dmFlag: false,
                        banned: false,
                    });
                    user = userResult.dataValues;
                }
            } catch (error) {
                logger.error(error);
                return interaction.editReply(
                    ":x: An error occurred while submitting your level. Please try again later."
                );
            }

            // check if user has 3 submissions already
            if (user.submissions >= 3)
                return interaction.editReply(
                    ":x: You have reached the maximum number of 3 submissions per month."
                );

            if (user.banned)
                return interaction.editReply(
                    ":x: You have been banned from submitting levels."
                );

            const guild = await interaction.client.guilds.fetch(guildId);

            const voteChannel = await guild.channels.cache.get(
                reliableThreadID
            );

            const message =
                `_Submitted by: <@${interaction.user.id}>_\n\nLevel name: ${levelname}\nVerifier: ${verifier}\nVerification: ${verification}\nCreators: ${creators}\nAuthor: ${author}\nID: \`${id}\`\nSong name: ${songname}` + // man don't askl me why itr needs to be formatted like this ik its ugly bro
                (percent ? `\nList percent: ${percent}%` : "") +
                (password ? `\nPassword: ${password}` : "") +
                (raw ? `\nRaw: ${raw}` : "") +
                (opinion ? `\nDifficulty opinion: ${opinion}` : "") +
                (enjoyment ? `\nVerifier's enjoyment: ${enjoyment}/10` : "") +
                (nong ? `\nNONG: ${nong.url}` : "");
            const thread = await voteChannel.threads.create({
                name: `${levelname} 0-0`,
                autoArchiveDuration: 1440,
                reason: `New level submission by ${interaction.user.tag}`,
                message: message,
            });

            logger.log(`Created thread: ${thread.name}`);
            const logChannel = await guild.channels.cache.get(
                submissionsChannelID
            );
            await logChannel.send(message);

            // increment user's submission count
            const submitter = await db.submitters.findOne({
                where: { discordid: interaction.user.id },
            });
            await submitter.increment("submissions");

            await db.levelsInVoting.create({
                levelname: levelname,
                submitter: interaction.user.id,
                discordid: thread.id,
                yeses: 0,
                nos: 0,
                shared: `${interaction.user.id};`
            });

            return interaction.editReply(":white_check_mark: Level submitted!");
        } else if (subcommand === "dm") {
            const { db } = require("../../index.js");

            const numStatus = await interaction.options.getInteger("status");

            const status = numStatus === 1 ? true : false;

            let submitter
            submitter = await db.submitters.findOne({
                where: { discordid: interaction.user.id },
            });

            if (!submitter)
                submitter = await db.submitters.create({
                    discordid: interaction.user.id,
                    submissions: 0,
                    dmFlag: false,
                    banned: false,
                });

            try {
                await db.submitters.update(
                    { dmFlag: status },
                    { where: { discordid: interaction.user.id } }
                );
            } catch (error) {
                logger.error(error);
                return interaction.editReply(
                    ":x: An error occurred while updating your DM settings. Please try again later."
                );
            }

            return interaction.editReply(
                `:white_check_mark: DMs have been ${
                    status ? "enabled" : "disabled"
                }!`
            );
        } else if (subcommand === "status") {
            const { db } = require("../../index.js");
            const level = await interaction.options.getString("levelname");

            const hasStaffRole = await interaction.member.roles.cache.has(
                staffRole
            );

            let submission;
            try {
                submission = await db.levelsInVoting.findOne({
                    where: !hasStaffRole
                        ? {
                              discordid: level,
                              shared: 
                                Sequelize.where(
                                    Sequelize.fn("LOWER", Sequelize.col("shared")),
                                    "LIKE",
                                    "%" + interaction.user.id + "%"
                                ),
                          }
                        : {
                              discordid: level,
                          },
                });
            } catch (error) {
                logger.error(error);
                return interaction.editReply(
                    ":x: An error occurred while fetching the status of your level. Please try again later."
                );
            }

            if (!submission)
                return interaction.editReply(
                    ":x: You have not submitted a level with that name."
                );

            return interaction.editReply(
                `The vote for ${submission.levelname} is currently ${submission.yeses}-${submission.nos}.`
            );
        } else if (subcommand === "share") {
            const { db } = require("../../index.js");
            const level = await interaction.options.getString("levelname");
            const user = await interaction.options.getString("user");

            // lookup user in server
            const guild = await interaction.client.guilds.fetch(guildId);
            const member = await guild.members.fetch(user);
            if (!member)
                return interaction.editReply(
                    ":x: The user you specified is not in the server."
                );

            if (user === interaction.user.id) {
                return interaction.editReply(
                    ":x: Nice try!"
                );
            }

            const hasStaffRole = await interaction.member.roles.cache.has(
                staffRole
            );

            let submission;
            try {
                submission = await db.levelsInVoting.findOne({
                    where: !hasStaffRole
                        ? {
                              discordid: level,
                              submitter: interaction.user.id,
                          }
                        : {
                              discordid: level,
                          },
                });
            } catch (error) {
                logger.error(error);
                return interaction.editReply(
                    ":x: An error occurred while fetching the status of your level. Please try again later."
                );
            }

            if (!submission)
                return interaction.editReply(
                    ":x: You have not submitted a level with that name."
                );

            const shared = submission.shared.split(";");
            if (shared.includes(user))
                return interaction.editReply(
                    ":x: You have already shared this level with that user."
                );

            await db.levelsInVoting.update(
                {
                    shared: `${submission.shared}${user};`,
                },
                {
                    where: {
                        discordid: level,
                    },
                }
            );

            return interaction.editReply(
                `The vote for ${submission.levelname} is currently ${submission.yeses}-${submission.nos}.`
            );
        }
    },
};
