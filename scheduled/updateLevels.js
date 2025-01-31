const { guildId } = require('../config.json')

module.exports = {
    name: "resetSubmissions",
    cron: "0 5 0 * * *",
    enabled: true,
    async execute() {
        const { db, client } = require("../index.js");

        let list = await db.levelsInVoting.findAll();
        list = list.map((level) => level = level.discordid);

        const guild = client.guilds.cache.get(guildId);
        
        for (const channelID of list) {
            const channel = guild.channels.cache.get(channelID)
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
            )
        }
    },
};
