const { SlashCommandBuilder } = require("discord.js");
const { octokit } = require("../../index.js");
const {
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch,
} = require("../../config.json");
const logger = require("log4js").getLogger();

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("flag")
        .setDescription("Flag/nationality management for the list")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("set")
                .setDescription("Set a user's flag")
                .addStringOption((option) =>
                    option
                        .setName("username")
                        .setDescription(
                            "The name of the user to set the flag for"
                        )
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    option
                        .setName("flag")
                        .setDescription(
                            "The country to set the user's flag to. Be sure to choose an option above."
                        )
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("remove")
                .setDescription("Remove a user's flag")
                .addStringOption((option) =>
                    option
                        .setName("username")
                        .setDescription(
                            "The name of the user to remove the flag for"
                        )
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const { cache } = require("../../index.js");
        const Sequelize = require("sequelize");

        if (focused.name === "username") {
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
        } else if (focused.name === "flag") {
            const flags = require("../../others/flagmap.json");

            return await interaction.respond(
                Object.entries(flags)
                    .filter(([key]) =>
                        key.toLowerCase().includes(focused.value.toLowerCase())
                    )
                    .slice(0, 25)
                    .map(([name, value]) => ({ name, value }))
            );
        }
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "set") {
            const username = interaction.options.getString("username");
            const flag = interaction.options.getString("flag");

            if (flag.length > 2)
                return await interaction.editReply(
                    "Invalid country! Make sure you specifically choose an autocompleted option."
                );

            // fetch github data path / _flags.json
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_flags.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch flags.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch flags.json: \n${fetchError}`
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
                logger.info(`Unable to parse flags data:\n${parseError}`);
                return await interaction.editReply(
                    `:x: Unable to parse flags data:\n${parseError}`
                );
            }

            if (parsedData[username] === flag)
                return await interaction.editReply(
                    `:x: ${username}'s flag is already set to ${flag}`
                );

            parsedData[username] = flag;

            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_flags.json`,
                });
                fileSha = response.data.sha;
            } catch (error) {
                logger.info(`Error fetching _flags.json SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from _flags.json`
                );
            }
            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_flags.json`,
                    branch: githubBranch,
                    message: `Set ${username}'s flag (${interaction.user.tag})`,
                    content: Buffer.from(
                        JSON.stringify(parsedData, null, "\t")
                    ).toString("base64"),
                    sha: fileSha,
                });
            } catch (updateError) {
                logger.info(`Couldn't update flags.json: \n${updateError}`);
                return await interaction.editReply(
                    `:x: Couldn't update flags.json: \n${updateError}`
                );
            }

            return await interaction.editReply(
                `:white_check_mark: Successfully set ${username}'s flag to ${flag}`
            );
        } else if (subcommand === "remove") {
            const username = interaction.options.getString("username");

            // fetch github data path / _flags.json
            let fileResponse;
            try {
                fileResponse = await octokit.rest.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_flags.json`,
                    branch: githubBranch,
                });
            } catch (fetchError) {
                logger.info(`Couldn't fetch flags.json: \n${fetchError}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch flags.json: \n${fetchError}`
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
                logger.info(`Unable to parse flags data:\n${parseError}`);
                return await interaction.editReply(
                    `:x: Unable to parse flags data:\n${parseError}`
                );
            }
            if (!parsedData[username])
                return await interaction.editReply(
                    `:x: ${username} doesn't have a flag!`
                );
            // remove entry in json
            delete parsedData[username];

            let fileSha;
            try {
                const response = await octokit.repos.getContent({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_flags.json`,
                });
                fileSha = response.data.sha;
            } catch (error) {
                logger.info(`Error fetching _flags.json SHA:\n${error}`);
                return await interaction.editReply(
                    `:x: Couldn't fetch data from _flags.json`
                );
            }
            try {
                await octokit.repos.createOrUpdateFileContents({
                    owner: githubOwner,
                    repo: githubRepo,
                    path: githubDataPath + `/_flags.json`,
                    branch: githubBranch,
                    message: `Delete ${username}'s flag (${interaction.user.tag})`,
                    content: Buffer.from(
                        JSON.stringify(parsedData, null, "\t")
                    ).toString("base64"),
                    sha: fileSha,
                });
            } catch (updateError) {
                logger.info(`Couldn't update flags.json: \n${updateError}`);
                return await interaction.editReply(
                    `:x: Couldn't update flags.json: \n${updateError}`
                );
            }

            return await interaction.editReply(
                `:white_check_mark: Successfully removed ${username}'s flag`
            );
        }
    },
};
