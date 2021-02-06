const Discord = require('discord.js') 
const fs = require('fs');

require('dotenv').config()

const client = new Discord.Client()

if(!fs.existsSync(process.env.WALLETS_FILE))
    fs.writeFileSync(process.env.WALLETS_FILE,
        JSON.stringify({}),
        (err, data) => {})

// TEMP
const diff = 0.000002
const minDuration = 100000
const maxDuration = 600000

let wallets = JSON.parse(fs.readFileSync(process.env.WALLETS_FILE))
let minings = {}

const checkNested = (obj, level, ...rest) => {
    if (obj === undefined) return false
    if (rest.length == 0 && obj.hasOwnProperty(level)) return true
    return checkNested(obj[level], ...rest)
}

const doMining = () => {
    const now = Date.now();
    Object.keys(minings).forEach(user => {
        const authorRef = `<@${user}>: `
        Object.keys(minings[user]).forEach(guild => {
            const mining = minings[user][guild];
            if(now - mining.start >= mining.duration) {
                if(mining.currency == 'red' || mining.currency == 'blue') {
                    const currencyEmoji = mining.currency == 'red' ? '<:red:807413126538199090>' : '<:blue:807413114827309146>'
                    const profit = Math.round(mining.duration * diff * Math.random() * 10000) / 10000
                    if(wallets)
                    wallets[user][guild][mining.currency] += profit
                    client.guilds.cache.get(guild).systemChannel.send(authorRef + `⛏️ Mineração concluída! ${(mining.duration / 3600000).toFixed(4)} horas ➡️ **${currencyEmoji}${profit.toFixed(4)}**`)
                }
                delete minings[user][guild]
            }
        })
    })
}

const saveWallets = () => {
    fs.writeFileSync(process.env.WALLETS_FILE,
        JSON.stringify(wallets),
        (err, data) => {})
}

setInterval(doMining, 3000)
setInterval(saveWallets, 10000)

client.on("message", message => {  
    if(!message.content.startsWith(process.env.PREFIX) || message.author.bot) return;
    const text = message.content.slice(String(process.env.PREFIX).length)
    const args = text.split(/ +/)
    
    const authorRef = `<@${message.author.id}>: `

    switch(args[0]) {
        case 'mine':
            if(!checkNested(wallets, message.author.id, message.guild.id))
                message.channel.send(`💰 É necessário ter uma carteira para minerar. Digite \`\`${process.env.PREFIX}wallet\`\` para criar uma carteira nesse servidor.`)
            else if(message.channel.type === 'dm')
                message.channel.send("⛏️ Você não pode minerar aqui. Execute este comando no servidor que deseja minerar.")
            else if(!args[1]) message.channel.send(authorRef + "⛏️ Insira o nome da moeda a ser minerada.")
            else if(args[1].toLowerCase() == 'red' || args[1].toLowerCase() == 'blue') {
                const currencyEmoji = args[1].toLowerCase() == 'red' ? '<:red:807413126538199090>' : '<:blue:807413114827309146>'
                if(checkNested(minings, message.author.id, message.guild.id)) {
                    const mining = minings[message.author.id][message.guild.id];
                    const miningCurrencyEmoji = mining.currency == 'red' ? '<:red:807413126538199090>' : '<:blue:807413114827309146>'
                    message.channel.send(authorRef + `⛏️ Você já está minerando ${miningCurrencyEmoji} há ${(mining.duration / 3600000).toFixed(4)} horas. Para cancelar, digite \`\`${process.env.PREFIX}stop\`\`.`) 
                } else {
                    minings[message.author.id] = {
                        ...minings[message.author.id],
                        [message.guild.id]: {
                            currency: args[1].toLowerCase(),
                            start: Date.now(),
                            duration: Math.random() * maxDuration + minDuration
                        }
                    }
                    message.channel.send(authorRef + `⛏️${currencyEmoji} Mineração iniciada.`)
                }
            } else message.channel.send(authorRef + "⛏️ Moeda desconhecida.")
            break
        case 'stop':
            if(message.channel.type === 'dm') {
                message.channel.send("⛏️ Você não pode minerar aqui. Execute este comando no servidor que deseja minerar.")
                break
            }
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
                    message.channel.send("💰 Você ainda não tem carteiras. Execute este comando num servidor para criar uma carteira.")
                else message.channel.send("💰 Suas carteiras:")
            else {
                if(!checkNested(wallets, message.author.id, message.guild.id))    
                    wallets[message.author.id] = { 
                        ...wallets[message.author.id],
                        [message.guild.id]: {'blue': 0, 'red': 0} 
                    }
                message.channel.send(authorRef + `<:red:807413126538199090>**${wallets[message.author.id][message.guild.id].red.toFixed(4)}** <:blue:807413114827309146>**${wallets[message.author.id][message.guild.id].blue.toFixed(4)}**`)
            }
            break
    }
});

client.login(process.env.BOT_TOKEN); 