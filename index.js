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
let lastMarketUpdate = Date.now();

// TEMP
const diff = 0.000002
const minDuration = 30000
const maxDuration = 1800000
const chartWidth = 25
const chartHeight = 10
const miningInterval = 5000
const marketUpdateInterval = 300000
const walletSavingInterval = 10000
const guildSavingInterval = 240000

const updateGuildMarket = guild => {
    if(!perlins[guild]) perlins[guild] = {}
    Object.keys(guilds[guild].currencies).forEach(currency => {
        if(!perlins[guild][currency]) perlins[guild][currency] = {
            'short': perlin.make(guilds[guild].currencies[currency].seed),
            'long': perlin.make((guilds[guild].currencies[currency].seed + 789456123) % 321654987)
        }
        const record = Math.pow(perlins[guild][currency].short.noise(guilds[guild].currencies[currency].ticks / 10), 2)
           * (perlins[guild][currency].long.noise(guilds[guild].currencies[currency].ticks / 100) * 10)
        guilds[guild].currencies[currency].records.push(record)
        guilds[guild].currencies[currency].ticks += 1
        if(guilds[guild].currencies[currency].records.length > chartWidth)
        guilds[guild].currencies[currency].records = guilds[guild].currencies[currency].records
            .splice(guilds[guild].currencies[currency].records.length - chartWidth, chartWidth);
    })
}

const updateMarket = () => {
    Object.keys(guilds).forEach(guild => updateGuildMarket(guild))
    lastMarketUpdate = Date.now()
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
        currencies: {
            'blue': {
                seed: Math.random() * 541321489,
                emoji: '<:blue:807413114827309146>',
                records: [],
                ticks: 0
            },
            'red': {
                seed: Math.random() * 946587231,
                emoji: '<:red:807413126538199090>',
                records: [],
                ticks: 0
            },
        }
    }
}

setInterval(doMining, miningInterval)
setInterval(updateMarket, marketUpdateInterval)
setInterval(saveFile, walletSavingInterval, process.env.WALLETS_FILE, wallets)
setInterval(saveFile, guildSavingInterval, process.env.GUILDS_FILE, guilds)


client.on('guildCreate', guild => setupGuild(guild.id))
client.on('guildDelete', guild => delete guilds[guild.id])
client.on('message', async message => {  
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
                message.channel.send(authorRef + `⛏️ Você está minerando ${miningCurrencyEmoji} há ${((Date.now() - mining.start) / 3600000).toFixed(2)} horas. Para cancelar, digite \`\`${process.env.PREFIX}stop\`\`.`) 
            } else if(args.length >= 2 && guilds[message.guild.id].currencies[args[1].toLowerCase()]) {
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
                if (args.length >= 3) {
                    const firstCurrency = args[1].toLowerCase()
                    const secondCurrency = args[2].toLowerCase()

                    if(!guilds[message.guild.id]) setupGuild(message.guild.id)
                    if(!guilds[message.guild.id].currencies[firstCurrency]
                        || !guilds[message.guild.id].currencies[secondCurrency]) {
                        message.channel.send(authorRef + '📈 Moeda(s) desconhecida(s).')
                        break;
                    }
                    if(guilds[message.guild.id].currencies[firstCurrency].ticks <= 0
                        || guilds[message.guild.id].currencies[secondCurrency].ticks <= 0)
                        updateGuildMarket(message.guild.id)
                        
                    let chart = ''
                    const firstCurrencyData = guilds[message.guild.id].currencies[firstCurrency]
                    const secondCurrencyData  = guilds[message.guild.id].currencies[secondCurrency]
                    const finalRecords = firstCurrencyData.records.map((_, i) => 
                        firstCurrencyData.records[i] / secondCurrencyData.records[i])
                    const chartMin = Math.min(...finalRecords)
                    const heightUnit = (Math.max(...finalRecords) - chartMin) / chartHeight
                    for(let i = chartHeight; i >= 0; i--) {
                        chart += (heightUnit * i + chartMin).toFixed(4) + ' '
                        for(let j = 0; j < chartWidth; j++) {
                            chart += finalRecords[j] > heightUnit * (i - Math.abs((firstCurrencyData.ticks + chartWidth - j) * 175135 % 4 + 1)) + chartMin
                                && finalRecords[j] < heightUnit * (i + Math.abs((secondCurrencyData.ticks + chartWidth - j) * 987456 % 4 + 1)) + chartMin 
                                ? (!j || finalRecords[j] > finalRecords[j - 1] ? '🟩' : '🟥') : '⬛'
                        }
                        chart += '\n'
                    }
                    const firstCurrencyEmoji = guilds[message.guild.id].currencies[firstCurrency].emoji
                    const secondCurrencyEmoji = guilds[message.guild.id].currencies[secondCurrency].emoji
                    message.channel.send(authorRef + `📈 Valor de ${firstCurrencyEmoji}**1** = ${secondCurrencyEmoji}**${finalRecords[finalRecords.length - 1]}**\n\`\`\`${chart}\`\`\`Próxima atualização em ${((lastMarketUpdate + marketUpdateInterval - Date.now()) / 1000).toFixed(0)} segundos.`)
                } else message.channel.send(authorRef + `📈 Há argumentos faltando. Digite \`\`${process.env.PREFIX}stocks [moeda primária] [moeda secundária]\`\`.`)
            }
            break
        case 'trade':
            if(message.channel.type === 'dm')
                message.channel.send('💳 Execute este comando em algum servidor para comercializar moedas.')
            else if (args.length >= 4 && !isNaN(args[1])) {
                if(!guilds[message.guild.id]) setupGuild(message.guild.id)
                const sellingCurrency = args[2].toLowerCase()
                const buyingCurrency = args[3].toLowerCase()
                if(!guilds[message.guild.id].currencies[sellingCurrency]
                    || !guilds[message.guild.id].currencies[buyingCurrency]) {
                    message.channel.send(authorRef + '💳 Moeda(s) desconhecida(s).')
                    break
                }
                if(guilds[message.guild.id].currencies[sellingCurrency].ticks <= 0
                    || guilds[message.guild.id].currencies[buyingCurrency].ticks <= 0)
                    updateGuildMarket(message.guild.id)
                const sellingCurrencyRecord = guilds[message.guild.id].currencies[sellingCurrency].records[guilds[message.guild.id].currencies[sellingCurrency].records.length - 1]
                const buyingCurrencyRecord = guilds[message.guild.id].currencies[buyingCurrency].records[guilds[message.guild.id].currencies[buyingCurrency].records.length - 1]
                const sellingCurrencyEmoji = guilds[message.guild.id].currencies[sellingCurrency].emoji
                const buyingCurrencyEmoji = guilds[message.guild.id].currencies[buyingCurrency].emoji
                if(args[1] <= 0) message.channel.send(authorRef + '💳 Saldo inválido.')
                else if(!checkNested(wallets, message.author.id, message.guild.id, sellingCurrency)
                    || wallets[message.author.id][message.guild.id][sellingCurrency] < args[1])
                    message.channel.send(authorRef + `💳 Saldo insuficiente. Disponível: ${sellingCurrencyEmoji}**${
                        !checkNested(wallets, message.author.id, message.guild.id, sellingCurrency) ? 0 : wallets[message.author.id][message.guild.id][sellingCurrency].toFixed(4)
                    }**.`)
                else {
                    const sellingRoundedCurrency = Math.round(args[1] * 100000) / 100000
                    const convertedCurrency = Math.round(sellingCurrencyRecord / buyingCurrencyRecord * args[1] * 100000) / 100000
                    wallets[message.author.id][message.guild.id][sellingCurrency] -= sellingRoundedCurrency
                    if(!wallets[message.author.id][message.guild.id][buyingCurrency]) 
                        wallets[message.author.id][message.guild.id][buyingCurrency] = convertedCurrency
                    else wallets[message.author.id][message.guild.id][buyingCurrency] += convertedCurrency
                    message.channel.send(authorRef + `\n💳 Transação realizada:\n**-${sellingCurrencyEmoji}${sellingRoundedCurrency}\n+${buyingCurrencyEmoji}${convertedCurrency}**`)
                }
            } else message.channel.send(authorRef + `💳 Há argumentos faltando. Digite \`\`${process.env.PREFIX}trade [quantidade] [moeda a ser vendida] [moeda a ser comprada]\`\`.`)
            break
        case 'ranking':
            if(message.channel.type === 'dm'){
                message.channel.send('💎 Execute este comando em algum servidor para ver o ranking.')
                break
            }
            if(!guilds[message.guild.id]) setupGuild(message.guild.id)
            const currency = args[1] && args[1].toLowerCase()
            if(args.length >= 2 && guilds[message.guild.id].currencies[currency]) {
                let ranking = []
                Object.keys(wallets).forEach(wallet =>
                    Object.keys(wallets[wallet]).forEach(guild => {
                        if(guild === message.guild.id && wallets[wallet][guild][currency])
                            ranking.push({'id': wallet, 'wallet': wallets[wallet][guild]})
                    })
                )
                ranking = ranking.splice(ranking.length - 10, 10)
                ranking.sort((a, b) => a.wallet[currency] - b.wallet[currency]).reverse()
                await Promise.all(ranking.map(async user =>
                    user.username = (await client.users.fetch(user.id)).username))

                const currencyEmoji = guilds[message.guild.id].currencies[currency].emoji
                let rank = ''
                ranking.forEach((wallet, i) => 
                    rank += `**${i + 1}º** ${wallet.username} ${currencyEmoji}${wallet.wallet[currency].toFixed(4)}\n`)
                
                message.channel.send(authorRef + '\n💎 Usuários mais ricos do servidor:\n' + rank)
            } else if(!args[1]) message.channel.send(authorRef + '💎 Insira o nome da moeda a ser ranqueada.')
            else message.channel.send(authorRef + '💎 Moeda desconhecida.')
            break
    }
});

client.login(process.env.BOT_TOKEN); 