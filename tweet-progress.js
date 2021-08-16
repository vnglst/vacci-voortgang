require("dotenv").config();
const Papa = require("papaparse");
const fetch = require("node-fetch");
const Twitter = require("twitter");
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

async function getData() {
  const res = await fetch(
    "https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/vaccinations/country_data/Netherlands.csv"
  );
  const csvStr = await res.text();

  const { data } = Papa.parse(csvStr);
  const lastEntry = data[data.length - 2];

  const atLeastOne = lastEntry[1];
  const fully = lastEntry[5];

  return { atLeastOne, fully };
}

async function main() {
  const { atLeastOne, fully } = await getData();

  if (atLeastOne >= 65 && fully >= 57) {
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
  } else {
    throw Error("Sanity check failed");
  }

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
