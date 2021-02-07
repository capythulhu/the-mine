const Discord = require('discord.js') 
const fs = require('fs');
const perlin = require('./perlin');

require('dotenv').config()

const client = new Discord.Client()

const checkNested = (obj, level, ...rest) => {
    if (obj === undefined) return false
    if (rest.length == 0 && obj.hasOwnProperty(level)) return true
    return checkNested(obj[level], ...rest)
}

const ensureFile = (file, def) => {
    if(!fs.existsSync(file))
    fs.writeFileSync(file,
        JSON.stringify(def),
        (err, data) => {})
}

ensureFile(process.env.WALLETS_FILE, {})
ensureFile(process.env.GUILDS_FILE, {})

let wallets = JSON.parse(fs.readFileSync(process.env.WALLETS_FILE))
let guilds = JSON.parse(fs.readFileSync(process.env.GUILDS_FILE))
let perlins = {}
let minings = {}

// TEMP
const diff = 0.000002
const minDuration = 100
const maxDuration = 600
const chartWidth = 25
const chartHeight = 10

const updateMarket = () => {
    Object.keys(guilds).forEach(guild => {
        if(!perlins[guild]) perlins[guild] = perlin.make(guilds[guild].seed)
        if(!guilds[guild].market) guilds[guild].market = []
        guilds[guild].market.push(Math.pow(perlins[guild].noise(guilds[guild].market.length / 10), 2)
            * (perlins[guild].noise((guilds[guild].market.length * 10 + guilds[guild].market.length)) * 10)
        )
        // LIMIT TO CHARTWIDTH
    });
}

const doMining = () => {
    const now = Date.now();
    Object.keys(minings).forEach(user => {
        const authorRef = `<@${user}>: `
        Object.keys(minings[user]).forEach(guild => {
            const mining = minings[user][guild];
            if(now - mining.start >= mining.duration) {
                if(guilds[guild].currencies[mining.currency]) {
                    const currencyEmoji = guilds[guild].currencies[mining.currency].emoji
                    const profit = Math.round(mining.duration * diff * Math.random() * 10000) / 10000

                    if(!wallets[user]) wallets[user] = {}
                    if(!wallets[user][guild]) wallets[user][guild] = {}
                    if(!wallets[user][guild][mining.currency]) wallets[user][guild][mining.currency] = profit
                    else wallets[user][guild][mining.currency] += profit
                    
                    client.guilds.cache.get(guild).systemChannel.send(authorRef + `⛏️ Mineração concluída! **${(mining.duration / 3600000).toFixed(4)} horas** = **${currencyEmoji}${profit.toFixed(4)}**`)
                }
                delete minings[user][guild]
            }
        })
    })
}

const saveFile = (file, value) => {
    fs.writeFileSync(file,
        JSON.stringify(value),
        (err, data) => {})
}

const getStockMin = value => Math.pow(((value * 321654987 ^ 654321987) % 10000 / 10000) * 2, 2) / 2
const getStockMax = value => Math.pow(((value * 789456123 ^ 987654321) % 10000 / 10000) * 2, 2) / 2

const setupGuild = (guild) => {
    guilds[guild] = {
        seed: Math.random() * 541321489,
        currencies: {
            'blue': {
                emoji: '<:blue:807413114827309146>',
                amount: 0
            },
            'red': {
                emoji: '<:red:807413126538199090>',
                amount: 0
            },
        }
    }
}

setInterval(doMining, 3000)
setInterval(updateMarket, 1000)
setInterval(saveFile, 10000, process.env.WALLETS_FILE, wallets)
setInterval(saveFile, 120000, process.env.GUILDS_FILE, guilds)


client.on('guildCreate', guild => setupGuild(guild.id))
client.on('guildDelete', guild => delete guilds[guild.id])
client.on("message", message => {  
    if(!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;
    const text = message.content.slice(String(process.env.PREFIX).length)
    const args = text.split(/ +/)
    const authorRef = `<@${message.author.id}>: `

    switch(args[0].toLowerCase()) {
        case 'mine':
            if(message.channel.type === 'dm'){
                message.channel.send('⛏️ Você não pode minerar aqui. Execute este comando no servidor que deseja minerar.')
                break
            }
            if(!guilds[message.guild.id]) setupGuild(message.guild.id)
            if(checkNested(minings, message.author.id, message.guild.id)) {
                const mining = minings[message.author.id][message.guild.id];
                    const miningCurrencyEmoji = guilds[message.guild.id].currencies[mining.currency].emoji
                    message.channel.send(authorRef + `⛏️ Você está minerando ${miningCurrencyEmoji} há ${((Date.now() - mining.start) / 3600000).toFixed(4)} horas. Para cancelar, digite \`\`${process.env.PREFIX}stop\`\`.`) 
            } else if(args[1] && guilds[message.guild.id].currencies[args[1].toLowerCase()]) {
                minings[message.author.id] = {
                    ...minings[message.author.id],
                    [message.guild.id]: {
                        currency: args[1].toLowerCase(),
                        start: Date.now(),
                        duration: Math.random() * maxDuration + minDuration
                    }
                }
                const currencyEmoji = guilds[message.guild.id].currencies[args[1].toLowerCase()].emoji
                message.channel.send(authorRef + `⛏️ Mineração de ${currencyEmoji} iniciada.`)
            } else if(!args[1]) message.channel.send(authorRef + '⛏️ Insira o nome da moeda a ser minerada.')
            else message.channel.send(authorRef + '⛏️ Moeda desconhecida.')
            break
        case 'stop':
            if(message.channel.type === 'dm') {
                message.channel.send('⛏️ Você não pode minerar aqui. Execute este comando no servidor que deseja minerar.')
                break
            }
            if(!guilds[message.guild.id]) setupGuild(message.guild.id)
            if(!checkNested(minings, message.author.id, message.guild.id))
                message.channel.send(authorRef + `⛏️ Você não tem nenhuma mineração em progresso. Para começar, digite \`\`${process.env.PREFIX}mine [moeda]\`\`.`) 
            else {
                delete minings[message.author.id][message.guild.id]
                message.channel.send(authorRef + `⛏️ Mineração em progresso finalizada.`)
            }
            break
        case 'wallet':
            if(message.channel.type === 'dm')    
                if(!wallets[message.author.id])
                    message.channel.send('💰 Você ainda não tem saldo. Minere ou compre moedas em algum servidor para adicionar saldo à sua carteira.')
                // TODO
                else message.channel.send('💰')
            else {
                if(!guilds[message.guild.id]) setupGuild(message.guild.id)
                let wallet = ''
                Object.keys(guilds[message.guild.id].currencies).forEach(currency => {
                    let value;
                    if(!checkNested(wallets, message.author.id, message.guild.id, currency)) value = 0
                    else value = wallets[message.author.id][message.guild.id][currency]
                    wallet += guilds[message.guild.id].currencies[currency].emoji
                        + `**${value.toFixed(4)}** `
                })
                message.channel.send(authorRef + wallet)
            }
            break
        case 'stocks':
            if(message.channel.type === 'dm')    
               message.channel.send('📈 Execute este comando em algum servidor para ver a economia local.')
            else {
                if(!guilds[message.guild.id]) setupGuild(message.guild.id)
                if(!guilds[message.guild.id].market) guilds[message.guild.id].market = []
                let chart = ''
                const market = guilds[message.guild.id].market.filter((_, i) => i >= guilds[message.guild.id].market.length - chartWidth)
                const chartMax = Math.max(...market.map(value => value + getStockMax(value) / 5))
                const chartMin = Math.min(...market.map(value => value - getStockMin(value) / 5))
                for(let i = chartHeight; i >= 0; i--) {
                    for(let j = 0; j < chartWidth; j++) {
                        chart += market[j] - chartMin + (getStockMax(market[j]) / 5) > (i - 1) * (chartMax - chartMin) / chartHeight
                            && market[j] - chartMin - (getStockMin(market[j]) / 5) < (i + 1) * (chartMax - chartMin) / chartHeight
                            ? (!j || market[j] > market[j - 1] ? '🟩' : '🟥') : '⬛'
                    }
                    chart += '\n'
                }
                message.channel.send(`\`\`\`\n${chart}\`\`\``)
            }
            break
    }
});

client.login(process.env.BOT_TOKEN); 