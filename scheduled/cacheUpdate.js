const { scheduleCacheUpdate } = require("../config.json");

module.exports = {
    name: "updateCache",
    cron: scheduleCacheUpdate,
    enabled: true,
    async execute() {
        const { cache } = require("../index.js");
        await cache.updateLevels();
        await cache.updatePacks();
        await cache.updateUsers();
        
    },
};
