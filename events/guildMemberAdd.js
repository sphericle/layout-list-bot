const { Events, AttachmentBuilder } = require("discord.js");
const {
    guildMemberAddID,
    guildId,
    enableWelcomeMessage,
} = require("../config.json");
const Canvas = require("@napi-rs/canvas");

const applyText = (canvas, text) => {
    const context = canvas.getContext("2d");
    let fontSize = 60;
    do {
        context.font = `${(fontSize -= 10)}px Arial Rounded MT Bold`;
    } while (context.measureText(text).width > canvas.width - 300);

    return context.font;
};

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
        if (member.guild.id != guildId) return;

        const { db } = require("../index.js");

        if (!(await db.dailyStats.findOne({ where: { date: Date.now() } })))
            db.dailyStats.create({
                date: Date.now(),
                nbMembersJoined: 1,
                nbRecordsPending: await db.pendingRecords.count(),
            });
        else
            await db.dailyStats.update(
                {
                    nbMembersJoined:
                        (
                            await db.dailyStats.findOne({
                                where: { date: Date.now() },
                            })
                        ).nbMembersJoined + 1,
                },
                { where: { date: Date.now() } }
            );

        if (!enableWelcomeMessage) return;

        const avatar = await Canvas.loadImage(
            member.displayAvatarURL({ extension: "jpg" })
        );

        const canvas = Canvas.createCanvas(700, 250);
        const context = canvas.getContext("2d");
        context.fillStyle = "#1372ed30";
        context.roundRect(10, 15, canvas.width - 20, canvas.height - 30, 20);
        context.fill();

        context.font = "28px Arial";
        context.fillStyle = "#d0d0d0";
        context.fillText(
            "just joined!",
            canvas.width / 3 - 60,
            canvas.height / 1.5
        );

        context.font = applyText(canvas, `${member.displayName}`);
        context.fillStyle = "#139ded";
        context.fillText(
            `${member.displayName}`,
            canvas.width / 3 - 60,
            canvas.height / 2.1
        );

        context.save();
        context.beginPath();
        context.arc(canvas.width / 2 + 225, 125, 100, 0, Math.PI * 2, true);
        context.closePath();
        context.clip();

        context.drawImage(avatar, canvas.width / 2 + 125, 25, 200, 200);
        context.restore();

        const attachment = new AttachmentBuilder(await canvas.encode("png"), {
            name: "welcome.png",
        });

        await (
            await member.client.channels.cache.get(guildMemberAddID)
        ).send({
            content: `Welcome to the server ${member}!`,
            files: [attachment],
        });
    },
};
