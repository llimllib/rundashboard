import * as d3 from "npm:d3";

// Creating a binned object from datetimes isn't really supported by d3, as far
// as I can tell: https://github.com/d3/d3-array/issues/134
//
// so let's do it manually

/** create an object binned by the day
 *
 * XXX: this isn't the right interface, but we're going to start with functional and we'll get there eventually
 *
 * @params { any } data
 * @params { string } dateField
 * @params { any } accessor
 * @returns { any } */
export function binByDate(data, dateField, accessor) {
  // Create an object with keys for each day in the time range
  const [start, end] = d3.extent(data, (d) => new Date(d[dateField]));

  // range will exclude the end point, so we need to add 1 day to the max date to
  // make the range inclusive.
  //
  // Create an object {<day>: { distanceInMi: 0, day: _date_ }} for every date in
  // the range
  const dates = d3.timeDay
    .range(start, end.setDate(end.getDate() + 1))
    .reduce((a, c) => ((a[c] = {}), a), {});

  data.forEach((d) => accessor(d, dates));

  return dates;
}

export function rollupEveryDay(data, reduce, dateKey, defaultValue) {
  // rollup the data by day; now it has holes where any day's data was missing
  const rollup = d3.rollup(data, reduce, dateKey);

  // for each day from start to end of the timeframe
  const [start, end] = d3.extent(data, dateKey);

  // if the day is not prsent in the rollup, add it
  d3.timeDay.range(start, end.setDate(end.getDate() + 1)).forEach((dt) => {
    const day = d3.timeDay.floor(dt);
    if (!rollup.get(day)) {
      rollup.set(dt, defaultValue);
    }
  });

  // finally, sort it properly; js maps iterate in insertion order so we need to
  // allocate a new one
  return new Map([...rollup].sort((a, b) => a[0] > b[0]));
}
