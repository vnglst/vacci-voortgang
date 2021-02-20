require('dotenv').config()
const Twitter = require('twitter')
const puppeteer = require('puppeteer')
const env = require('env-var')

const CONSUMER_KEY = env.get('CONSUMER_KEY').required().asString()
const CONSUMER_SECRET = env.get('CONSUMER_SECRET').required().asString()
const ACCESS_TOKEN = env.get('ACCESS_TOKEN').required().asString()
const ACCESS_TOKEN_SECRET = env.get('ACCESS_TOKEN_SECRET').required().asString()

const client = new Twitter({
  consumer_key: CONSUMER_KEY,
  consumer_secret: CONSUMER_SECRET,
  access_token_key: ACCESS_TOKEN,
  access_token_secret: ACCESS_TOKEN_SECRET,
})

async function scrape() {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()
  await page.goto(
    'https://coronadashboard.rijksoverheid.nl/landelijk/vaccinaties',
  )
  const value = await page.evaluate(() => {
    let kpis = document.querySelectorAll('[class^=kpi-value]')
    return kpis[0].textContent
  })
  browser.close()
  return value.replace(/\./g, '')
}

const main = async () => {
  const POPULATION = 17_480_481
  const TOTAL_BLOCKS = 15
  const vaccinations = await scrape()
  const percentageDoses = (vaccinations / POPULATION) * 100
  const percentageVaccinated = percentageDoses / 2
  const blocksDone = Math.round((percentageVaccinated / 100) * TOTAL_BLOCKS)
  const progress = ''.padEnd(blocksDone, '▓').padEnd(15, '░')
  const message = `${progress} ${percentageVaccinated
    .toFixed(2)
    .replace('.', ',')}%`

  client.post(
    'statuses/update',
    { status: message },
    async (error, tweet, response) => {
      if (error) return console.error(error)
      // console.log(tweet) // Tweet body.
    },
  )

  return `${message}`
}

main().then(console.log).catch(console.error)
