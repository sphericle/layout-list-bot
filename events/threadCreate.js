const { Events } = require("discord.js");

module.exports = {
    name: Events.ThreadCreate,
    async execute(thread) {
        await thread.join();
    },
};
