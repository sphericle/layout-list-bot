const {
    githubOwner,
    githubRepo,
    githubDataPath,
    githubBranch,
    changelogID,
    enableSeparateStaffServer,
    guildId,
    staffGuildId,
} = require("../config.json");
const { EmbedBuilder } = require("discord.js");
const logger = require("log4js").getLogger();

module.exports = {
    customId: "commitMoveLevel",
    ephemeral: true,
    async execute(interaction) {
        const { octokit, db, cache } = require("../index.js");
        const { enableChangelogMessage } = require("../config.json");

        // Check for level info corresponding to the message id
        const level = await db.levelsToMove.findOne({
            where: { discordid: interaction.message.id },
        });
        if (!level) {
            await interaction.editReply(
                ":x: This action is no longer available"
            );
            return await interaction.message.delete();
        }

        let list_response;
        let changelog_response;
        try {
            list_response = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + "/_list.json",
                branch: githubBranch,
            });
        } catch {
            return await interaction.editReply(
                ":x: Something went wrong while fetching data from github, please try again later"
            );
        }

        try {
            changelog_response = await octokit.rest.repos.getContent({
                owner: githubOwner,
                repo: githubRepo,
                path: githubDataPath + "/_changelog.json",
                branch: githubBranch,
            });
        } catch {
            logger.info("No changelog file found, creating a new one");
        }

        const list = JSON.parse(
            Buffer.from(list_response.data.content, "base64").toString("utf-8")
        );

        const noDiv = list.filter((level) => !level.startsWith("_"));

        const currentPosition = list.indexOf(level.filename) + 1;
        if (currentPosition == 0)
            return await interaction.editReply(
                ":x: The given level is not on the list"
            );

        const changelogList = changelog_response
            ? JSON.parse(
                  Buffer.from(
                      changelog_response.data.content,
                      "base64"
                  ).toString("utf-8")
              )
            : [];

        if (level.position < 1 || level.position > list.length + 1) {
            return await interaction.editReply(
                ":x: The given position is incorrect"
            );
        }

        const lowered = currentPosition < level.position;

        // get the level below the level we want to place
        // +2 because 1 is index offset and 1 is to get the above level
        const levelBelow = noDiv[level.position - 1];

        // find the index of that level in the real list
        const realBelow = list.indexOf(levelBelow);

        // insert the level above the real list index
        list.splice(realBelow, 0, level.filename);

        // -1 bc indexes
        // insert joke about language with indexing at 1 like maybe they were onto something
        list.splice(lowered ? currentPosition - 1 : currentPosition, 1);

        changelogList.push({
            date: Math.floor(new Date().getTime() / 1000),
            action: currentPosition < level.position ? "lowered" : "raised",
            name: level.filename,
            to_rank: level.position,
            from_rank: currentPosition,
            above: list[level.position] || null,
            below: list[level.position - 2] || null,
        });

        const changes = [
            {
                path: githubDataPath + "/_list.json",
                content: JSON.stringify(list, null, "\t"),
            },
            {
                path: githubDataPath + "/_changelog.json",
                content: JSON.stringify(changelogList, null, "\t"),
            },
        ];

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
                    mode: "100644",
                    type: "blob",
                    content: change.content,
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
                message: `${lowered ? "Lowered" : "Raised"} ${
                    level.filename
                } from ${currentPosition} to ${level.position} (${
                    interaction.user.tag
                })`,
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

        try {
            const above = noDiv[level.position]
                ? await cache.levels.findOne({
                      where: { filename: noDiv[level.position] },
                  })
                : null;
            const below = noDiv[level.position - 2]
                ? await cache.levels.findOne({
                      where: { filename: noDiv[level.position - 2] },
                  })
                : null;
            const levelname = (
                await cache.levels.findOne({
                    where: { filename: level.filename },
                })
            )?.name;

            if (enableChangelogMessage) {
                await db.changelog.create({
                    levelname: levelname,
                    old_position: currentPosition,
                    new_position: level.position,
                    level_above: above?.name || null,
                    level_below: below?.name || null,
                    action: lowered ? "lowered" : "raised",
                });

                let message = `${levelname} has been moved from #${currentPosition} to #${level.position}, `;
                if (above) message += `above ${above?.name}`;
                if (above && below) message += ` and `;
                if (below) message += `below ${below?.name}`;
                message += ".";

                // Create embed to send in public channel
                const publicEmbed = new EmbedBuilder()
                    .setColor(0x8fce00)
                    .setTitle(`:white_check_mark: ${levelname}`) // TODO: maybe make this a random funny message
                    .setDescription(message)
                    .setTimestamp();

                const guild = await interaction.client.guilds.fetch(guildId);
                const staffGuild = enableSeparateStaffServer
                    ? await interaction.client.guilds.fetch(staffGuildId)
                    : guild;

                staffGuild.channels.cache.get(changelogID).send({
                    embeds: [publicEmbed],
                });
            }
        } catch (changelogErr) {
            logger.info(
                `An error occured while creating a changelog entry:\n${changelogErr}`
            );
            return await interaction.editReply(
                `:white_check_mark: Successfully moved **${level.filename}.json** (${newCommit.data.html_url}), but an error occured while creating a changelog entry`
            );
        }

        logger.info(
            `${interaction.user.tag} (${interaction.user.id}) moved ${level.filename} from ${currentPosition} to ${level.position}`
        );
        try {
            logger.info(
                `Successfully created commit on ${githubBranch}: ${newCommit.data.sha}`
            );
            db.levelsToMove.destroy({ where: { discordid: level.discordid } });
        } catch (cleanupErr) {
            logger.info(
                `Successfully created commit on ${githubBranch}: ${newCommit.data.sha}, but an error occured while cleanin up:\n${cleanupErr}`
            );
        }

        return await interaction.editReply(
            `:white_check_mark: Successfully moved **${level.filename}.json** (${newCommit.data.html_url})`
        );
    },
};
