const path = require("node:path");
const fs = require("node:fs");
async function test() {
    const foldersPath = path.join(__dirname, "commands");
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
        // Grab all the command files from the commands directory
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs
            .readdirSync(commandsPath)
            .filter((file) => file.endsWith(".js"));
        // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
        
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            if ("test" in command) command.test()
        }
    }
}
test()
