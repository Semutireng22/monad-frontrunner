/**
 * Monad Frontrunner Bot (Node.js Version)
 * 
 * This is a Node.js implementation of the original Python version by FastLane Labs
 * Created by: Semutireng22
 * 
 * GitHub: https://github.com/Semutireng22/monad-frontrunner
 * Channel: @UGDAirdrop
 * Telegram: @jodohsaya
 */

const { ethers } = require('ethers');
const chalk = require('chalk');
const figlet = require('figlet');
const ora = require('ora');
const toml = require('toml');
const fs = require('fs');
const inquirer = require('inquirer');

const BALANCE_THRESHOLD = 0.001;
const DEFAULT_ATTEMPTS = 10000000;
const GAS_LIMIT = 200000;

async function showGameModeMenu() {
    const { mode } = await inquirer.prompt([
        {
            type: 'list',
            name: 'mode',
            message: chalk.cyan('🎮 SELECT GAME MODE:'),
            choices: [
                {
                    name: '🤖 Automatic Mode',
                    value: 'automatic'
                },
                {
                    name: '🎯 Manual Mode',
                    value: 'manual'
                },
                {
                    name: '🚪 Exit Game',
                    value: 'exit'
                }
            ],
            pageSize: 3
        }
    ]);
    return mode;
}

async function getManualSettings() {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'attempts',
            message: chalk.cyan(`Enter number of attempts (press Enter for default ${DEFAULT_ATTEMPTS}):`),
            default: DEFAULT_ATTEMPTS.toString(),
            validate: (input) => {
                if (input === '') return true;
                const num = parseInt(input);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a valid positive number';
                }
                return true;
            }
        },
        {
            type: 'input',
            name: 'interval',
            message: chalk.cyan('Enter interval in seconds (press Enter for default 1):'),
            default: '1',
            validate: (input) => {
                if (input === '') return true;
                const num = parseFloat(input);
                if (isNaN(num) || num <= 0) {
                    return 'Please enter a valid positive number';
                }
                return true;
            }
        }
    ]);

    return {
        attempts: parseInt(answers.attempts) || DEFAULT_ATTEMPTS,
        interval: parseFloat(answers.interval) || 1
    };
}

async function play() {
    // Tampilkan ASCII art
    console.log(chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan(figlet.textSync('Monad Frontrunner', { font: 'Standard' })));
    console.log(chalk.cyan('='.repeat(60)));

    // Tampilkan kredit
    console.log(chalk.yellow('\n👨‍💻 Created by: Semutireng22'));
    console.log(chalk.yellow('📂 GitHub: https://github.com/Semutireng22/monad-frontrunner'));
    console.log(chalk.yellow('📢 Channel: t.me/UGDAirdrop'));
    console.log(chalk.yellow('💬 Telegram: @jodohsaya'));
    console.log(chalk.cyan('\n' + '='.repeat(60)));

    console.log(chalk.green('\n🚀 Initializing Frontrunner Bot...'));

    // Load config
    const configFile = toml.parse(fs.readFileSync('settings.toml', 'utf-8'));

    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(configFile.api_settings.rpc_url);
    const wallet = new ethers.Wallet(configFile.eoa.private_key, provider);
    console.log(chalk.cyan(`\n👤 Active Account: ${wallet.address}`));

    // Check connection
    try {
        await provider.getNetwork();
        console.log(chalk.green('\n✅ Successfully connected to the Monad network!'));
    } catch (error) {
        console.log(chalk.red('\n❌ Failed to connect to the Ethereum network.'));
        throw error;
    }

    // Get contract
    const contract = new ethers.Contract(
        configFile.game_settings.frontrunner_contract_address,
        JSON.parse(configFile.game_settings.abi_string),
        wallet
    );

    // Check balance
    const balance = ethers.formatEther(await provider.getBalance(wallet.address));
    console.log(chalk.yellow(`\n💰 Account Balance: ${balance} Testnet Monad`));

    if (parseFloat(balance) < BALANCE_THRESHOLD) {
        console.log(chalk.red('\n❌ Insufficient account balance. Please add more funds to continue.'));
        console.log(chalk.yellow('⚠️ Exiting game...'));
        return;
    }

    // Check gas price
    const feeData = await provider.getFeeData();
    const currentGasPrice = ethers.formatUnits(feeData.gasPrice || 0, 'gwei');
    console.log(chalk.yellow(`\n⛽ Current Gas Price: ${currentGasPrice} GWEI`));

    while (true) {
        const mode = await showGameModeMenu();

        if (mode === 'exit') {
            console.log(chalk.yellow('\n👋 Thanks for playing! See you next time!'));
            return;
        }

        let attempts, interval;
        if (mode === 'automatic') {
            attempts = DEFAULT_ATTEMPTS;
            interval = 1;
        } else {
            const settings = await getManualSettings();
            attempts = settings.attempts;
            interval = settings.interval;
        }

        console.log(chalk.green(`\n🎯 Starting game with ${attempts} attempts and ${interval} second intervals`));

        // Check score
        try {
            const [_, wins, losses] = await contract.getScore(wallet.address);
            if (wins > 0 || losses > 0) {
                console.log(chalk.cyan(`\n🏆 Game Stats: ${wins} Wins | ${losses} Losses`));
            } else {
                console.log(chalk.cyan('\n🎮 Welcome new player! Good luck on your first game!'));
            }
        } catch (error) {
            console.log(chalk.red(`\n❌ Failed to get score: ${error} - Continuing without stats...`));
        }

        const nonce = await provider.getTransactionCount(wallet.address);
        console.log(chalk.yellow(`\n📝 Starting Nonce: ${nonce}`));

        let attemptsRemaining = attempts;
        const spinner = ora('🎮 Progress').start();

        while (attemptsRemaining > 0) {
            try {
                const tx = await contract.frontrun({
                    gasLimit: GAS_LIMIT,
                    nonce: nonce + (attempts - attemptsRemaining)
                });
                await tx.wait();
                console.log(chalk.green(`\n✅ Transaction sent! Hash: ${tx.hash}`));
            } catch (error) {
                console.log(chalk.red(`\n❌ Transaction failed! Error: ${error.message}`));
            }

            await new Promise(resolve => setTimeout(resolve, interval * 1000));
            attemptsRemaining--;
            spinner.text = `🎮 Progress: ${attempts - attemptsRemaining}/${attempts}`;
        }

        spinner.succeed(chalk.yellow('\n🏁 Game complete! Returning to main menu...'));
    }
}

play().catch(console.error); 