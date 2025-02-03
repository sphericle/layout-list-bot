const {
    SlashCommandBuilder,
    EmbedBuilder,
    AttachmentBuilder,
} = require("discord.js");
const Sequelize = require("sequelize");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const path = require("path");
const ExcelJS = require("exceljs");
const fs = require("fs");
const logger = require("log4js").getLogger();

module.exports = {
    cooldown: 5,
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Statistics about the server")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("checkedrecords")
                .setDescription(
                    "Shows info about all accepted and denied records"
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("pendingrecords")
                .setDescription(
                    "Shows info about all pending and submitted records"
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("servertraffic")
                .setDescription("Shows info about server members traffic")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("exportdb")
                .setDescription("Exports the database")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("exportcache")
                .setDescription("Exports the cache")
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("exportlog")
                .setDescription("Exports the bot logs")
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.options.getSubcommand() === "checkedrecords") {
            const { db } = require("../../index.js");
            const minDate = new Date(new Date() - 30 * 24 * 60 * 60 * 1000);

            const statsData = await db.dailyStats.findAll({
                where: { date: { [Sequelize.Op.gte]: minDate } },
                order: [["date", "ASC"]],
            });

            const labels = [];
            const datasAccepted = [];
            const datasDenied = [];

            for (let i = 0; i < 30; i++) {
                labels.push(statsData[i].date);
                datasAccepted.push(statsData[i].nbRecordsAccepted);
                datasDenied.push(statsData[i].nbRecordsDenied);
            }

            const modsRenderer = new ChartJSNodeCanvas({
                width: 1600,
                height: 600,
                backgroundColour: "white",
            });
            const modsImage = await modsRenderer.renderToBuffer({
                // Build your graph passing option you want
                type: "bar",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Accepted Records",
                            backgroundColor: "green",
                            data: datasAccepted,
                        },
                        {
                            label: "Denied Records",
                            backgroundColor: "red",
                            data: datasDenied,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: "top" },
                        title: {
                            display: true,
                            text: "Records activity from all moderators",
                        },
                    },
                },
            });

            const modsAttachment = await new AttachmentBuilder(modsImage, {
                name: "modsgraph.png",
            });

            const nbAcceptedTotal = await db.acceptedRecords.count();
            const nbDeniedTotal = await db.deniedRecords.count();

            const nbAcceptedRecent = await db.acceptedRecords.count({
                where: { createdAt: { [Sequelize.Op.gte]: minDate } },
            });

            const nbDeniedRecent = await db.deniedRecords.count({
                where: { createdAt: { [Sequelize.Op.gte]: minDate } },
            });

            const modsStatsEmbed = new EmbedBuilder()
                .setColor(0xffbf00)
                .setTitle("All accepted/denied records stats")
                .addFields(
                    { name: "All Time :", value: " " },
                    {
                        name: "Total records checked:",
                        value: `${nbAcceptedTotal + nbDeniedTotal}`,
                        inline: true,
                    },
                    {
                        name: "Accepted records:",
                        value: `${nbAcceptedTotal}`,
                        inline: true,
                    },
                    {
                        name: "Denied records:",
                        value: `${nbDeniedTotal}`,
                        inline: true,
                    },
                    { name: "Past 30 days :", value: " " },
                    {
                        name: "Records checked:",
                        value: `${nbAcceptedRecent + nbDeniedRecent}`,
                        inline: true,
                    },
                    {
                        name: "Accepted records:",
                        value: `${nbAcceptedRecent}`,
                        inline: true,
                    },
                    {
                        name: "Denied records:",
                        value: `${nbDeniedRecent}`,
                        inline: true,
                    }
                )
                .setImage("attachment://modsgraph.png");

            return await interaction.editReply({
                embeds: [modsStatsEmbed],
                files: [modsAttachment],
            });
        } else if (interaction.options.getSubcommand() === "pendingrecords") {
            const { db } = require("../../index.js");
            const minDate = new Date(new Date() - 30 * 24 * 60 * 60 * 1000);

            const statsData = await db.dailyStats.findAll({
                where: { date: { [Sequelize.Op.gte]: minDate } },
                order: [["date", "ASC"]],
            });

            const labels = [];
            const datasPending = [];
            const datasSubmitted = [];

            for (let i = 0; i < 30; i++) {
                labels.push(statsData[i].date);
                datasPending.push(statsData[i].nbRecordsPending);
                datasSubmitted.push(statsData[i].nbRecordsSubmitted);
            }

            const pendingRenderer = new ChartJSNodeCanvas({
                width: 1600,
                height: 600,
                backgroundColour: "white",
            });
            const pendingImage = await pendingRenderer.renderToBuffer({
                // Build your graph passing option you want
                data: {
                    labels: labels,
                    datasets: [
                        {
                            type: "line",
                            label: "Pending Records",
                            backgroundColor: "blue",
                            borderColor: "blue",
                            data: datasPending,
                        },
                        {
                            type: "line",
                            label: "Submitted Records",
                            backgroundColor: "black",
                            borderColor: "black",
                            data: datasSubmitted,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: "top" },
                        title: {
                            display: true,
                            text: "Pending and submitted records over time",
                        },
                    },
                },
            });

            const pendingAttachment = await new AttachmentBuilder(
                pendingImage,
                { name: "pendinggraph.png" }
            );

            const totalSubmitted = datasSubmitted.reduce((a, b) => a + b, 0);
            const averagePending = (
                datasPending.reduce((a, b) => a + b, 0) / datasPending.length
            ).toFixed(2);
            const averageSubmitted = (
                totalSubmitted / datasSubmitted.length
            ).toFixed(2);

            const pendingStatsEmbed = new EmbedBuilder()
                .setColor(0xffbf00)
                .setTitle("All pending records stats")
                .addFields(
                    {
                        name: "Total submitted records (in the past 30 days):",
                        value: `${totalSubmitted}`,
                        inline: true,
                    },
                    {
                        name: "Average submitted records per day:",
                        value: `${averageSubmitted}`,
                        inline: true,
                    },
                    {
                        name: "Average pending records per day:",
                        value: `${averagePending}`,
                        inline: true,
                    }
                )
                .setImage("attachment://pendinggraph.png");

            return await interaction.editReply({
                embeds: [pendingStatsEmbed],
                files: [pendingAttachment],
            });
        } else if (interaction.options.getSubcommand() === "servertraffic") {
            const { db } = require("../../index.js");
            const minDate = new Date(new Date() - 30 * 24 * 60 * 60 * 1000);

            const statsData = await db.dailyStats.findAll({
                where: { date: { [Sequelize.Op.gte]: minDate } },
                order: [["date", "ASC"]],
            });

            const labels = [];
            const datasJoined = [];
            const datasLeft = [];

            for (let i = 0; i < 30; i++) {
                labels.push(statsData[i].date);
                datasJoined.push(statsData[i].nbMembersJoined);
                datasLeft.push(-statsData[i].nbMembersLeft);
            }

            const membersRenderer = new ChartJSNodeCanvas({
                width: 1600,
                height: 600,
                backgroundColour: "white",
            });
            const membersImage = await membersRenderer.renderToBuffer({
                // Build your graph passing option you want
                type: "bar",
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: "Members arrivals",
                            backgroundColor: "blue",
                            data: datasJoined,
                        },
                        {
                            label: "Members leaves",
                            backgroundColor: "gray",
                            data: datasLeft,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: "top" },
                        title: {
                            display: true,
                            text: "Members traffic over time",
                        },
                    },
                },
            });

            const membersAttachment = await new AttachmentBuilder(
                membersImage,
                { name: "membersgraph.png" }
            );

            const totalJoined = datasJoined.reduce((a, b) => a + b, 0);
            const totalLeft = -datasLeft.reduce((a, b) => a + b, 0);

            const membersStatsEmbed = new EmbedBuilder()
                .setColor(0xffbf00)
                .setTitle("Members traffic")
                .addFields(
                    { name: "Past 30 days :", value: " " },
                    {
                        name: "Total arrivals:",
                        value: `${totalJoined}`,
                        inline: true,
                    },
                    {
                        name: "Total leaves:",
                        value: `${totalLeft}`,
                        inline: true,
                    }
                )
                .setImage("attachment://membersgraph.png");

            return await interaction.editReply({
                embeds: [membersStatsEmbed],
                files: [membersAttachment],
            });
        } else if (interaction.options.getSubcommand() === "exportdb") {
            const { db } = require("../../index.js");

            const exportDir = path.join(__dirname, "../../data/exports/");
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            const filePath = path.join(
                exportDir,
                `database_export_${Date.now()}.xlsx`
            );

            try {
                const workbook = new ExcelJS.Workbook();
                const pendingSheet = workbook.addWorksheet("Pending Records");
                const acceptedSheet = workbook.addWorksheet("Accepted Records");
                const deniedSheet = workbook.addWorksheet("Denied Records");
                const dailyStatsSheet = workbook.addWorksheet("Daily Stats");
                const submitters = workbook.addWorksheet("Submitters");
                const levelsInVoting =
                    workbook.addWorksheet("Levels In Voting");
                const skippers = workbook.addWorksheet("Skip counts");
                const levelStats = workbook.addWorksheet("Submission stats");

                // Add columns to the sheets
                pendingSheet.columns = [
                    { header: "Username", key: "username", width: 25 },
                    { header: "Level Name", key: "levelname", width: 30 },
                    { header: "Device", key: "device", width: 20 },
                    { header: "Created At", key: "createdAt", width: 25 },
                ];

                acceptedSheet.columns = [
                    { header: "Username", key: "username", width: 25 },
                    { header: "Level Name", key: "levelname", width: 30 },
                    { header: "Device", key: "device", width: 20 },
                    { header: "Created At", key: "createdAt", width: 25 },
                ];

                deniedSheet.columns = [
                    { header: "Username", key: "username", width: 25 },
                    { header: "Level Name", key: "levelname", width: 30 },
                    { header: "Device", key: "device", width: 20 },
                    { header: "Created At", key: "createdAt", width: 25 },
                ];

                submitters.columns = [
                    { header: "discordid", key: "discordid", width: 25 },
                    { header: "submissions", key: "submissions", width: 30 },
                    { header: "dmFlag", key: "dmFlag", width: 20 },
                    { header: "banned", key: "banned", width: 20 },
                ];

                levelsInVoting.columns = [
                    { header: "levelname", key: "levelname", width: 25 },
                    { header: "submitter", key: "submitter", width: 30 },
                    { header: "discordid", key: "discordid", width: 20 },
                    { header: "yeses", key: "yeses", width: 20 },
                    { header: "nos", key: "nos", width: 20 },
                    { header: "shared", key: "shared", width: 20 },
                ];
                skippers.columns = [
                    { header: "user", key: "user", width: 25 },
                    { header: "count", key: "count", width: 25 },
                ];

                levelStats.columns = [
                    { header: "submissions", key: "submissions", width: 25 },
                    { header: "accepts", key: "accepts", width: 25 },
                    { header: "denies", key: "denies", width: 25 },
                ];

                dailyStatsSheet.columns = [
                    { header: "Date", key: "date", width: 15 },
                    {
                        header: "Records Submitted",
                        key: "nbRecordsSubmitted",
                        width: 25,
                    },
                    {
                        header: "Records Pending",
                        key: "nbRecordsPending",
                        width: 25,
                    },
                    {
                        header: "Records Accepted",
                        key: "nbRecordsAccepted",
                        width: 25,
                    },
                    {
                        header: "Records Denied",
                        key: "nbRecordsDenied",
                        width: 25,
                    },
                    {
                        header: "Members Joined",
                        key: "nbMembersJoined",
                        width: 20,
                    },
                    { header: "Members Left", key: "nbMembersLeft", width: 20 },
                ];

                const pendingRecords = await db.pendingRecords.findAll({
                    attributes: [
                        "username",
                        "levelname",
                        "device",
                        "createdAt",
                    ],
                });
                const acceptedRecords = await db.acceptedRecords.findAll({
                    attributes: [
                        "username",
                        "levelname",
                        "device",
                        "createdAt",
                    ],
                });
                const deniedRecords = await db.deniedRecords.findAll({
                    attributes: [
                        "username",
                        "levelname",
                        "device",
                        "createdAt",
                    ],
                });
                const dailyStats = await db.dailyStats.findAll({
                    attributes: [
                        "date",
                        "nbRecordsSubmitted",
                        "nbRecordsPending",
                        "nbRecordsAccepted",
                        "nbRecordsDenied",
                        "nbMembersJoined",
                        "nbMembersLeft",
                    ],
                });

                const submittersData = await db.submitters.findAll({
                    attributes: [
                        "discordid",
                        "submissions",
                        "dmFlag",
                        "banned",
                    ],
                });

                const levelsInVotingData = await db.levelsInVoting.findAll({
                    attributes: [
                        "levelname",
                        "submitter",
                        "discordid",
                        "yeses",
                        "nos",
                        "shared",
                        "paused",
                    ],
                });

                const skippersData = await db.skippers.findAll({
                    attributes: ["user", "count"],
                });

                const levelStatsData = await db.levelStats.findAll({
                    attributes: ["submissions", "accepts", "denies"],
                });

                pendingRecords.forEach((record) =>
                    pendingSheet.addRow(record.toJSON())
                );
                acceptedRecords.forEach((record) =>
                    acceptedSheet.addRow(record.toJSON())
                );
                deniedRecords.forEach((record) =>
                    deniedSheet.addRow(record.toJSON())
                );
                dailyStats.forEach((stat) =>
                    dailyStatsSheet.addRow(stat.toJSON())
                );
                submittersData.forEach((stat) =>
                    submitters.addRow(stat.toJSON())
                );
                levelsInVotingData.forEach((stat) =>
                    levelsInVoting.addRow(stat.toJSON())
                );
                skippersData.forEach((stat) => skippers.addRow(stat.toJSON()));
                levelStatsData.forEach((stat) =>
                    levelStats.addRow(stat.toJSON())
                );

                await workbook.xlsx.writeFile(filePath);

                const fileAttachment = new AttachmentBuilder(filePath, {
                    name: "database_export.xlsx",
                });
                await interaction.editReply({
                    content: ":white_check_mark: Exported data successfully:",
                    files: [fileAttachment],
                });

                fs.unlinkSync(filePath);
            } catch (error) {
                logger.error(error);
                await interaction.editReply({
                    content:
                        ":x: An error occurred while exporting the database.",
                });
            }
        } else if (interaction.options.getSubcommand() === "exportcache") {
            const { cache } = require("../../index.js");

            const exportDir = path.join(__dirname, "../../data/exports/");
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            const filePath = path.join(
                exportDir,
                `cache_export_${Date.now()}.xlsx`
            );

            try {
                const workbook = new ExcelJS.Workbook();

                const levels = workbook.addWorksheet("Levels");
                const archived = workbook.addWorksheet("Archived");
                const packs = workbook.addWorksheet("Packs");
                const users = workbook.addWorksheet("Users");

                // Add columns to the sheets
                levels.columns = [
                    { header: "Name", key: "name", width: 25 },
                    { header: "Position", key: "position", width: 30 },
                    { header: "Filename", key: "filename", width: 20 },
                ];

                archived.columns = [
                    { header: "Name", key: "name", width: 25 },
                    { header: "Position", key: "position", width: 30 },
                    { header: "Filename", key: "filename", width: 20 },
                ];

                users.columns = [
                    { header: "Name", key: "name", width: 25 },
                    { header: "ID", key: "user_id", width: 30 },
                ];

                packs.columns = [
                    { header: "Name", key: "name", width: 25 },
                    { header: "Difficulty", key: "difficulty", width: 30 },
                    { header: "Diff pack?", key: "isDiff", width: 20 },
                ];

                const levelsData = await cache.levels.findAll({
                    attributes: ["name", "position", "filename"],
                });

                const archivedData = await cache.archived.findAll({
                    attributes: ["name", "position", "filename"],
                });

                const usersData = await cache.users.findAll({
                    attributes: ["name", "user_id"],
                });

                const packsData = await cache.packs.findAll({
                    attributes: ["name", "difficulty", "isDiff"],
                });

                levelsData.forEach((record) => levels.addRow(record.toJSON()));

                archivedData.forEach((record) =>
                    archived.addRow(record.toJSON())
                );

                usersData.forEach((record) => users.addRow(record.toJSON()));

                packsData.forEach((record) => packs.addRow(record.toJSON()));

                await workbook.xlsx.writeFile(filePath);

                const fileAttachment = new AttachmentBuilder(filePath, {
                    name: "database_export.xlsx",
                });
                await interaction.editReply({
                    content: ":white_check_mark: Exported data successfully:",
                    files: [fileAttachment],
                });

                fs.unlinkSync(filePath);
            } catch (error) {
                logger.error(error);
                await interaction.editReply({
                    content:
                        ":x: An error occurred while exporting the database.",
                });
            }
        } else if (interaction.options.getSubcommand() === "exportlog") {
            const exportDir = path.join(__dirname, "../../logs/");
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            const filePath = path.join(exportDir, `latest.log`);

            return await interaction.editReply({
                content: "Bot logs:",
                files: [filePath],
            });
        }
    },
};
