const { SlashCommandBuilder } = require("discord.js");
const path = require("path")
const fs = require('fs')
const logger = require("log4js").getLogger()
const { octokit } = require("../../index.js")
const { githubOwner, githubBranch, githubRepo, githubDataPath } = require('../../config.json')

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("fix")
        .setDescription(
            "fix"
        ),
    async execute(interaction) {
        await interaction.deferReply({ephemeral: true})
        let changes = [];
        const localRepoPath = path.resolve(__dirname, `../../data/repo/`);
        const listFilename = "data/_list.json";
        let list_data;
        try {
            list_data = JSON.parse(
                fs.readFileSync(path.join(localRepoPath, listFilename), "utf8")
            );
        } catch (parseError) {
            if (!listFilename.startsWith("_"))
                logger.error(
                    "Git - " +
                        `Unable to parse data from ${listFilename}:\n${parseError}`
                );
        }
        
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

            if (parsedData.records && (parsedData.records.length > 0)) {
                let changed = false;
                for (const record of parsedData.records) {
                    if (!record.enjoyment) continue;
                    if (typeof record.enjoyment == "number") continue;
                    if (record.enjoyment === "?") continue;
                    const parsedNumber = parseInt(record.enjoyment);
                    if (typeof parsedNumber !== "number") continue;
                    record.enjoyment = parsedNumber;
                    changed = true;
                }

                if (changed) {
                    changes.push({
                        path: githubDataPath + `/${filename}.json`,
                        content: JSON.stringify(parsedData, null, "\t"),
                    })
                }
            }
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
                `Something went wrong while getting the latest commit SHA: \n${getRefErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (getRefError)"
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
            logger.info(
                `Something went wrong while getting the latest commit: \n${getCommitErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (getCommitError)"
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
                    mode: change.deleted ? "100644" : "100644",
                    type: change.deleted ? "tree" : "blob",
                    content: change.deleted ? null : change.content || "",
                })),
            });
        } catch (createTreeErr) {
            logger.info(
                `Something went wrong while creating a new tree: \n${createTreeErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (createTreeError)"
            );
        }

        let newCommit;
        try {
            // Create a new commit with this tree
            newCommit = await octokit.git.createCommit({
                owner: githubOwner,
                repo: githubRepo,
                message: `Update list files...`,
                tree: newTree.data.sha,
                parents: [commitSha],
            });
        } catch (createCommitErr) {
            logger.info(
                `Something went wrong while creating a new commit: \n${createCommitErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (createCommitError)"
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
            logger.info(
                `Something went wrong while updating the branch reference: \n${updateRefErr}`
            );
            return await interaction.editReply(
                ":x: Couldn't commit to github, please try again later (updateRefError)"
            );
        }
        return await interaction.editReply("done")
    },
};
