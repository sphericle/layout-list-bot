const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require("discord.js");
const {
    pendingRecordsID,
    priorityRoleID,
    priorityRecordsID,
    submissionLockRoleID,
    enableSeparateStaffServer,
    enablePriorityRole,
    staffGuildId,
    guildId,
} = require("../../config.json");
const isUrlHttp = require("is-url-http");
const logger = require("log4js").getLogger();
const { parseUsers } = require("../../others/gitUtils.js");

module.exports = {
    cooldown: 5,
    enabled: false,
    data: new SlashCommandBuilder()
        .setName("oldrecords")
        .setDescription("Record handling")
        .setDMPermission(false)
        .addSubcommand((subcommand) =>
            subcommand
                .setName("submit")
                .setDescription("Submit a record for the list")
                .addStringOption((option) =>
                    option
                        .setName("username")
                        .setDescription(
                            "The username you're submitting for (Be sure to select one of the available options.)"
                        )
                        .setMaxLength(1024)
                        .setAutocomplete(true)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription(
                            "Name of the level you're submitting for (Be sure to select one of the available options.)"
                        )
                        .setMaxLength(1024)
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("device")
                        .setDescription("Device the level was completed on")
                        .setRequired(true)
                        .addChoices(
                            { name: "PC", value: "PC" },
                            { name: "Mobile", value: "Mobile" }
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("completionlink")
                        .setDescription("Link to the completion")
                        .setMaxLength(1024)
                        .setRequired(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("modmenu")
                        .setDescription(
                            "Name of the mod menu you used, if any (Megahack, Eclipse, GDH, QOLMod, etc..), or None/Vanilla"
                        )
                        .setMaxLength(1024)
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("fps")
                        .setDescription(
                            "The FPS you used to complete the level"
                        )
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("percent")
                        .setDescription("The percent you got on the level")
                        .setRequired(true)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("enjoyment")
                        .setDescription(
                            "Your enjoyment rating on this level (1-10)"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("raw")
                        .setDescription(
                            "Link to your raw footage (Optional, required for top 400 levels)"
                        )
                        .setMaxLength(1024)
                )
                .addIntegerOption((option) =>
                    option
                        .setName("ldm")
                        .setDescription(
                            "ID for the external LDM you used (Optional)"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("additionalnotes")
                        .setDescription(
                            "Any other info you'd like to share with us (Optional)"
                        )
                        .setMaxLength(1024)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("status")
                .setDescription("Check the status of pending records")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("info")
                .setDescription("Check the status of your submissions")
                .addStringOption((option) =>
                    option
                        .setName("status")
                        .setDescription("Which records you want to check")
                        .setRequired(true)
                        .addChoices(
                            { name: "Pending", value: "pending" },
                            { name: "Accepted", value: "accepted" },
                            { name: "Denied", value: "denied" }
                        )
                )
        ),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);

        const { cache } = require("../../index.js");
        const Sequelize = require("sequelize");

        if (focused.name === "levelname") {
            let levels = await cache.levels.findAll({
                where: {
                    name: Sequelize.where(
                        Sequelize.fn("LOWER", Sequelize.col("name")),
                        "LIKE",
                        "%" + focused.value.toLowerCase() + "%"
                    ),
                },
            });

            return await interaction.respond(
                levels
                    .slice(0, 25)
                    .map((level) => ({ name: level.name, value: level.name }))
            );
        } else if (focused.name === "username") {
            let users = await cache.users.findAll({
                where: {
                    name: Sequelize.where(
                        Sequelize.fn("LOWER", Sequelize.col("name")),
                        "LIKE",
                        "%" + focused.value.toLowerCase() + "%"
                    ),
                },
            });
            return await interaction.respond(
                users
                    .slice(0, 25)
                    .map((user) => ({ name: user.name, value: user.name }))
            );
        }
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const { db } = require("../../index.js");

        if (interaction.options.getSubcommand() === "submit") {
            // Record submitting //

            // Check list banned
            if (interaction.member.roles.cache.has(submissionLockRoleID)) {
                await interaction.editReply(
                    ":x: Couldn't submit the record: You have been banned from submitting records"
                );
                return;
            }

            // Check record submission status
            const dbStatus = await db.infos.findOne({
                where: { name: "records" },
            });
            if (!dbStatus)
                return await interaction.editReply(
                    ":x: Something wrong happened while executing the command; please try again later"
                );

            if (dbStatus.status)
                return await interaction.editReply(
                    ":x: Couldn't submit the record: Submissions are closed at the moment"
                );

            // Check given URL
            const linkStr = interaction.options.getString("completionlink");
            if (/\s/g.test(linkStr) || !isUrlHttp(linkStr))
                return await interaction.editReply(
                    ":x: Couldn't submit the record: The provided completion link is not a valid URL"
                );
            const rawStr = interaction.options.getString("raw");
            if (rawStr && (/\s/g.test(rawStr) || !isUrlHttp(rawStr)))
                return await interaction.editReply(
                    ":x: Couldn't submit the record: The provided raw footage link is not a valid URL"
                );

            // Check given level name
            const { cache } = require("../../index.js");

            // Check enjoyment bounds (1-10)
            const enjoyment = interaction.options.getInteger("enjoyment");
            if (enjoyment && (enjoyment < 1 || enjoyment > 10))
                return await interaction.editReply(
                    ":x: Couldn't submit the record: Enjoyment rating must be between 1 and 10"
                );

            // Check percent bounds (0-100)
            const percent = interaction.options.getInteger("percent");
            if (percent < 0 || percent > 100)
                return await interaction.editReply(
                    ":x: Couldn't submit the record: Percent must be valid (1-100)"
                );

            // Create accept/deny buttons
            const accept = new ButtonBuilder()
                .setCustomId("accept")
                .setLabel("Accept")
                .setStyle(ButtonStyle.Success);

            const deny = new ButtonBuilder()
                .setCustomId("deny")
                .setLabel("Deny")
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder()
                .addComponents(accept)
                .addComponents(deny);

            // Embed with record data to send in pending-record-log
            const level = await cache.levels.findOne({
                where: { name: [interaction.options.getString("levelname")] },
            });
            const recordEmbed = new EmbedBuilder()
                .setColor(0x005c91)
                .setTitle(
                    `${interaction.options.getString("levelname")} ${
                        level ? `| [#${level.position}]` : ""
                    }`
                )
                .setDescription("Unassigned")
                .addFields(
                    {
                        name: "Record submitted by",
                        value: `<@${interaction.user.id}>`,
                    },
                    {
                        name: "Record holder",
                        value: `${interaction.options.getString("username")}`,
                    },
                    {
                        name: "FPS",
                        value: `${interaction.options.getInteger("fps")}`,
                    },
                    {
                        name: "Percent",
                        value: `${interaction.options.getInteger("percent")}`,
                    },
                    {
                        name: "Device",
                        value: `${interaction.options.getString("device")}`,
                        inline: true,
                    },
                    {
                        name: "LDM",
                        value: `${
                            interaction.options.getInteger("ldm") == null
                                ? "None"
                                : interaction.options.getInteger("ldm")
                        }`,
                        inline: true,
                    },
                    {
                        name: "Completion link",
                        value: `${interaction.options.getString(
                            "completionlink"
                        )}`,
                    },
                    {
                        name: "Enjoyment",
                        value: `${
                            interaction.options.getInteger("enjoyment") == null
                                ? "None"
                                : interaction.options.getInteger("enjoyment")
                        }`,
                    },
                    {
                        name: "Mod menu",
                        value: `${interaction.options.getString("modmenu")}`,
                    },
                    {
                        name: "Raw link",
                        value: `${
                            interaction.options.getString("raw") == null
                                ? "None"
                                : interaction.options.getString("raw")
                        }`,
                    },
                    {
                        name: "Additional Info",
                        value: `${
                            interaction.options.getString("additionalnotes") ==
                            null
                                ? "None"
                                : interaction.options.getString(
                                      "additionalnotes"
                                  )
                        }`,
                    }
                )
                .setTimestamp();

            // Send message
            const guild = await interaction.client.guilds.fetch(
                enableSeparateStaffServer ? staffGuildId : guildId
            );
            const sent = await guild.channels.cache
                .get(
                    enablePriorityRole &&
                        interaction.member.roles.cache.has(priorityRoleID)
                        ? priorityRecordsID
                        : pendingRecordsID
                )
                .send({ embeds: [recordEmbed] });
            const sentvideo = await guild.channels.cache
                .get(
                    enablePriorityRole &&
                        interaction.member.roles.cache.has(priorityRoleID)
                        ? priorityRecordsID
                        : pendingRecordsID
                )
                .send({
                    content: `${interaction.options.getString(
                        "completionlink"
                    )}`,
                    components: [row],
                });

            // Add record to sqlite db
            try {
                await db.pendingRecords.create({
                    username: interaction.options.getString("username"),
                    submitter: interaction.user.id,
                    levelname: interaction.options.getString("levelname"),
                    device: interaction.options.getString("device"),
                    completionlink:
                        interaction.options.getString("completionlink"),
                    fps: interaction.options.getInteger("fps"),
                    percent: interaction.options.getInteger("percent"),
                    enjoyment: -1,
                    raw: "None",
                    ldm: 0,
                    additionalnotes: "None",
                    modMenu: interaction.options.getString("modmenu"),
                    discordid: sentvideo.id,
                    embedDiscordid: sent.id,
                    priority:
                        enablePriorityRole &&
                        interaction.member.roles.cache.has(priorityRoleID),
                    assigned: "None",
                });
            } catch (error) {
                logger.info(
                    `Couldn't register the record ; something went wrong with Sequelize : ${error}`
                );
                await sent.delete();
                await sentvideo.delete();
                return await interaction.editReply(
                    ":x: Something went wrong while submitting the record; Please try again later"
                );
            }

            // Check for and add optionnal values to db
            if (interaction.options.getString("raw") != null)
                await db.pendingRecords.update(
                    { raw: interaction.options.getString("raw") },
                    { where: { discordid: sentvideo.id } }
                );
            if (interaction.options.getInteger("ldm") != null)
                await db.pendingRecords.update(
                    { ldm: interaction.options.getInteger("ldm") },
                    { where: { discordid: sentvideo.id } }
                );
            if (interaction.options.getInteger("enjoyment") != null)
                await db.pendingRecords.update(
                    { enjoyment: interaction.options.getInteger("enjoyment") },
                    { where: { discordid: sentvideo.id } }
                );
            if (interaction.options.getString("additionalnotes") != null)
                await db.pendingRecords.update(
                    {
                        additionalnotes:
                            interaction.options.getString("additionalnotes"),
                    },
                    { where: { discordid: sentvideo.id } }
                );

            if (!(await db.dailyStats.findOne({ where: { date: Date.now() } })))
                db.dailyStats.create({
                    date: Date.now(),
                    nbRecordsSubmitted: 1,
                    nbRecordsPending: await db.pendingRecords.count(),
                });
            else
                await db.dailyStats.update(
                    {
                        nbRecordsSubmitted:
                            (
                                await db.dailyStats.findOne({
                                    where: { date: Date.now() },
                                })
                            ).nbRecordsSubmitted + 1,
                    },
                    { where: { date: Date.now() } }
                );

            logger.info(
                `${interaction.user.tag} (${
                    interaction.user.id
                }) submitted ${interaction.options.getString(
                    "levelname"
                )} for ${interaction.options.getString("username")}`
            );
            // Reply
            await interaction.editReply(
                enablePriorityRole &&
                    interaction.member.roles.cache.has(priorityRoleID)
                    ? `:white_check_mark: The priority record for ${interaction.options.getString(
                          "levelname"
                      )} has been submitted successfully`
                    : `:white_check_mark: The record for ${interaction.options.getString(
                          "levelname"
                      )} has been submitted successfully`
            );
        } else if (interaction.options.getSubcommand() === "status") {
            // Check record submissions status //

            // Get records info
            const nbRecords = await db.pendingRecords.count({
                where: { priority: false },
            });
            const nbPriorityRecords = enablePriorityRole
                ? await db.pendingRecords.count({ where: { priority: true } })
                : 0;
            const dbStatus = await db.infos.findOne({
                where: { name: "records" },
            });

            if (!dbStatus)
                return await interaction.editReply(
                    ":x: Something wrong happened while executing the command; please try again later"
                );

            // Create embed to display records info
            const statusMsg = dbStatus.status
                ? "Records are closed. Records can not be submitted, but can be accepted!"
                : "Records are open and are able to be submitted and accepted!";
            const color = dbStatus.status ? 0xcc0000 : 0x8fce00;
            const statusEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle(
                    (dbStatus.status ? ":x:" : ":white_check_mark:") +
                        " Record Status"
                )
                .addFields(
                    {
                        name: "Pending records:",
                        value: `**${nbRecords}**`,
                        inline: true,
                    },
                    enablePriorityRole
                        ? {
                              name: "Pending Priority Records:",
                              value: `**${nbPriorityRecords}**`,
                              inline: true,
                          }
                        : { name: " ", value: " ", inline: true },
                    {
                        name: "Status:",
                        value: `${
                            dbStatus.status ? "**CLOSED**" : "**OPENED**"
                        }`,
                        inline: true,
                    },
                    { name: "\u200B", value: `${statusMsg}`, inline: true }
                )
                .setTimestamp();

            // Send message and reply
            await interaction.channel.send({ embeds: [statusEmbed] });
            await interaction.editReply("Executed command");
        } else if (interaction.options.getSubcommand() === "info") {
            // Check user submission infos //

            // Count records

            const nbPendingRecords = await db.pendingRecords.count({
                where: {
                    submitter: interaction.user.id,
                },
            });

            const nbAcceptedRecords = await db.acceptedRecords.count({
                where: {
                    submitter: interaction.user.id,
                },
            });

            const nbDeniedRecords = await db.deniedRecords.count({
                where: {
                    submitter: interaction.user.id,
                },
            });

            const nbSubmittedRecords =
                nbPendingRecords + nbAcceptedRecords + nbDeniedRecords;

            const requestedStatus = interaction.options.getString("status");
            let strInfo = "";
            let title = "";
            let color = 0x005c91;
            if (requestedStatus === "pending") {
                // Get 20 oldest pending

                title = "Pending records";
                strInfo += `You have submitted ${nbSubmittedRecords} record(s), out of which ${nbAcceptedRecords} were accepted, ${nbDeniedRecords} denied, and ${nbPendingRecords} still pending\n\n**Oldest pending records**:\n`;

                const { QueryTypes } = require("sequelize");
                const { sequelize } = require("../../index.js");

                const totalPendingRecords = await db.pendingRecords.count({
                    where: {},
                });
                const oldestPendingRecords = await sequelize.query(
                    `
					SELECT pr.*, rank
					FROM 
					(SELECT id, RANK() OVER (ORDER BY "priority", "createdAt") AS rank FROM "pendingRecords") as rank_table
					INNER JOIN "pendingRecords" AS pr ON pr.id = rank_table.id
					WHERE submitter = :submitter
					ORDER BY rank
					LIMIT 20
					`,
                    {
                        replacements: { submitter: interaction.user.id },
                        type: QueryTypes.SELECT,
                    }
                );

                for (let i = 0; i < oldestPendingRecords.length; i++) {
                    const createdAt = new Date(
                        oldestPendingRecords[i].createdAt
                    );
                    strInfo += `- **${oldestPendingRecords[i].levelname}** - ${
                        oldestPendingRecords[i].username
                    } - ${
                        oldestPendingRecords[i].rank
                    }/${totalPendingRecords} in queue - Submitted on ${createdAt.toDateString()}\n`;
                }
                if (nbPendingRecords > 20) strInfo += "...";
            } else if (requestedStatus === "accepted") {
                // Get 20 newest accepted

                title = "Accepted records";
                color = 0x8fce00;
                strInfo += `You have submitted ${nbSubmittedRecords} record(s), out of which ${nbAcceptedRecords} were accepted, ${nbDeniedRecords} denied, and ${nbPendingRecords} still pending\n\n**Newly accepted records**:\n`;
                const newestAcceptedRecords = await db.acceptedRecords.findAll({
                    where: {
                        submitter: interaction.user.id,
                    },
                    order: [["createdAt", "DESC"]],
                    limit: 20,
                });

                for (let i = 0; i < newestAcceptedRecords.length; i++) {
                    strInfo += `- **${newestAcceptedRecords[i].levelname}** - ${
                        newestAcceptedRecords[i].username
                    } - Accepted on ${newestAcceptedRecords[
                        i
                    ].updatedAt.toDateString()}\n`;
                }
                if (nbAcceptedRecords > 20) strInfo += "...";
            } else {
                // Get 20 newest denied

                title = "Denied records";
                color = 0xcc0000;
                strInfo += `You have submitted ${nbSubmittedRecords} record(s), out of which ${nbAcceptedRecords} were accepted, ${nbDeniedRecords} denied, and ${nbPendingRecords} still pending\n\n**Newly denied records**:\n`;
                const newestDeniedRecords = await db.deniedRecords.findAll({
                    where: {
                        submitter: interaction.user.id,
                    },
                    order: [["createdAt", "DESC"]],
                    limit: 20,
                });

                for (let i = 0; i < newestDeniedRecords.length; i++) {
                    const denyReason = newestDeniedRecords[i].denyReason;
                    strInfo += `- **${newestDeniedRecords[i].levelname}** - ${
                        newestDeniedRecords[i].username
                    } - Denied on ${newestDeniedRecords[
                        i
                    ].updatedAt.toDateString()}\n\tReason: ${denyReason}\n`;
                }
                if (nbDeniedRecords > 20) strInfo += "...";
            }

            const infoEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(strInfo)
                .setTimestamp();

            return await interaction.editReply({ embeds: [infoEmbed] });
        } else if (interaction.options.getSubcommand() === "updateusers") {
            await parseUsers();
            return await interaction.editReply(`Updated users!`);
        }
    },
};
