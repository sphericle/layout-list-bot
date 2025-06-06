const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("listpfix")
        .setDescription("hi"),
    async execute(interaction) {
        const { octokit } = require("../../index.js")
        const path = require("path");
        const fs = require("fs");
        const {
            githubOwner,
            githubRepo,
            githubDataPath,
            githubBranch,
        } = require("../../config.json");
        const logger = require("log4js").getLogger();

        await interaction.deferReply();

        const localRepoPath = path.resolve(__dirname, `../../data/repo/`);
        const listFilename = "data/_list.json";
        const changes = [];
        let list_data_full;
        try {
            list_data_full = JSON.parse(
                fs.readFileSync(
                    path.join(localRepoPath, listFilename),
                    "utf8"
                )
            );
        } catch (parseError) {
            if (!listFilename.startsWith("_"))
                logger.error(
                    "Git - " +
                        `Unable to parse data from ${listFilename}:\n${parseError}`
                );
            return -1;
        }

        let start_of_insane = list_data_full.findIndex((v) => v === "_insanelayouts");
        let end_of_insane = list_data_full.findIndex((v) => v === "_hardlayouts");

        if (start_of_insane === -1 || end_of_insane == -1)
            return await interaction.editReply("whoops");

        const list_data = list_data_full.slice(start_of_insane, end_of_insane);

        for (const filename of list_data) {
            let parsedData;
            try {
                parsedData = JSON.parse(
                    fs.readFileSync(
                        path.join(localRepoPath, `data/${filename}.json`),
                        "utf8"
                    )
                );
            } catch (parseError) {
                if (!filename.startsWith("_"))
                    logger.error(
                        "Git - " +
                            `Unable to parse data from ${filename}.json:\n${parseError}`
                    );
                continue;
            }

            parsedData.percentToQualify = 100;
            changes.push({
                path: githubDataPath + `/${filename}.json`,
                content: JSON.stringify(parsedData, null, "\t"),
            })
        }
        
        let commitSha;
        try {
            // Get the SHA of the latest commit from the branch
            const { data: refData } = await octokit.git.getRef({
                owner: githubOwner,
                repo: githubRepo,
                ref: `heads/${githubBranch}`,
            });
            commitSha = refData.object.sha;
        } catch (getRefErr) {
            logger.info(
                `Failed to get the latest commit SHA: ${getRefErr}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while renaming the user; please try again later"
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
        } catch (getCommitErr) {
            logger.info(`Failed to get the commit SHA: ${getCommitErr}`);
            return await interaction.editReply(
                ":x: Something went wrong while renaming the user; please try again later"
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
        } catch (createTreeErr) {
            logger.info(`Failed to create a new tree: ${createTreeErr}`);
            return await interaction.editReply(
                ":x: Something went wrong while renaming the user; please try again later"
            );
        }

        let newCommit;
        try {
            // Create a new commit with this tree
            newCommit = await octokit.git.createCommit({
                owner: githubOwner,
                repo: githubRepo,
                message: `Update insane layouts list %`,
                tree: newTree.data.sha,
                parents: [commitSha],
            });
        } catch (createCommitErr) {
            logger.info(
                `Failed to create a new commit: ${createCommitErr}`
            );
            return await interaction.editReply(
                ":x: Something went wrong while renaming the user; please try again later"
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
        } catch (updateRefErr) {
            logger.info(`Failed to update the branch: ${updateRefErr}`);
            return await interaction.editReply(
                ":x: Something went wrong while renaming the user; please try again later"
            );
        }
        return await interaction.editReply(":white_check_mark:");

    },
};
