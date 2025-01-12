const { SlashCommandBuilder } = require("discord.js");

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
        const search = interaction.options.getString("search") || null;
        let url = "https://g.tenor.com/v1/search?key=LIVDSRZULELA&limit=20";
        if (search) {
            const encodedSearch = encodeURIComponent(search); // filter unusable characters
            url += `&q=${encodedSearch}`;
        }
        const req = await fetch(url);
        const result = await req.json();
        const randomIndex = Math.floor(Math.random() * result.results.length);
        const gif = result.results[randomIndex];
        await interaction.editReply(gif.url);
    },
};
