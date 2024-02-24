#!/usr/bin/env node

import fs from "node:fs";

import minimist from "minimist";
import puppeteer from "puppeteer";
import { parseActivities } from "./parseActivities.js";

/**
 * Print usage information
 */
function usage() {
  console.log(`Usage: ./dl.js [<options>] [<url>]

Log in to readme.com, then run a lighthouse test against <url> and output the
report as HTML and JSON to the output directory.

OPTIONS

--headless: do not draw the browser window
--help:     display this text
`);
}

/** return a unix timestamp for a string of format "yyyy-mm-dd"
 * @params { string } dateString
 * @returns { int } */
function dateToUnixTimestamp(dateString) {
  return new Date(dateString).getTime() / 1000;
}

/** return a fetch request for all activities between dates d1 and d2, date
/* strings formatted like "yyyy-mm-dd"
 * @params { string } d1
 * @params { string } d2
 * @returns { Promise<Response> }
 * */
async function fetchActivities(start, end, cookie) {
  console.log(`fetching: ${start} -> ${end}`);
  start = dateToUnixTimestamp(start + " 00:00:00");
  end = dateToUnixTimestamp(end + " 23:59:59");
  const url = `https://runalyze.com/call/call.DataBrowser.display.php?start=${start}&end=${end}`;
  console.log("url:", url);
  return fetch(url, {
    headers: {
      Cookie: cookie,
      accept: "text/html, */*; q=0.01",
      "accept-language": "en-US,en;q=0.9",
      "sec-ch-ua": '"Chromium";v="115", "Not/A)Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest",
    },
    referrer: "https://runalyze.com/dashboard",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Log in to runalyze.com
 *
 * @param {puppeteer.Page} page
 * @param {string} origin
 */
async function login(page, origin) {
  await page.goto(origin);
  await page.waitForSelector("input#username", { visible: true });

  // Fill in and submit login form.
  const emailInput = await page.$("input#username");
  await emailInput.type(process.env.RUNALYZE_USER);
  const passwordInput = await page.$('input[type="password"]');
  await passwordInput.type(process.env.RUNALYZE_PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "load" }),
    page.click('input[type="submit"]'),
  ]);
}

function sleep(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

function exists(f) {
  try {
    fs.statSync(f);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Log in to runalyze.com
 *
 * @param { string } cookie
 */
async function getActivities(cookie) {
  // TODO: check if the 2024 file is fresh and download it if it's >12 hours
  // old or summat like that

  for (let year = 2024; year > 2015; year--) {
    const fname = `./activities-${year}.json`;
    if (!exists(fname)) {
      const body = await (
        await fetchActivities(`${year}-01-01`, `${year}-12-31`, cookie)
      ).text();
      fs.writeFileSync(`./debug-${year}.html`, body);
      const activities = parseActivities(body);
      activities.forEach((o) => {
        const [month, day] = o.Setting.split(/[\s/]/)
          .slice(0, 2)
          .map(parseFloat);
        o.Setting = new Date(year, month - 1, day).toISOString();
      });
      fs.writeFileSync(fname, JSON.stringify(activities));
    }
  }
}

async function main() {
  // Check for presence of required environment variables
  ["RUNALYZE_USER", "RUNALYZE_PASS"].forEach((envVar) => {
    if (!process.env[envVar])
      throw new Error(`${envVar} environment variable must be set`);
  });

  // parse the command line arguments with minimist:
  // https://github.com/minimistjs/minimist#example
  const argv = minimist(process.argv.slice(2));

  // if the help flag is present, just print usage and quit
  if (argv.help) {
    return usage();
  }

  let cookie = "";
  if (!exists("cookie")) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    });

    // TODO: save our cookies from past runs and skip logging in if they're still valid
    await login(page, "https://runalyze.com/login");
    const cookies = await page.cookies();
    cookie = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    await browser.close();

    fs.writeFileSync("cookie", cookie);
  } else {
    cookie = fs.readFileSync("cookie");
  }

  await getActivities(cookie);
}

await main();

// To concatenate all the JSON files into one array:
// jq -n '[inputs.[]]' activities-20*.json > all_activities.json
