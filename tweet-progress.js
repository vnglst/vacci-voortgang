require("dotenv").config();
const Papa = require("papaparse");
const fetch = require("node-fetch");
const Twitter = require("twitter");
const env = require("env-var");

// source: https://www.cbs.nl/nl-nl/visualisaties/dashboard-bevolking/bevolkingsteller
// peildatum: eind november 2021
const POPULATION = 17_591_194;
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

  const publishedDate = new Date(lastEntry.date);
  const atLeastOne = lastEntry.people_vaccinated;
  const fully = lastEntry.people_fully_vaccinated;
  const boosters = lastEntry.total_boosters;

  return { atLeastOne, fully, boosters, publishedDate };
}

async function main() {
  const { atLeastOne, fully, boosters, publishedDate } = await getData();

  const lastTweet = await getLastTweet();
  const lastTweetDate = new Date(lastTweet.created_at);

  // if a tweet was published after the last entry, we don't need to tweet again
  if (lastTweetDate > publishedDate) {
    console.log(`No new data available. Stopping.`);
    return;
  }

  // sanity check if data is plausible, throws if not
  isPlausible(atLeastOne, fully, boosters);

  const message =
    "Eén prik (% totale populatie)\n" +
    getProgressStr(atLeastOne, "🟨") +
    "\n\nTwee prikken\n" +
    getProgressStr(fully, "🟩") +
    "\n\nBoosted\n" +
    getProgressStr(boosters, "🟦") +
    "\n\nWaarde van " +
    publishedDate.toLocaleDateString("nl-NL", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " · Bron: RIVM";

  client.post(
    "statuses/update",
    { status: message },
    (error, _tweet, _response) => {
      if (error) return console.error(error);
    }
  );

  console.log(`Success! Tweeted: \n\n${message}`);
}

function getLastTweet() {
  return new Promise((resolve, reject) => {
    client.get(
      "statuses/user_timeline",
      { screen_name: "VacciVoortgang" },
      function (error, tweets, _response) {
        if (error) {
          reject(error);
        }
        resolve(tweets.at(0));
      }
    );
  });
}

function isPlausible(atLeastOne, fully, boosters) {
  if (atLeastOne < 0 || fully < 0 || boosters < 0) {
    throw Error("[Sanity check] Number of people vaccinated is negative");
  }

  if (atLeastOne > POPULATION || fully > POPULATION || boosters > POPULATION) {
    throw Error(
      "[Sanity check] Number of people vaccinated higher than total population"
    );
  }

  if (atLeastOne < fully) {
    throw Error(
      "[Sanity check] Number of people with at least one vaccination is lower than number of people fully vaccinated"
    );
  }

  if (atLeastOne < 12_000_00 || fully < 11_000_00 || boosters < 9_000_00) {
    throw Error(
      "[Sanity check] Number of people vaccinated suddenly lower than expected"
    );
  }

  return true;
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
