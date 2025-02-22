const { guildId } = require("../config.json");
const logger = require("log4js").getLogger();

module.exports = {
    name: "updateLevels",
    cron: "0 0 */6 * * *",
    enabled: true,
    async execute(manual) {
        const { db, client } = require("../index.js");
        if (manual) logger.trace("Scheduled - Updating vote database...")

        let list = await db.levelsInVoting.findAll();
        list = list.map((level) => (level = level.discordid));

        const guild = client.guilds.cache.get(guildId);

        for (const channelID of list) {
            const channel = await guild.channels.cache.get(channelID);

            if (!channel) {
                // discord channel must not exist anymore, so
                // delete it from the database...
                logger.warn(`Deleting reliable entry with ID ${channelID}`);
                await db.levelsInVoting.destroy({
                    where: {
                        discordid: channelID,
                    },
                });
                continue;
            }

            const text = channel.name;
            if (manual) logger.trace(`Scheduled: Processing channel: ${text}`)
            const matchLevelName = text.match(/^(.*)\s\d+-\d+$/);
            const matchYes = text.match(/(\d+)-\d+$/);
            const matchNo = text.match(/\d+-(\d+)$/);

            await db.levelsInVoting.update(
                {
                    levelname: matchLevelName[1],
                    yeses: matchYes[1],
                    nos: matchNo[1],
                },
                { where: { discordid: channelID } }
            );
        }
    },
};
