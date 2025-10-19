const logger = require("log4js").getLogger();
const { cloneOrPullRepo, parseLevels } = require("./gitUtils.js");
const path = require("path");
const fs = require("fs");
module.exports = {
    async updateCachedLevels() {
        const { cache } = require("../index.js");

        await cloneOrPullRepo();

        const levels = await parseLevels();

        if (levels.length > 0) {
            await cache.levels.destroy({ where: {} });
            try {
                await cache.levels.bulkCreate(levels);
            } catch (error) {
                logger.error(
                    "Scheduled - " +
                        `Couldn't update cached levels, something went wrong with sequelize: ${error}`
                );
            }
        } else {
            logger.error(
                "Scheduled - " +
                    "Canceled updating levels cache: no levels found."
            );
        }
        return;
    },
    async updateCachedPacks() {
        const { cache } = require("../index.js");
        const fs = require("fs");
        const path = require("path");
        const localRepoPath = path.resolve(__dirname, "../data/repo/");
        const packs = [];

        await cloneOrPullRepo();

        let parsedData;
        try {
            parsedData = JSON.parse(
                fs.readFileSync(
                    path.join(localRepoPath, `data/_packs.json`),
                    "utf8"
                )
            );
        } catch (parseError) {
            return logger.error(
                "Git - " +
                    `Unable to parse data from _packs.json:\n${parseError}`
            );
        }
        for (const pack of parsedData) {
            packs.push({
                name: pack.name,
                difficulty: pack.difficulty,
                isDiff: pack.levels && pack.levels.length > 0,
            });
        }
        cache.packs.destroy({ where: {} });
        try {
            cache.packs.bulkCreate(packs);
        } catch (error) {
            logger.error(
                `Couldn't update cached packs, something went wrong with sequelize: ${error}`
            );
        }
    },
    async updateArchivedLevels() {
        const { cache } = require("../index.js");

        await cloneOrPullRepo();

        const dirPath = path.resolve(__dirname, "../data/repo/data/archived/");
        const dir = fs.readdirSync(dirPath);
        const levels = [];
        for (const filename of dir) {
            const level = JSON.parse(
                fs.readFileSync(path.join(dirPath, filename), "utf8")
            );
            levels.push({
                name: level.name,
                position: level.position,
                filename: filename,
            });
        }

        if (levels.length > 0) {
            await cache.archived.destroy({ where: {} });
            try {
                await cache.archived.bulkCreate(levels);
            } catch (error) {
                logger.error(
                    "Scheduled - " +
                        `Couldn't update cached levels, something went wrong with sequelize: ${error}`
                );
            }
        } else {
            logger.error(
                "Scheduled - " +
                    "Canceled updating levels cache: no levels found."
            );
        }
        return;
    },
};
