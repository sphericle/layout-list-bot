const { scheduleCacheUpdate } = require("../config.json");
const { parseUsers } = require("../others/gitUtils.js");
const logger = require("log4js").getLogger();

module.exports = {
    name: "updateCache",
    cron: scheduleCacheUpdate,
    enabled: true,
    async execute() {
        const { cache } = require("../index.js");
        await cache.updateLevels();
        await cache.updatePacks();

        const users = await parseUsers();
        if (typeof users === "string") logger.info(users);
        if (users === 404) return logger.info("No new users.");

    },
};
