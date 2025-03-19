const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");
const isUrlHttp = require("is-url-http");
const {
    archiveRecordsID,
    priorityRoleID,
    enableSeparateStaffServer,
    enablePriorityRole,
    staffGuildId,
    guildId,
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch,
} = require("../../config.json");
const logger = require("log4js").getLogger();
const { octokit } = require("../../index.js");
const axios = require("axios")
const zlib = require("node:zlib")

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("bulkrecord")
        .setDescription("Commands for adding records submitted with the Grind page")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("add")
                .setDescription(
                    "Add a record directly to the site without submitting it"
                )
                .addStringOption((option) => 
                    option
                        .setName("link")
                        .setDescription("The link to the submitted save file")
                        .setRequired(true)
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
                .addIntegerOption((option) =>
                    option
                        .setName("fps")
                        .setDescription(
                            "The FPS you used to complete the level"
                        )
                        .setRequired(true)
                )
                .addUserOption((option) =>
                    option
                        .setName("discord")
                        .setDescription(
                            "The person to ping in the records channel"
                        )
                )
                .addStringOption((option) =>
                    option
                        .setName("notes")
                        .setDescription("Any other info you'd like to share")
                        .setMaxLength(1024)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("delete")
                .setDescription("Delete a record")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The level this record is on")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("username")
                        .setDescription(
                            "The username of the person who submitted this record"
                        )
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("edit")
                .setDescription("Edit a record")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The level this record is on")
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("username")
                        .setDescription(
                            "The username of the person who submitted this record"
                        )
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("newuser")
                        .setDescription(
                            "The username you're submitting for (Be sure to select one of the available options.)"
                        )
                        .setMaxLength(1024)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("device")
                        .setDescription("Device the level was completed on")
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
                )
                .addIntegerOption((option) =>
                    option
                        .setName("fps")
                        .setDescription(
                            "The FPS you used to complete the level"
                        )
                )
                .addIntegerOption((option) =>
                    option
                        .setName("percent")
                        .setDescription("The percent you got on the level")
                )
                .addIntegerOption((option) =>
                    option
                        .setName("enjoyment")
                        .setDescription(
                            "Your enjoyment rating on this level (1-10)"
                        )
                )
        ),
    async execute(interaction) {
        const { db } = require("../../index.js");
        if (interaction.options.getSubcommand() === "add") {
            await interaction.deferReply({ ephemeral: true });

            // add record to list

            // Check given level name
            const { cache, db } = require("../../index.js");

            const linkStr = interaction.options.getString("link");
            const device = interaction.options.getString("device");
            const rawStr = interaction.options.getString("completionlink");
            const fps = interaction.options.getInteger("fps");
            const userToPing = interaction.options.getUser("discord");
            const note = interaction.options.getString("notes");
            const percent = interaction.options.getInteger("percent") || 100;
            const enjoyment = interaction.options.getInteger("enjoyment") || null;
            const username = interaction.options.getString("username");

            logger.log(linkStr)

            // using axios so we can send the cookie lol
            const date = new Date();
            date.setFullYear(date.getFullYear() - 1);
            date.setDate(date.getDate() + 66); // Add 66 days
            const cookieValue = date.toISOString().split('T')[0];
            console.log(cookieValue)
            let responseBody;
            try {
                const response = await axios.get(linkStr, {
                    headers: {
                        "Content-Type": "application/json",
                        "Cookie": `verified=${cookieValue}`,
                    },
                });
                responseBody = await response.data;
            } catch (error) {
                logger.error(`Error fetching the file from the provided link: ${error}`);
                return await interaction.editReply(
                    ":x: Couldn't fetch the file from the provided link. Please ensure the link is correct and accessible."
                );
            }

            // parse response

            let decompressedBody;
            try {
                decompressedBody = zlib.gunzipSync(Buffer.from(responseBody, "base64")).toString("utf-8");
            } catch (error) {
                logger.error(`Error decompressing the response body: ${error}`);
                return await interaction.editReply(
                    ":x: Couldn't decompress the response body. Please ensure the data is valid."
                );
            }

            let parsedJson;
            try {
                parsedJson = JSON.parse(decompressedBody);
            } catch (error) {
                logger.error(`Error parsing JSON from decompressed body: ${error}`);
                return await interaction.editReply(
                    ":x: Couldn't parse the JSON from the decompressed body. Please ensure the data is valid."
                );
            }

            logger.log(parsedJson)

            const level = await cache.levels.findOne({
                where: {
                    filename: [interaction.options.getString("levelname")],
                },
            });
            if (!level)
                return await interaction.editReply(
                    ":x: Couldn't find the level you're submitting for"
                );
            const filename = level.filename;
            // Get cached user
            let user;
            try {
                user = await cache.users.findOne({
                    where: { name: username },
                });
                if (!user) {
                    await interaction.editReply(
                        "No user found, attempting to create a new one..."
                    );
                    user = await cache.users.create({
                        name: username,
                        user_id: Math.floor(
                            1000000000 + Math.random() * 9000000000
                        ),
                    });

                    logger.log(user);
                }
            } catch (error) {
                logger.error(
                    `Error automatically creating user on record submit: ${error}`
                );
                return await interaction.editReply(
                    `:x: Error creating a new user: ${error} (show this to sphericle!)`
                );
            }

            // Check given URLs
            await interaction.editReply("Checking if the URL is valid...");
            if (/\s/g.test(linkStr) || !isUrlHttp(linkStr))
                return await interaction.editReply(
                    ":x: Couldn't add the record: The provided completion link is not a valid URL"
                );
            if (rawStr && (/\s/g.test(rawStr) || !isUrlHttp(rawStr)))
                return await interaction.editReply(
                    ":x: Couldn't add the record: The provided raw footage link is not a valid URL"
                );

            // Check enjoyment bounds (1-10)
            await interaction.editReply(
                "Checking if the enjoyment is valid..."
            );
            if (enjoyment && (enjoyment < 1 || enjoyment > 10))
                return await interaction.editReply(
                    ":x: Couldn't add the record: Enjoyment rating must be between 1 and 10"
                );

            // Check percent bounds (0-100)
            await interaction.editReply("Checking if the percent is valid...");
            if (percent < 0 || percent > 100)
                return await interaction.editReply(
                    ":x: Couldn't add the record: Percent must be valid (1-100)"
                );

            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/${filename}.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
                );
            }

            let parsedData;
            try {
                parsedData = JSON.parse(
                    Buffer.from(fileResponse.data.content, "base64").toString(
                        "utf-8"
                    )
                );
            } catch (parseError) {
                logger.info(
                    `Unable to parse data fetched from ${filename}:\n${parseError}`
                );
                return await interaction.editReply(
                    `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
                );
            }
            if (!Array.isArray(parsedData.records)) {
                logger.info(
                    `The records field of the fetched ${filename}.json is not an array`
                );
                return await interaction.editReply(
                    `:x: The records field of the fetched ${filename}.json is not an array`
                );
            }

            const githubCode =
                `{\n\t\t"user": "${user.name}",\n\t\t"link": "${linkStr}",\n\t\t"percent": ${percent},\n\t\t"hz": ${fps}` +
                (enjoyment !== null ? `,\n\t\t"enjoyment": ${enjoyment}` : "") +
                (device == "Mobile" ? ',\n\t\t"mobile": true\n}\n' : "\n}");
            const newRecord = JSON.parse(githubCode);

            let existing = false;
            let updated = false;
            // If duplicate, don't add it to githubCodes
            for (const fileRecord of parsedData.records) {
                if (fileRecord.user === user.name) {
                    logger.info(
                        `Found existing record of ${filename} for ${user.name}`
                    );
                    if (fileRecord.percent < percent) {
                        logger.info(
                            "This record has a greater percent on this level, updating..."
                        );
                        fileRecord.percent = percent;
                        fileRecord.enjoyment = enjoyment;
                        fileRecord.link = linkStr;
                        updated = true;
                    } else {
                        logger.info(
                            `Canceled adding duplicated record of ${filename} for ${user.name}`
                        );
                        // TODO: this doesnt work
                        // await db.acceptedRecords.destroy({ where: { id: record.dataValues['id'] } });
                        existing = true;
                    }
                }
            }

            const shiftsLock = await db.infos.findOne({
                where: { name: "shifts" },
            });
            if (!shiftsLock || shiftsLock.status)
                return await interaction.editReply(
                    ":x: The bot is currently assigning shifts, please wait a few minutes before checking records."
                );

            await interaction.editReply(`Writing code...`);

            // Create embed to send in public channel
            let publicEmbed = new EmbedBuilder()
                .setColor(0x8fce00)
                .setTitle(`:white_check_mark: ${level.name}`)
                .addFields(
                    { name: "Percent", value: `${percent}%`, inline: true },
                    {
                        name: "Record holder",
                        value: `${user.name}`,
                        inline: true,
                    },
                    {
                        name: "Record added by",
                        value: `${interaction.user}`,
                        inline: true,
                    },
                    {
                        name: "Device",
                        value: `${device} (${fps} FPS)`,
                        inline: true,
                    },
                    { name: "Link", value: `${linkStr}`, inline: true },
                    {
                        name: "Enjoyment",
                        value: enjoyment ? `${enjoyment}/10` : "None",
                        inline: true,
                    }
                )
                .setTimestamp();

            if (note) {
                publicEmbed.addFields({
                    name: "Note",
                    value: `**_${note}_**`,
                    inline: true,
                });
            }
            logger.info(
                `${interaction.user.tag} (${interaction.user.id}) accepted record of ${level.name} for ${user.name}`
            );

            await interaction.editReply("Adding record...");

            // if the record does not already exist or existed but has been updated
            if (existing === true && updated === false) {
                return await interaction.editReply(
                    `:x: This user already has a record on this level!`
                );
            }
            // Accepting a record //

            await interaction.editReply(`Writing to DB...`);
            let record;
            try {
                const recordEntry = await db.acceptedRecords.create({
                    username: user.name,
                    submitter: interaction.user.id,
                    levelname: level.name,
                    filename: level.filename,
                    device: device,
                    fps: fps,
                    enjoyment: enjoyment,
                    percent: percent,
                    completionlink: linkStr,
                    raw: rawStr,
                    ldm: null,
                    modMenu: "none",
                    additionalnotes: note,
                    priority:
                        enablePriorityRole &&
                        interaction.member.roles.cache.has(priorityRoleID),
                    moderator: interaction.user.id,
                });
                record = recordEntry.dataValues;
            } catch (error) {
                logger.error(
                    `Error adding the record to the accepted table: ${error}`
                );
                return await interaction.editReply(
                    ":x: Couldn't add the record to the database"
                );
            }

            await interaction.editReply("Committing...");
            // Add new record to the level's file if this is a new record (not an updated one)
            if (updated === false)
                parsedData.records = parsedData.records.concat(newRecord);

            // not sure why it needs to be done this way but :shrug:
            let changes = [];
            changes.push({
                path: githubDataPath + `/${filename}.json`,
                content: JSON.stringify(parsedData, null, "\t"),
            });

            const changePath = githubDataPath + `/${filename}.json`;
            const content = JSON.stringify(parsedData);

            const debugStatus = await db.infos.findOne({
                where: { name: "commitdebug" },
            });
            if (!debugStatus || !debugStatus.status) {
                let commitSha;
                try {
                    // Get the SHA of the latest commit from the branch
                    const { data: refData } = await octokit.git.getRef({
                        owner: githubOwner,
                        repo: githubRepo,
                        ref: `heads/${githubBranch}`,
                    });
                    commitSha = refData.object.sha;
                } catch (getRefError) {
                    logger.info(
                        `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (getRefError)"
                    );
                }
                let treeSha;
                try {
                    // Get the commit using its SHA
                    const { data: commitData } = await octokit.git.getCommit({
                        owner: githubOwner,
                        repo: githubRepo,
                        commit_sha: commitSha,
                    });
                    treeSha = commitData.tree.sha;
                } catch (getCommitError) {
                    logger.info(
                        `Something went wrong while fetching the latest commit:\n${getCommitError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (getCommitError)"
                    );
                }

                let newTree;
                try {
                    // Create a new tree with the changes
                    newTree = await octokit.git.createTree({
                        owner: githubOwner,
                        repo: githubRepo,
                        base_tree: treeSha,
                        tree: changes.map((change) => ({
                            path: change.path,
                            mode: "100644",
                            type: "blob",
                            content: change.content,
                        })),
                    });
                } catch (createTreeError) {
                    logger.info(
                        `Something went wrong while creating a new tree:\n${createTreeError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (createTreeError)"
                    );
                }

                let newCommit;
                try {
                    // Create a new commit with this tree
                    newCommit = await octokit.git.createCommit({
                        owner: githubOwner,
                        repo: githubRepo,
                        message: `Added ${record.username}'s record to ${record.levelname} (${interaction.user.tag})`,
                        tree: newTree.data.sha,
                        parents: [commitSha],
                    });
                } catch (createCommitError) {
                    logger.info(
                        `Something went wrong while creating a new commit:\n${createCommitError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (createCommitError)"
                    );
                }

                try {
                    // Update the branch to point to the new commit
                    await octokit.git.updateRef({
                        owner: githubOwner,
                        repo: githubRepo,
                        ref: `heads/${githubBranch}`,
                        sha: newCommit.data.sha,
                    });
                } catch (updateRefError) {
                    logger.info(
                        `Something went wrong while updating the branch :\n${updateRefError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (updateRefError)"
                    );
                }
                logger.info(
                    `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
                );
            } else {
                // Get file SHA
                let fileSha;
                try {
                    const response = await octokit.repos.getContent({
                        owner: githubOwner,
                        repo: githubRepo,
                        path: changePath,
                    });
                    fileSha = response.data.sha;
                } catch (error) {
                    logger.info(`Error fetching ${changePath} SHA:\n${error}`);
                    return await interaction.editReply(
                        `:x: Couldn't fetch data from ${changePath}`
                    );
                }

                try {
                    await octokit.repos.createOrUpdateFileContents({
                        owner: githubOwner,
                        repo: githubRepo,
                        path: changePath,
                        message: `Updated ${changePath} (${interaction.user.tag})`,
                        content: Buffer.from(content).toString("base64"),
                        sha: fileSha,
                    });
                    logger.info(
                        `Updated ${changePath} (${interaction.user.tag}`
                    );
                } catch (error) {
                    logger.info(
                        `Failed to update ${changePath} (${interaction.user.tag}):\n${error}`
                    );
                    await interaction.editReply(
                        `:x: Couldn't update the file ${changePath}, skipping...`
                    );
                }

                await interaction.message.delete();
            }

            // Send all messages simultaneously
            const guild = await interaction.client.guilds.fetch(guildId);
            const staffGuild = enableSeparateStaffServer
                ? await interaction.client.guilds.fetch(staffGuildId)
                : guild;

            // staffGuild.channels.cache.get(acceptedRecordsID).send({ content: '', embeds: [acceptEmbed], components: [row] });
            staffGuild.channels.cache.get(archiveRecordsID).send({
                content: userToPing ? `<@${userToPing.id}>` : "",
                embeds: [publicEmbed],
            });

            // Check if we need to send in dms as well
            const settings = await db.staffSettings.findOne({
                where: { moderator: interaction.user.id },
            });
            if (!settings) {
                await db.staffSettings.create({
                    moderator: interaction.user.id,
                    sendAcceptedInDM: false,
                });
            } else if (settings.sendAcceptedInDM) {
                try {
                    const notRawGithubCode = {
                        user: record.username,
                        link: record.completionlink,
                        percent: record.percent,
                        hz: record.fps,
                        ...(record.device === "Mobile" && { mobile: true }),
                    };
                    if (enjoyment) notRawGithubCode.enjoyment = enjoyment;

                    const rawGithubCode = JSON.stringify(
                        notRawGithubCode,
                        null,
                        "\t"
                    );

                    const dmMessage = `Accepted record of ${record.levelname} for ${record.username}\nGithub Code:\n\`\`\`${rawGithubCode}\`\`\``;
                    await interaction.user.send({ content: dmMessage });
                } catch {
                    logger.info(
                        `Failed to send in moderator ${interaction.user.id} dms, ignoring send in dms setting`
                    );
                }
            }

            // Update moderator data (create new entry if that moderator hasn't accepted/denied records before)
            const modInfo = await db.staffStats.findOne({
                where: { moderator: interaction.user.id },
            });
            if (!modInfo) {
                await db.staffStats.create({
                    moderator: interaction.user.id,
                    nbRecords: 1,
                    nbDenied: 0,
                    nbAccepted: 1,
                });
            } else {
                await modInfo.increment("nbRecords");
                await modInfo.increment("nbAccepted");
            }

            if (!(await db.dailyStats.findOne({ where: { date: Date.now() } })))
                db.dailyStats.create({
                    date: Date.now(),
                    nbRecordsAccepted: 1,
                    nbRecordsPending: await db.pendingRecords.count(),
                });
            else
                await db.dailyStats.update(
                    {
                        nbRecordsAccepted:
                            (
                                await db.dailyStats.findOne({
                                    where: { date: Date.now() },
                                })
                            ).nbRecordsAccepted + 1,
                    },
                    { where: { date: Date.now() } }
                );

            logger.info(
                `${interaction.user.tag} (${interaction.user.id}) submitted ${record.levelname} for ${record.username}`
            );
            return await interaction.editReply(
                enablePriorityRole &&
                    interaction.member.roles.cache.has(priorityRoleID)
                    ? `:white_check_mark: The priority record for ${record.levelname} has been submitted successfully`
                    : `:white_check_mark: The record for ${record.levelname} has been added successfully`
            );
        } else if (interaction.options.getSubcommand() === "delete") {
            await interaction.deferReply({ ephemeral: true });
            const { cache, octokit } = require("../../index.js");
            const level = await cache.levels.findOne({
                where: { filename: interaction.options.getString("levelname") },
            });
            const username = interaction.options.getString("username");

            if (!level)
                return await interaction.editReply(
                    ":x: Couldn't find the level"
                );
            const filename = level.filename;

            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/${filename}.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
                );
            }

            let parsedData;
            try {
                parsedData = JSON.parse(
                    Buffer.from(fileResponse.data.content, "base64").toString(
                        "utf-8"
                    )
                );
            } catch (parseError) {
                logger.info(
                    `Unable to parse data fetched from ${filename}:\n${parseError}`
                );
                return await interaction.editReply(
                    `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
                );
            }
            if (!Array.isArray(parsedData.records)) {
                logger.info(
                    `The records field of the fetched ${filename}.json is not an array`
                );
                return await interaction.editReply(
                    `:x: The records field of the fetched ${filename}.json is not an array`
                );
            }

            const recordIndex = parsedData.records.findIndex(
                (record) => record.user === username
            );
            if (recordIndex === -1)
                return await interaction.editReply(
                    `:x: Couldn't find a record with the username \`${username}\``
                );

            parsedData.records.splice(recordIndex, 1);

            await interaction.editReply("Committing...");

            // not sure why it needs to be done this way but :shrug:
            let changes = [];
            changes.push({
                path: githubDataPath + `/${filename}.json`,
                content: JSON.stringify(parsedData, null, "\t"),
            });

            const changePath = githubDataPath + `/${filename}.json`;
            const content = JSON.stringify(parsedData);

            const debugStatus = await db.infos.findOne({
                where: { name: "commitdebug" },
            });
            if (!debugStatus || !debugStatus.status) {
                let commitSha;
                try {
                    // Get the SHA of the latest commit from the branch
                    const { data: refData } = await octokit.git.getRef({
                        owner: githubOwner,
                        repo: githubRepo,
                        ref: `heads/${githubBranch}`,
                    });
                    commitSha = refData.object.sha;
                } catch (getRefError) {
                    logger.info(
                        `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (getRefError)"
                    );
                }
                let treeSha;
                try {
                    // Get the commit using its SHA
                    const { data: commitData } = await octokit.git.getCommit({
                        owner: githubOwner,
                        repo: githubRepo,
                        commit_sha: commitSha,
                    });
                    treeSha = commitData.tree.sha;
                } catch (getCommitError) {
                    logger.info(
                        `Something went wrong while fetching the latest commit:\n${getCommitError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (getCommitError)"
                    );
                }

                let newTree;
                try {
                    // Create a new tree with the changes
                    newTree = await octokit.git.createTree({
                        owner: githubOwner,
                        repo: githubRepo,
                        base_tree: treeSha,
                        tree: changes.map((change) => ({
                            path: change.path,
                            mode: "100644",
                            type: "blob",
                            content: change.content,
                        })),
                    });
                } catch (createTreeError) {
                    logger.info(
                        `Something went wrong while creating a new tree:\n${createTreeError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (createTreeError)"
                    );
                }

                let newCommit;
                try {
                    // Create a new commit with this tree
                    newCommit = await octokit.git.createCommit({
                        owner: githubOwner,
                        repo: githubRepo,
                        message: `Removed ${username}'s record from ${filename}.json (${interaction.user.tag})`,
                        tree: newTree.data.sha,
                        parents: [commitSha],
                    });
                } catch (createCommitError) {
                    logger.info(
                        `Something went wrong while creating a new commit:\n${createCommitError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (createCommitError)"
                    );
                }

                try {
                    // Update the branch to point to the new commit
                    await octokit.git.updateRef({
                        owner: githubOwner,
                        repo: githubRepo,
                        ref: `heads/${githubBranch}`,
                        sha: newCommit.data.sha,
                    });
                } catch (updateRefError) {
                    logger.info(
                        `Something went wrong while updating the branch :\n${updateRefError}`
                    );
                    await db.messageLocks.destroy({
                        where: { discordid: interaction.message.id },
                    });
                    return await interaction.editReply(
                        ":x: Something went wrong while commiting the records to github, please try again later (updateRefError)"
                    );
                }
                logger.info(
                    `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
                );
                await interaction.editReply("This record has been removed!");
            } else {
                // Get file SHA
                let fileSha;
                try {
                    const response = await octokit.repos.getContent({
                        owner: githubOwner,
                        repo: githubRepo,
                        path: changePath,
                    });
                    fileSha = response.data.sha;
                } catch (error) {
                    logger.info(`Error fetching ${changePath} SHA:\n${error}`);
                    return await interaction.editReply(
                        `:x: Couldn't fetch data from ${changePath}`
                    );
                }

                try {
                    await octokit.repos.createOrUpdateFileContents({
                        owner: githubOwner,
                        repo: githubRepo,
                        path: changePath,
                        message: `Updated ${changePath} (${interaction.user.tag})`,
                        content: Buffer.from(content).toString("base64"),
                        sha: fileSha,
                    });
                    logger.info(
                        `Updated ${changePath} (${interaction.user.tag}`
                    );
                } catch (error) {
                    logger.info(
                        `Failed to update ${changePath} (${interaction.user.tag}):\n${error}`
                    );
                    await interaction.editReply(
                        `:x: Couldn't update the file ${changePath}, skipping...`
                    );
                }
            }
        } else if (interaction.options.getSubcommand() === "edit") {
            await interaction.deferReply({ ephemeral: true });
            const { octokit, cache } = require("../../index.js");
            const levelname = interaction.options.getString("levelname");
            const olduser = interaction.options.getString("username");

            const level = await cache.levels.findOne({
                where: { filename: levelname },
            });

            if (!level)
                return await interaction.editReply(
                    ":x: Couldn't find the level"
                );
            const filename = level.filename;

            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/${filename}.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch ${filename}.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch ${filename}.json: \n${fetchError}`
                );
            }

            let parsedData;
            try {
                parsedData = JSON.parse(
                    Buffer.from(fileResponse.data.content, "base64").toString(
                        "utf-8"
                    )
                );
            } catch (parseError) {
                logger.info(
                    `Unable to parse data fetched from ${filename}:\n${parseError}`
                );
                return await interaction.editReply(
                    `:x: Unable to parse data fetched from ${filename}:\n${parseError}`
                );
            }
            if (!Array.isArray(parsedData.records)) {
                logger.info(
                    `The records field of the fetched ${filename}.json is not an array`
                );
                return await interaction.editReply(
                    `:x: The records field of the fetched ${filename}.json is not an array`
                );
            }

            const recordIndex = parsedData.records.findIndex(
                (record) => record.user === olduser
            );
            if (recordIndex === -1)
                return await interaction.editReply(
                    `:x: Couldn't find a record with the username \`${olduser}\``
                );

            const newuser = interaction.options.getString("newuser") || null;
            const fps = interaction.options.getInteger("fps") || null;
            const percent = interaction.options.getInteger("percent") || null;
            const enjoyment =
                interaction.options.getInteger("enjoyment") || null;
            const video =
                interaction.options.getString("completionlink") || null;
            const device = interaction.options.getString("device") || null;

            if (newuser !== null)
                parsedData.records[recordIndex].user = newuser;
            if (fps !== null) parsedData.records[recordIndex].hz = fps;
            if (percent !== null)
                parsedData.records[recordIndex].percent = percent;
            if (enjoyment !== null)
                parsedData.records[recordIndex].enjoyment = enjoyment;
            if (video !== null) parsedData.records[recordIndex].link = video;
            if (device !== null) {
                if (device === "Mobile") {
                    parsedData.records[recordIndex].mobile = true;
                } else {
                    delete parsedData.records[recordIndex].mobile;
                }
            }

            await interaction.editReply("Committing...");

            // not sure why it needs to be done this way but :shrug:
            let changes = [];
            changes.push({
                path: githubDataPath + `/${filename}.json`,
                content: JSON.stringify(parsedData, null, "\t"),
            });

            let commitSha;
            try {
                // Get the SHA of the latest commit from the branch
                const { data: refData } = await octokit.git.getRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`,
                });
                commitSha = refData.object.sha;
            } catch (getRefError) {
                logger.info(
                    `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getRefError)"
                );
            }
            let treeSha;
            try {
                // Get the commit using its SHA
                const { data: commitData } = await octokit.git.getCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    commit_sha: commitSha,
                });
                treeSha = commitData.tree.sha;
            } catch (getCommitError) {
                logger.info(
                    `Something went wrong while fetching the latest commit:\n${getCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (getCommitError)"
                );
            }

            let newTree;
            try {
                // Create a new tree with the changes
                newTree = await octokit.git.createTree({
                    owner: githubOwner,
                    repo: githubRepo,
                    base_tree: treeSha,
                    tree: changes.map((change) => ({
                        path: change.path,
                        mode: "100644",
                        type: "blob",
                        content: change.content,
                    })),
                });
            } catch (createTreeError) {
                logger.info(
                    `Something went wrong while creating a new tree:\n${createTreeError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createTreeError)"
                );
            }

            let newCommit;
            try {
                // Create a new commit with this tree
                newCommit = await octokit.git.createCommit({
                    owner: githubOwner,
                    repo: githubRepo,
                    message: `Updated ${olduser}'s record on ${levelname} (${interaction.user.tag})`,
                    tree: newTree.data.sha,
                    parents: [commitSha],
                });
            } catch (createCommitError) {
                logger.info(
                    `Something went wrong while creating a new commit:\n${createCommitError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (createCommitError)"
                );
            }

            try {
                // Update the branch to point to the new commit
                await octokit.git.updateRef({
                    owner: githubOwner,
                    repo: githubRepo,
                    ref: `heads/${githubBranch}`,
                    sha: newCommit.data.sha,
                });
            } catch (updateRefError) {
                logger.info(
                    `Something went wrong while updating the branch :\n${updateRefError}`
                );
                return await interaction.editReply(
                    ":x: Something went wrong while commiting the records to github, please try again later (updateRefError)"
                );
            }
            logger.info(
                `Successfully created commit on ${githubBranch} (record update): ${newCommit.data.sha}`
            );
            return await interaction.editReply(
                ":white_check_mark: This record has been updated!"
            );
        }
    },
};
