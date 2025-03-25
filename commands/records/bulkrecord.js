const {
    SlashCommandBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} = require("discord.js");
const isUrlHttp = require("is-url-http");
const logger = require("log4js").getLogger();
const axios = require("axios");
const pako = require("pako");

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
    const { db } = await require("../../index.js");

    const session = await db.bulkRecordSessions.findOne({
        where: {
            moderatorID: moderatorID,
        },
    });

    const records = await db.bulkRecords.findAll({
        where: {
            moderatorID: moderatorID,
        },
    });
    if (records.length === 0) {
        const errEmbed = new EmbedBuilder()
            .setColor(0xffff00)
            .setTitle(`No records!`)
            .setDescription(
                `You're not currently checking bulk records, start a session with /bulkrecord add`
            );

        return errEmbed;
    }

    let embed = new EmbedBuilder()
        .setColor(0xffff00)
        .setTitle(`${session.playerName}'s records`)
        .setDescription(
            `${session.fps} FPS (${
                session.mobile ? "Mobile" : "PC"
            }) | [Video](${session.video})${
                session.discordID ? " | <@" + session.discordID + ">" : ""
            }`
        );

    for (const record of records.slice(page * 25, page + 25 + 25)) {
        embed.addFields({
            name: record.levelname,
            value: `${record.percent}% - ${record.enjoyment}/10`,
        });
    }
    return embed;
}

/**
 * Updates a date string in format "YYYYMMDD" to the current date at runtime
 * @param {string} dateString - The date string to update, in format "YYYYMMDD"
 * @returns {string} - Current date in the same format "YYYYMMDD"
 */
function getCurrentDate(offset) {
    if (!offset) offset = 0;
    // Get current date and add offset days
    const now = new Date();
    now.setDate(now.getDate() + offset);

    // Format to YYYYMMDD
    const year = now.getFullYear();
    // getMonth() is zero-based, so add 1 and pad with leading zero if needed
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    // Combine into the same format
    return `${year}${month}${day}`;
}

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("bulkrecord")
        .setDescription(
            "Commands for adding records submitted with the Grind page"
        )
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
                .setName("editlevel")
                .setDescription("Edit a record")
                .addStringOption((option) =>
                    option
                        .setName("levelname")
                        .setDescription("The level this record is on")
                        .setRequired(true)
                        .setAutocomplete(true)
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
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("edit")
                .setDescription("Edit the main record data")
                .addStringOption((option) =>
                    option
                        .setName("username")
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
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("addlevel")
                .setDescription("Add a level to the records")
                .addStringOption((option) =>
                    option
                        .setName("lvlname")
                        .setDescription("The level this record is on")
                        .setRequired(true)
                        .setAutocomplete(true)
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
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("view")
                .setDescription("Show all records you're currently checking")
                .addIntegerOption((option) =>
                    option.setName("page").setDescription("The page of levels")
                )
        ),
    async autocomplete(interaction) {
        const focused = await interaction.options.getFocused(true);
        const Sequelize = require("sequelize");
        const { db, cache } = require("../../index.js");

        if (focused.name === "levelname") {
            let levels = await db.bulkRecords.findAll({
                where: {
                    levelname: Sequelize.where(
                        Sequelize.fn("LOWER", Sequelize.col("levelname")),
                        "LIKE",
                        "%" + focused.value.toLowerCase() + "%"
                    ),
                    moderatorID: interaction.user.id,
                },
            });

            return await interaction.respond(
                levels.slice(0, 25).map((level) => ({
                    name: level.levelname,
                    value: level.path,
                }))
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
        } else if (focused.name === "lvlname") {
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
                levels.slice(0, 25).map((level) => ({
                    name: `#${level.position} - ${level.name}`,
                    value: level.filename,
                }))
            );
        }
    },
    async execute(interaction) {
        const { db } = require("../../index.js");
        if (interaction.options.getSubcommand() === "add") {
            await interaction.deferReply({ ephemeral: true });

            let fileLink = interaction.options.getString("link");
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

            const baseIdRegex = /filebin\.net\/([a-z0-9]+)_\d{8}/;
            const baseIdMatch = fileLink.match(baseIdRegex);
            const binID = baseIdMatch[1];

            const numberRegex = /filebin\.net\/[a-z0-9]+_\d{8}\/(\d+)/;
            const numberMatch = fileLink.match(numberRegex);
            const binFileName = numberMatch[1];
            let toOffset = 0;

            // using axios so we can send the cookie lol
            /* this is wrong .
            const date = new Date();
            date.setFullYear(date.getFullYear() - 1);
            date.setDate(date.getDate() + 66); // Add 66 days
            const cookieValue = date.toISOString().split('T')[0];
            */

            let i = 0;
            let responseBody;
            while (!responseBody && i <= 3) {
                let date = getCurrentDate(toOffset);
                try {
                    const modifiedLink = `https://filebin.net/${binID}_${date}/${binFileName}`;
                    const response = await axios.get(modifiedLink, {
                        headers: {
                            "Content-Type": "application/json",
                            Cookie: `verified=2024-05-24`,
                        },
                        responseType: "arraybuffer",
                    });
                    if (response.status === 200) responseBody = response.data;
                } catch (error) {
                    logger.error(
                        `Error fetching the file from all modified links: ${error}`
                    );
                    if (toOffset === 0) {
                        toOffset -= 1;
                    } else {
                        toOffset *= -1;
                    }
                    ++i;
                }
            }
            const parsedJson = await JSON.parse(decompressData(responseBody));

            await db.bulkRecordSessions.destroy({
                where: {
                    moderatorID: interaction.user.id,
                },
            });

            await db.bulkRecords.destroy({
                where: {
                    moderatorID: interaction.user.id,
                },
            });

            // trust me this is a really cool way to do this
            await db.bulkRecordSessions.create({
                moderatorID: interaction.user.id,
                playerName: parsedJson.name,
                video: video,
                mobile: device == "Mobile" ? true : false,
                fps: fps,
                note: note || null,
                discordID: userToPing?.id || null,
            });

            for (const level of parsedJson.levels) {
                await db.bulkRecords.create({
                    moderatorID: interaction.user.id,
                    enjoyment: level.enjoyment,
                    percent: level.percent,
                    path: level.path,
                    levelname: level.name,
                });
            }

            const embed = await buildEmbed(interaction.user.id);

            // Create commit button
            const commit = new ButtonBuilder()
                .setCustomId("commitAddBulkRecords")
                .setLabel("Commit changes")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(commit);

            return await interaction.editReply({
                content: "",
                embeds: [embed],
                components: [row],
            });
        } else if (interaction.options.getSubcommand() === "delete") {
            await interaction.deferReply({ ephemeral: true });
            const { db } = require("../../index.js");

            const levelPath = interaction.options.getString("levelname");

            await db.bulkRecords.destroy({
                where: {
                    path: levelPath,
                },
            });

            const embed = await buildEmbed(interaction.user.id);

            // Create commit button
            const commit = new ButtonBuilder()
                .setCustomId("commitAddBulkRecords")
                .setLabel("Commit changes")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(commit);

            return await interaction.editReply({
                content: "",
                embeds: [embed],
                components: [row],
            });
        } else if (interaction.options.getSubcommand() === "editlevel") {
            await interaction.deferReply({ ephemeral: true });
            const { db } = require("../../index.js");

            const levelPath = interaction.options.getString("levelname");
            const percent = interaction.options.getInteger("percent");
            const enjoyment = interaction.options.getInteger("enjoyment");

            await db.bulkRecords.update(
                {
                    ...(percent !== null && { percent }),
                    ...(enjoyment !== null && { enjoyment }),
                },
                {
                    where: {
                        moderatorID: interaction.user.id,
                        path: levelPath,
                    },
                }
            );

            return await interaction.editReply(
                ":white_check_mark: This record has been updated!"
            );
        } else if (interaction.options.getSubcommand() === "edit") {
            await interaction.deferReply({ ephemeral: true });
            const { db } = require("../../index.js");

            const username = interaction.options.getString("username");
            const device = interaction.options.getString("device");
            const video = interaction.options.getString("completionlink");
            const fps = interaction.options.getInteger("fps");

            await db.bulkRecordSessions.update(
                {
                    ...(username !== null && { playerName: username }),
                    ...(device !== null && { mobile: device === "Mobile" }),
                    ...(video !== null && { video }),
                    ...(fps !== null && { fps }),
                },
                {
                    where: {
                        moderatorID: interaction.user.id,
                    },
                }
            );

            return await interaction.editReply(
                ":white_check_mark: This record has been updated!"
            );
        } else if (interaction.options.getSubcommand() === "addlevel") {
            await interaction.deferReply({ ephemeral: true });
            const { db, cache } = require("../../index.js");

            const levelPath = interaction.options.getString("lvlname");
            const percent = interaction.options.getInteger("percent");
            const enjoyment = interaction.options.getInteger("enjoyment");

            const dbLevel = await cache.levels.findOne({
                where: {
                    filename: levelPath,
                },
            });

            await db.bulkRecords.create({
                moderatorID: interaction.user.id,
                percent: percent !== null ? percent : 0,
                enjoyment: enjoyment !== null ? enjoyment : 0,
                path: dbLevel.filename,
                levelname: dbLevel.name,
            });

            return await interaction.editReply(
                ":white_check_mark: This record has been added!"
            );
        } else if (interaction.options.getSubcommand() === "view") {
            await interaction.deferReply({ ephemeral: true });

            const page = interaction.options.getInteger("page") || 0;

            const embed = await buildEmbed(interaction.user.id, page);

            // Create commit button
            const commit = new ButtonBuilder()
                .setCustomId("commitAddBulkRecords")
                .setLabel("Commit changes")
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(commit);

            return await interaction.editReply({
                content: "",
                embeds: [embed],
                components: [row],
            });
        }
    },
};
