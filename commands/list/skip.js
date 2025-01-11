const { SlashCommandBuilder } = require("discord.js");
const { feedbackBanID } = require("../../config.json");
const logger = require("log4js").getLogger();

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Command to manage counting skip counts in feedback")
        .addSubcommand((subcommand) =>
            subcommand
                .setName("add")
                .setDescription("Increase the count")
                .addStringOption((option) =>
                    option
                        .setName("user")
                        .setDescription(
                            "The discord user"
                        )
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand((subcommand) =>
            subcommand
                .setName("remove")
                .setDescription("Decrease the count")
                .addStringOption((option) =>
                    option
                        .setName("user")
                        .setDescription(
                            "The discord user"
                        )
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),
    async autocomplete(interaction) {
        const { db } = require("../../index.js");
        const focused = interaction.options.getFocused();
        const members = interaction.guild.members.cache;
        const response = await members
            .filter((member) =>
                member.user.username
                    .toLowerCase()
                    .includes(focused.toLowerCase())
            )
        
        await response
            .map(async (member) => {
                let count = 0;
                /*
                let dbMember = await db.skippers.findOne({
                    where: {
                        user: member.id
                    }
                })
                logger.log(`Db member: ${dbMember}`)
                count = dbMember ? dbMember.count : 0;
                */
                logger.log(`Count: ${count}`)
                return {
                    name: `${member.user.username}`,
                    value: member.id,
                }
            })
        logger.log(response);

        await interaction.respond(response);
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const subcommand = interaction.options.getSubcommand();
        const { db } = require("../../index.js");
        if (subcommand === "add") {
            const username = interaction.options.getString("user");
            let dbUser;
            dbUser = await db.skippers.findOne({
                where: {
                    user: username
                }
            })
            if (!dbUser)
                dbUser = await db.skippers.create({
                    user: username,
                    count: 0,
                }).dataValues;
            await dbUser.increment("count");
            // ban the user if they at 3 now
            if (dbUser.count === 3) {
                const member = await interaction.guild.members.cache.get(dbUser.user);
                if (member) {
                    await member.roles.add(feedbackBanID);
                    logger.info(`Feedback banned user ${username}`);
                    await db.skippers.destroy({
                        where: {
                            user: username
                        }
                    })
                    return await interaction.editReply(`${username} has been banned from feedback.`)
                } else {
                    logger.warn(`User with ID ${dbUser.user} not found in guild`);
                    return await interaction.editReply("Count increased to 3, but an error occurred while trying to add the feedback ban role.")
                }
            }
            return await interaction.editReply(`Skip count for ${username} has been increased to ${dbUser.count}.`);
        } else if (subcommand === "remove") {
            const username = interaction.options.getString("user");
            let user;
            user = await db.skippers.findOne({
                where: {
                    name: username
                }
            })
            if (!user)
                user = await db.skippers.create({
                    name: username,
                    count: 0,
                }).dataValues;
            
            
            user.increment("count");
            return await interaction.editReply(`Skip count for ${username} has been increased to ${user.count}.`);
        }
    },
};
