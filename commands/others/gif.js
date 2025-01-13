const { SlashCommandBuilder } = require("discord.js");
const logger = require('log4js').getLogger()
module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("randomgif")
        .setDescription("Get a random gif from Tenor")
        .addStringOption((option) =>
            option
                .setName("search")
                .setDescription("Text to search Tenor's gifs for")
        ),
    async execute(interaction) {
        await interaction.deferReply();
        const { db } = require("../../index.js");
        // find the stored nextVal in the db
        const nextVal = await db.nextGif.findOne({ where: {} });
        const search = interaction.options.getString("search") || null;
        let url = "https://g.tenor.com/v1/search?key=LIVDSRZULELA&limit=20&contentfilter=medium";
        if (search) {
            const encodedSearch = encodeURIComponent(search); // filter unusable characters
            url += `&q=${encodedSearch}`;
        };
        if (nextVal && nextVal.value) {
            url += `&pos=${nextVal.value}`;
        };
        const req = await fetch(url);
        const result = await req.json();
        logger.log(result);
        const randomIndex = Math.floor(Math.random() * result.results.length);
        // pick a random gif from the response and send the url
        const gif = result.results[randomIndex];
        logger.log(gif)
        await interaction.editReply(
            gif.content_description ? 
            `-# [${gif.content_description}](${gif.url})` :
            gif.url
        );
        // randomly update the nextVal offset for the tenor api
        // https://tenor.com/gifapi/documentation#endpoints-search
        if (randomIndex % 3 !== 0)
            await db.nextGif.update(
                { value: result.next },
                { where: {} },
            )
        return;
    },
};
