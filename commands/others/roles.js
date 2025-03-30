const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    enabled: true,
    data: new SlashCommandBuilder()
        .setName("editrole")
        .setDescription(
            "Manage custom role"
        )
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
        ),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true })

        let color = interaction.options.getString("color")
        const name = interaction.options.getString("name")
        const icon = interaction.options.getString("icon")

        if (color && (color.startsWith("#"))) {
            color = color.substring(1)
        }

        const { db } = require("../../index.js")
        const dbRole = await db.adminRoles.findOne({
            where: {
                adminid: interaction.user.id
            }
        })

        if (!dbRole) {
            return interaction.editReply("Error editing role: not found in db!")
        }

        const role = await interaction.member.roles.cache.get(dbRole.roleId)
        if (!role) {
            return interaction.editReply(":x: Could not find you custom role, ensure it isn't deleted and you still have it")
        }
        try {
            await role.edit({
                ...(color ? { color } : {}),
                ...(name ? { name } : {}),
                ...(icon ? { icon } : {})
            })
        } catch (e) {
            return interaction.editReply(`Error editing role: ${e}`)
        }

        return interaction.editReply("Edited your role!")
    },
};
