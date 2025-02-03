const logger = require("log4js").getLogger();
module.exports = {
    name: "resetSubmissions",
    cron: "0 5 0 * * *",
    enabled: true,
    async execute() {
        const { db } = require("../index.js");
        logger.log("Scheduled - Resetting submissions for all users...");
        await db.submitters.update({ submissions: 0 }, { where: {} });
        await db.levelStats.update(
            { submissions: 0, accepts: 0, denies: 0 },
            { where: {} }
        )
        logger.log("Scheduled - Submissions reset!");
    },
};
