require("dotenv").config();
const Papa = require("papaparse");
const fetch = require("node-fetch");
const Twitter = require("twitter");
const env = require("env-var");

const POPULATION = 17_670_291; // source: https://www.cbs.nl/nl-nl/visualisaties/dashboard-bevolking/bevolkingsteller
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

async function getData() {
  const res = await fetch(
    "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/country_data/Netherlands.csv"
  );
  const csvStr = await res.text();

  const { data } = Papa.parse(csvStr, { header: true });
  const lastEntry = data.at(-2);

  console.log("Most recent entry:", lastEntry);

  const date = new Date(lastEntry.date);
  const atLeastOne = lastEntry.people_vaccinated;
  const fully = lastEntry.people_fully_vaccinated;
  const boosters = lastEntry.total_boosters;

  return { atLeastOne, fully, boosters, date };
}

async function main() {
  const { atLeastOne, fully, boosters, date } = await getData();

  // only tweet if data was updated within the last day
  if (!isWithinLastDay(date)) {
    console.log(`No new data available. Stopping.`);
    return;
  }

  // sanity check if data is plausible
  if (!isPlausible(atLeastOne, fully, boosters)) {
    throw Error("Sanity check failed!");
  }

  const message =
    "Eén prik (% totale populatie)\n" +
    getProgressStr(atLeastOne, "🟨") +
    "\n\nVolledig gevaccineerd\n" +
    getProgressStr(fully, "🟩") +
    "\n\nBoosted\n" +
    getProgressStr(boosters, "🟦") +
    "\n\nPeildatum: " +
    new Intl.DateTimeFormat("nl-NL").format(date);

  client.post(
    "statuses/update",
    { status: message },
    async (error, tweet, response) => {
      if (error) return console.error(error);
    }
  );

  console.log(`Success! Tweeted: \n\n${message}`);
}

function isWithinLastDay(date) {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.round(diffInMs / 1000 / 60 / 60 / 24);
  return diffInDays < 1;
}

function isPlausible(atLeastOne, fully, boosters) {
  return atLeastOne >= 73 && fully >= 67 && boosters >= 8;
}

function getProgressStr(vaccinatedPersons, completeChar = "🟩") {
  const percentage = (vaccinatedPersons / POPULATION) * 100;
  const blocksDone = Math.round((percentage / 100) * TOTAL_BLOCKS);

  // can't use padStart/End with unicode characters, using this work around
  const progress = "".padStart(blocksDone, "X").padEnd(TOTAL_BLOCKS, "O");
  const niceProgress = progress
    .replaceAll("X", completeChar)
    .replaceAll("O", "⬜️");

  return `${niceProgress} ${percentage.toFixed(2)}%`;
}

main();
