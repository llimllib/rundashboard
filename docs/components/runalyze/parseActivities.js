#!/usr/bin/env node
import fs from "node:fs";
import { inspect } from "node:util";
import { parse } from "node-html-parser";

const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

// normalize all numbers:
// - floats to floats
// - miles, ft or kms to meters
// - times to seconds
function tryNumeric(n) {
  // we use the fact that parseFloat throws away the end of strings, so
  // "77 %" -> 77
  if (n.match(/^[\d\.]+$/)) return parseFloat(n);
  if (n.match(/^[\d\.]+\s+%$/)) return parseFloat(n) / 100;
  if (n.match(/^[\d\.]+\s+mi$/)) return parseFloat(n) * METERS_PER_MILE;
  if (n.match(/^[\d\.]+\s+km$/)) return parseFloat(n) * 1000;
  if (n.match(/^[\d\.]+\s+ft$/)) return parseFloat(n) * METERS_PER_FOOT;

  // match 34:56 or 2:34:56, and convert to seconds
  const time = n.match(/^(\d+):(\d+)$/);
  if (time) return parseFloat(time[1]) * 60 + parseFloat(time[2]);
  const time2 = n.match(/^(\d+):(\d+):(\d+)$/);
  if (time2)
    return (
      parseFloat(time2[0]) * 3600 +
      parseFloat(time2[1]) * 60 +
      parseFloat(time2[2])
    );

  // otherwise, we didn't find a format we knew, so just leave it as is
  return n;
}

// convert an array of keys and an array of values to an object
function dict(keys, values) {
  return Object.assign(...keys.map((k, i) => ({ [k]: values[i] })));
}

export function parseActivities(body) {
  const root = parse(body);
  const table = root.querySelector("table");

  // parse each header. Use the text if present, otherwise the title attribute,
  // as its value
  const headers = table
    .querySelectorAll("thead td span")
    .map((td) => td.textContent.trim() || td.attrs["title"]);

  // pull all rows out of the table that have an activity in them
  const rows = table
    // there are two <tbody>s, the first is the one wejwant; the second contains
    // summary info
    .querySelector("tbody")
    .querySelectorAll("tr")
    .filter((x) => x.querySelectorAll("td").length > 3);

  // for each row in the table, get its values and normalize their units
  const values = rows.map((x) =>
    x
      .querySelectorAll("td")
      // filter out the submenu td, which doesn't have a corresponding header
      .filter((td) => !td.querySelector("div.inline-menu"))
      .map(
        (td) =>
          // TODO: normalize distances to meters and times to seconds
          tryNumeric(td.textContent.trim()) ||
          td.querySelector("i")?.attrs["class"],
      )
      .slice(1),
  );

  // if there are multiple activities on a single day, the date isn't listed in
  // each row. Grab it from the previous row that had a date
  for (let i = 0; i < values.length; i++) {
    const activity = values[i];
    if (activity.length == headers.length - 1) {
      const lastActivity = values
        .slice(0, i)
        .findLast((val) => val[0].includes("/"));
      if (!lastActivity) {
        console.log(
          activity,
          "unable to find last activity in",
          values.slice(0, i),
        );
      }
      activity.splice(0, 0, lastActivity[0]);
    }
  }

  // validate that each row has the same # of values as the header list
  if (values.filter((v) => v.length != headers.length).length > 0) {
    throw new Error(
      `invalid row found: ${inspect(
        values.filter((v) => v.length != headers.length),
      )}`,
    );
  }

  return values.map((v) => dict(headers, v));
}
