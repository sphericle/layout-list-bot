const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { adminRole } = require("../../config.json")
const logger = require('log4js').getLogger()

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("customrole")
        .setDescription(
            "Manage custom roles"
        )
        .addSubcommand((subcommand) => 
            subcommand
                .setName("create")
                .setDescription("Create your custom role!")
                .addStringOption((option) => 
                    option
                        .setName("color")
                        .setDescription("The new hex code to use for the color")
                )
                .addStringOption((option) => 
                    option
                        .setName("name")
                        .setDescription("The new role name")
                )
                .addStringOption((option) => 
                    option
                        .setName("icon")
                        .setDescription("A link to the icon for your role")
                )
        )
        .addSubcommand((subcommand) => 
            subcommand
                .setName("edit")
                .setDescription("Create your custom role!")
                .addStringOption((option) => 
                    option
                        .setName("color")
                        .setDescription("The new hex code to use for the color")
                )
                .addStringOption((option) => 
                    option
                        .setName("name")
                        .setDescription("The new role name")
                )
                .addStringOption((option) => 
                    option
                        .setName("icon")
                        .setDescription("A link to your role's icon")
                )
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true })
        const { db } = require("../../index.js")
        const subcommand = await interaction.options.getSubcommand()
        if (subcommand === "edit") {
            let color = interaction.options.getString("color")
            const name = interaction.options.getString("name")
            const icon = interaction.options.getString("icon")

            if (color && (color.startsWith("#"))) {
                color = color.substring(1)
            }

            let dbRole;
            try {
                dbRole = await db.adminRoles.findOne({
                    where: {
                        adminid: interaction.user.id
                    }
                })
            } catch (e) {
                logger.error(`Error finding role in database! ${e}`)
                return await interaction.editReply("Error editing role: failed to get role from database!")
                
            }

            if (!dbRole) {
                return interaction.editReply("Error editing role: not found in db!")
            }

            let role;
            try {
                role = await interaction.member.roles.cache.get(dbRole.roleId)
                if (!role) {
                    return interaction.editReply(":x: Could not find your custom role, ensure it isn't deleted and you still have it")
                }
                await role.edit({
                    ...(color ? { color } : {}),
                    ...(name ? { name } : {}),
                    ...(icon ? { icon } : {})
                })
            } catch (e) {
                return interaction.editReply(`Error editing role: ${e}`)
            }

            return interaction.editReply("Edited your role!")
        } else if (subcommand === "create") {
            let color = interaction.options.getString("color")
            const name = interaction.options.getString("name")
            const icon = interaction.options.getString("icon")

            if (color && (color.startsWith("#"))) {
                color = color.substring(1)
            }

            const { db } = require("../../index.js")
            
            let listAdminRole
            try {
                listAdminRole = await interaction.guild.roles.cache.get(adminRole);
                if (!listAdminRole) {
                    logger.warn(`No list admin role found! ID: ${adminRole}`)
                }
            } catch (e) {
                logger.error(`Error fetching list admin role (${adminRole}): ${e}`)
                return await interaction.editReply("Error creating custom role: could not find admin role!")
            }

            const role = await interaction.guild.roles.create({
                name: name || interaction.user.displayName,
                color: "Default",
                hoist: false,
                mentionable: false,
                permissions: PermissionsBitField.Default,
                position: listAdminRole.position + 1,
                reason: `${interaction.user.username} created their custom role`,
                ...(icon ? { icon } : {})
            })

            try {
                await db.adminRoles.create({
                    adminid: interaction.user.id,
                    roleId: role.id
                })
            } catch (e) {
                logger.error(`Error adding ${interaction.user.username}'s custom role to the database: ${e}`)
            }
            try {
                await interaction.member.roles.cache.add(role.id)
            } catch (e) {
                logger.error(`Failed to add ${interaction.user.id}'s custom role: ${e}`)
                return await interaction.editReply("Created your role, but there was a problem trying to add it to you :/")
            }

            return interaction.editReply(`Created your role! <@&${role.id}>`)
        }
    },
};
