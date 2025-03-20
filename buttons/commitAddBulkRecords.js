const { 
    githubDataPath,
    githubOwner,
    githubRepo,
    githubBranch
} = require("../config.json")
const logger = require("log4js").getLogger()
const fs = require("fs")
const path = require("path")

module.exports = {
    customId: "commitAddBulkRecords",
    ephemeral: true,
    async execute(interaction) {
        // https://filebin.net/ttfthfqf64cxkthb3je55/509227
        const { db, octokit } = require("../index.js")

        const session = await db.bulkRecordSessions.findOne({
            where: {
                moderatorID: interaction.user.id
            }
        })

        const records = await db.bulkRecords.findAll({
            where: {
                moderatorID: interaction.user.id
            }
        })

        const changes = []

        const localRepoPath = path.resolve(__dirname, `../data/repo/`);

        for (const record of records) {
            let parsedData;
            try {
                parsedData = JSON.parse(
                    fs.readFileSync(
                        path.join(localRepoPath, `data/${record.path}.json`),
                        "utf8"
                    )
                );
            } catch (parseError) {
                if (!record.path.startsWith("_"))
                    logger.error(
                        "Git - " +
                            `Unable to parse data from ${record.path}.json:\n${parseError}`
                    );
            }

            let recordToAdd = {
                "user": session.playerName,
                "link": session.video,
                "percent": record.percent,
                "hz": session.fps,
                "mobile": session.mobile,
            }

            if (record.enjoyment)
                recordToAdd.enjoyment = record.enjoyment

            parsedData.records.push(recordToAdd)

            changes.push({
                path: `${githubDataPath}/${record.path}.json`,
                content: JSON.stringify(parsedData, null, "\t"),
            });
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
        } catch (getRefError) {
            logger.info(
                `Something went wrong while fetching the latest commit SHA:\n${getRefError}`
            );
            await db.messageLocks.destroy({
                where: { discordid: interaction.message.id },
            });
            return await interaction.editReply(
                ":x: Something went wrong while commiting to github, please try again later (getRefError)"
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
                ":x: Something went wrong while commiting to github, please try again later (getCommitError)"
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
                ":x: Something went wrong while commiting to github, please try again later (createTreeError)"
            );
        }

        let newCommit;
        try {
            // Create a new commit with this tree
            newCommit = await octokit.git.createCommit({
                owner: githubOwner,
                repo: githubRepo,
                message: `Bulk-add ${session.playerName}'s records`,
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
                ":x: Something went wrong while commiting to github, please try again later (createCommitError)"
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
                ":x: Something went wrong while commiting to github, please try again later (updateRefError)"
            );
        }
        logger.info(
            `Successfully created commit on ${githubBranch} (record addition): ${newCommit.data.sha}`
        );

        await interaction.editReply(":white_check_mark: Added records!")

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
        return;
    }
}
