# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Core Commands

-   `npm run start` - Start the Discord bot (runs `node bot.js` then `node index.js`)
-   `npm run testenv` - Set up test environment by copying debug config
-   `npm run lint` - Run ESLint to check code style and errors
-   `npm run format` - Format code using Prettier with 4-space tabs

### Bot Management

-   `node bot.js` - Register/update Discord slash commands (run this first)
-   `node index.js` - Start the main bot application
-   `./deploy.sh` - Production deployment script (git pull + forever restart)

## Architecture Overview

This is a **Discord bot for managing the Layout List** - a fork of the AREDL bot that manages list maintenance through Discord interactions.

### Key Components

**Entry Points:**

-   `bot.js` - Command registration and deployment to Discord

**Core Structure:**

-   `commands/` - Discord slash commands organized by category (list, records, others, reliable, server, shifts, messages)
-   `buttons/` - Discord button interaction handlers
-   `events/` - Discord event listeners (ready, interactionCreate, guildMemberAdd, etc.)
-   `modals/` - Discord modal form handlers
-   `scheduled/` - Cron job tasks for automated operations
-   `others/` - Utility modules (database schema, git operations, cache updates)

### Database Architecture

Uses **SQLite with Sequelize ORM** with two separate databases:

-   `data/database.sqlite` - Main operational data (records, levels, users, shifts, etc.)
-   `data/cache.sqlite` - Cached data from GitHub repository (levels, users, packs)

### External Integrations

-   **GitHub API** - Manages list data stored in a GitHub repository
-   **Git Operations** - Clones/pulls repository data for processing
-   **Discord.js v14** - Full Discord bot functionality with slash commands

### Key Workflows

1. **Record Submission** - Users submit completions via Discord commands
2. **Record Review** - Staff review submissions through button interactions
3. **List Management** - Automated GitHub commits for accepted records
4. **Shifts System** - Assigns records to moderators on rotating schedule
5. **Cache Updates** - Periodic sync with GitHub repository data

## Configuration Requirements

### Required Files

-   `.env` - Discord bot token and GitHub token
-   `config.json` - Bot configuration (server IDs, channels, GitHub repo details)
-   Both files have example versions (`debug config.json`, `.env.example`)

### Database Initialization

The bot automatically creates and syncs database tables on startup. Two databases are managed:

-   Main database with 20+ tables for bot operations
-   Cache database for GitHub repository data

## Code Style

-   **ESLint** configured for Node.js/CommonJS
-   **Prettier** with 4-space tab width
-   **CommonJS modules** (require/module.exports)
-   Comprehensive error handling and logging via log4js

## Development Notes

-   Commands must have `data`, `execute`, and `enabled` properties
-   All interactions (buttons, modals, commands) are dynamically loaded
-   Extensive logging system with separate SQL query logs
-   Scheduled tasks use node-cron for automation
-   GitHub permissions are validated on startup
