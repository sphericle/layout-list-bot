const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} = require("discord.js");
const isUrlHttp = require("is-url-http");
const {
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch,
} = require("../../config.json");
const logger = require("log4js").getLogger();
const axios = require("axios")
const pako = require("pako")

// Decompressed data passed to the function using Gzip
function decompressData(compressedData) {
    const binaryString = atob(compressedData); // Decode base64
    const charData = Uint8Array.from(binaryString, (char) =>
        char.charCodeAt(0)
    );
    const decompressed = pako.ungzip(charData, { to: "string" });
    return JSON.parse(decompressed);
}

async function buildEmbed(moderatorID, page) {
    if (!page) page = 0;
    const { db } = await require("../../index.js")

    const session = await db.bulkRecordSessions.findOne({
        where: {
            moderatorID: moderatorID
        }
    })

    const records = await db.bulkRecords.findAll({
        where: {
            moderatorID: moderatorID,
        }
    })

    let embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle(`${session.playerName}'s records`)
        .setDescription("You can add, remove, edit, and commit these records");
    
    for (const record of records.slice(page * 25, (page + 25) + 25)) {
        embed.addFields({
            name: record.levelname,
            value: `${record.percent}% - ${record.enjoyment}/10`
        })
    }
    return embed;
}

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
    async autocomplete(interaction) {
        const focused = await interaction.options.getFocused(true);
        const Sequelize = require("sequelize");
        const { db } = require("../../index.js")

        if (focused.name === "levelname") {
            let levels = await db.bulkRecords.findAll({
                where: {
                    levelname: Sequelize.where(
                        Sequelize.fn("LOWER", Sequelize.col("levelname")),
                        "LIKE",
                        "%" + focused.value.toLowerCase() + "%"
                    ),
                    moderatorID: interaction.user.id
                },
            });

            return await interaction.respond(
                levels.slice(0, 25).map((level) => ({
                    name: level.levelname,
                    value: level.path,
                }))
            );
        }
    },
    async execute(interaction) {
        const { db } = require("../../index.js");
        if (interaction.options.getSubcommand() === "add") {
            await interaction.deferReply({ ephemeral: true });

            const fileLink = interaction.options.getString("link");
            const device = interaction.options.getString("device");
            const video = interaction.options.getString("completionlink");
            const fps = interaction.options.getInteger("fps");
            const userToPing = interaction.options.getUser("discord");
            const note = interaction.options.getString("notes");

            // Check given URLs
            await interaction.editReply("Checking if the URL is valid...");
            if (/\s/g.test(fileLink) || !isUrlHttp(fileLink))
                return await interaction.editReply(
                    ":x: Couldn't add the record: The provided file link is not a valid URL"
                );
            if (video && (/\s/g.test(video) || !isUrlHttp(video)))
                return await interaction.editReply(
                    ":x: Couldn't add the record: The provided completion link is not a valid URL"
                );


            // using axios so we can send the cookie lol
            /* this is wrong .
            const date = new Date();
            date.setFullYear(date.getFullYear() - 1);
            date.setDate(date.getDate() + 66); // Add 66 days
            const cookieValue = date.toISOString().split('T')[0];
            */
            let responseBody;
            try {
                const response = await axios.get(fileLink, {
                    headers: {
                        "Content-Type": "application/json",
                        "Cookie": `verified=2024-05-24`,
                    },
                    responseType: "arraybuffer"
                });
                responseBody = response.data;
            } catch (error) {
                logger.error(`Error fetching the file from the provided link: ${error}`);
                return await interaction.editReply(
                    ":x: Couldn't fetch the file from the provided link. Please ensure the link is correct and accessible."
                );
            }
            const parsedJson = await JSON.parse(decompressData(responseBody))

            await db.bulkRecordSessions.destroy({
                where: {
                    moderatorID: interaction.user.id
                }
            })

            await db.bulkRecords.destroy({
                where: {
                    moderatorID: interaction.user.id
                }
            })

            // trust me this is a really cool way to do this
            await db.bulkRecordSessions.create({
                moderatorID: interaction.user.id,
                playerName: parsedJson.name,
                video: video,
                mobile: device == "Mobile" ? true : false,
                fps: fps,
                note: note,
                discordID: userToPing.id
            })

            for (const level of parsedJson.levels) {
                await db.bulkRecords.create({
                    moderatorID: interaction.user.id,
                    enjoyment: level.enjoyment,
                    percent: level.percent,
                    path: level.path,
                    levelname: level.name,
                })
            }

            const embed = await buildEmbed(interaction.user.id)

            // Create commit button
            const commit = new ButtonBuilder()
                .setCustomId("commitAddBulkRecords")
                .setLabel("Commit changes")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(commit);

            return await interaction.editReply({ embeds: [embed], components: [row], })

        } else if (interaction.options.getSubcommand() === "delete") {
            await interaction.deferReply({ ephemeral: true });
            const { db } = require('../../index.js')

            const levelPath = interaction.options.getString("levelname")

            await db.bulkRecords.destroy({
                where: {
                    path: levelPath
                }
            })

            const embed = await buildEmbed(interaction.user.id)

            // Create commit button
            const commit = new ButtonBuilder()
                .setCustomId("commitAddBulkRecords")
                .setLabel("Commit changes")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(commit);

            return await interaction.editReply({ embeds: [embed], components: [row], })

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
