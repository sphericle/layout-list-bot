const { guildId } = require("../config.json");
const logger = require("log4js").getLogger()

module.exports = {
    name: "updateLevels",
    cron: "0 0 */6 * * *",
    enabled: true,
    async execute() {
        const { db, client } = require("../index.js");

        let list = await db.levelsInVoting.findAll();
        list = list.map((level) => (level = level.discordid));

        const guild = client.guilds.cache.get(guildId);

        for (const channelID of list) {
            const channel = await guild.channels.cache.get(channelID);
            logger.log(channel)
            const text = channel.name;
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
