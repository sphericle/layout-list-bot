const { Events, PermissionsBitField } = require("discord.js");
const logger = require("log4js").getLogger();
const { adminRole } = require("../config.json");

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember) {
        const { db } = require("../index.js");

        const listAdminRole = await oldMember.guild.roles.cache.get(adminRole);
        const oldMemberHasRole = await oldMember.roles.cache.has(
            listAdminRole.id
        );
        const newMemberHasRole = await newMember.roles.cache.has(
            listAdminRole.id
        );

        if (!oldMemberHasRole && newMemberHasRole) {
            const newRole = await oldMember.guild.roles.create({
                name: oldMember.user.displayName,
                color: "Default",
                hoist: false,
                mentionable: false,
                permissions: PermissionsBitField.Default,
                position: listAdminRole.position - 1,
                reason: `${oldMember.user.username} was promoted to admin`,
            });

            // if this user was promoted to admin
            await db.adminRoles.create({
                roleId: newRole.id,
                adminId: oldMember.id,
            });

            await oldMember.roles.add(newRole);
            return;
        } else if (oldMemberHasRole && !newMemberHasRole) {
            // if this user was demoted from admin
            const dbRole = await db.adminRoles.findOne({
                where: {
                    adminId: oldMember.id,
                },
            });
            await dbRole.destroy();
            if (!dbRole) {
                logger.error(
                    `Error deleting role from ${oldMember.user.username}! Role not found in DB.`
                );
                return;
            }

            await oldMember.guild.roles.delete(dbRole.roleId);
            logger.log(`Deleted ${oldMember.user.username}'s custom role!`);
        }
    },
};
