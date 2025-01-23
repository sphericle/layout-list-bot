const { scheduleCacheUpdate } = require("../config.json");
const { parseUsers } = require("../others/gitUtils.js");
const logger = require("log4js").getLogger();

module.exports = {
    name: "updateCache",
    cron: scheduleCacheUpdate,
    enabled: false,
    async execute() {
        const { cache } = require("../index.js");
        cache.updateLevels();
        cache.updatePacks();
        
        await parseUsers();
        /*
        if (typeof users === "string") logger.info(users);
        if (users === 404) return logger.info("No new users."); */
    },
};
