const { scheduleCacheUpdate } = require("../config.json");
const { parseUsers } = require("../others/gitUtils.js");
const { createUser } = require("../commands/records/records.js");
const logger = require("log4js").getLogger();

module.exports = {
    name: "updateCache",
    cron: scheduleCacheUpdate,
    enabled: true,
    async execute() {
        const { cache } = require("../index.js");
        cache.updateLevels();
        cache.updateUsers();
        cache.updatePacks()
    },
};
