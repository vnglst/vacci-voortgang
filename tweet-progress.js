require("dotenv").config();

const Twitter = require("twitter");
const puppeteer = require("puppeteer");
const env = require("env-var");

const POPULATION = 17_480_481;
const TOTAL_BLOCKS = 10;

const CONSUMER_KEY = env.get("CONSUMER_KEY").required().asString();
const CONSUMER_SECRET = env.get("CONSUMER_SECRET").required().asString();
const ACCESS_TOKEN = env.get("ACCESS_TOKEN").required().asString();
const ACCESS_TOKEN_SECRET = env
  .get("ACCESS_TOKEN_SECRET")
  .required()
  .asString();

const client = new Twitter({
  consumer_key: CONSUMER_KEY,
  consumer_secret: CONSUMER_SECRET,
  access_token_key: ACCESS_TOKEN,
  access_token_secret: ACCESS_TOKEN_SECRET,
});

async function scrape() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(
    "https://www.rivm.nl/covid-19-vaccinatie/cijfers-vaccinatieprogramma"
  );

  const result = await page.evaluate(() => {
    let tds = document.querySelectorAll(
      "[class='table table-striped-brand-lightest'] tr:last-child td"
    );
    return {
      atLeastOne: tds[4].textContent.replace(/\./g, ""),
      fully: tds[5].textContent.replace(/\./g, ""),
    };
  });

  browser.close();
  return result;
}

async function main() {
  const { atLeastOne, fully } = await scrape();

  const message =
    "Eén prik:\n" +
    getProgressStr(atLeastOne) +
    "\n\nVolledig gevaccineerd:\n" +
    getProgressStr(fully);

  client.post(
    "statuses/update",
    { status: message },
    async (error, tweet, response) => {
      if (error) return console.error(error);
    }
  );

  return `${message}`;
}

function getProgressStr(vaccinatedPersons) {
  const percentage = (vaccinatedPersons / POPULATION) * 100;
  const blocksDone = Math.round((percentage / 100) * TOTAL_BLOCKS);

  // can't use padStart/End with unicode characters, using this work around
  const progress = "".padStart(blocksDone, "X").padEnd(TOTAL_BLOCKS, "O");
  const niceProgress = progress.replaceAll("X", "🟩").replaceAll("O", "⬜️");

  return `${niceProgress} ${percentage.toFixed(0)}%`;
}

main().then(console.log);
