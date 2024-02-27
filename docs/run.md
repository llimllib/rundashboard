# Run dashboard experiment

```js
import * as Plot from "npm:@observablehq/plot";
// import * as d3 from "npm:d3";
```

```js echo
const METERS_PER_MILE = 1609.344;
const activities = (
  await FileAttachment("components/runalyze/all_activities.json").json()
).filter((x) => x.Sport.includes("Run"));

// convert meters to miles and iso date strings to date objects
activities.forEach((a) => {
  a.Distance = a.Distance / METERS_PER_MILE;
  a.Setting = new Date(a.Setting);
});

display(Inputs.table(activities));
```

OK, let's try to use d3 to create an object with each day:

```js echo
// Creating a binned object from datetimes isn't really supported by d3, as far
// as I can tell: https://github.com/d3/d3-array/issues/134
//
// so let's do it manually

// Create an object with keys for each day in the time range
const [start, end] = d3.extent(activities, (d) => new Date(d.Setting));

// range will exclude the end point, so we need to add 1 day to the max date to
// make the range inclusive.
//
// Create an object { distanceInMi: 0, day: _date_ } for every date in the range
const dates = d3.timeDay
  .range(start, end.setDate(end.getDate() + 1))
  .reduce((a, c) => ((a[c] = { distanceInMi: 0, day: c, trimp: 0 }), a), {});

// Now we can go through each activity, match it to the day, and add its
// distance to the object
activities.forEach((a) => {
  const o = dates[d3.timeDay.floor(a.Setting)];
  o.distanceInMi += a.Distance;
  o.day = d3.timeDay.floor(a.Setting);
  o.trimp += a.TRIMP;
});

const sumsPerDay = Object.values(dates);

display(
  Inputs.table(Object.values(dates), {
    columns: ["day", "distanceInMi", "trimp"],
  }),
);
```

### TODO

- add a label to the end of each line; can't quite use [the same tactic as here](https://observablehq.com/@observablehq/plot-index-chart?intent=fork) because we need a different y value for each line
- figure out how to get a tooltip properly placed and with the proper text
  - how do we apply a transformation to the data used for `tip`?

Now we can make a graph of my running career, with an adjustable window:

```js echo
const k = view(Inputs.range([7, 365], { step: 1, value: 365 }));
```

```js echo
display(
  Plot.plot({
    color: { legend: true },
    y: { grid: true },
    marks: [
      Plot.lineY(
        sumsPerDay,
        Plot.windowY(
          {
            anchor: "end",
            k: k,
            reduce: "sum",
          },
          // I have no idea from the documentation what options are supposed to
          // go in this second object, and the graph still works if we put these
          // in the first object, which is bizarre
          {
            x: "day",
            // the trimp value is unitless, so let's just scale it to match it
            // roughly to the distance I've run. Empirically chose 12 as an
            // approximately good value
            y: (d) => d.trimp / 12,
            stroke: "green",
          },
        ),
      ),
      Plot.lineY(
        sumsPerDay,
        Plot.windowY({
          anchor: "end",
          k: k,
          reduce: "sum",
          x: "day",
          y: "distanceInMi",
          stroke: "grey",
        }),
      ),
      Plot.tip(
        sumsPerDay,
        Plot.windowY(
          {
            anchor: "end",
            k: k,
            reduce: "sum",
          },
          Plot.pointer({
            title: (d) => `${d.day}\n${d.distanceInMi} mi\n${d.trimp} trimp`,
            x: "day",
            y: (d) => d.distanceInMi,
            // y: (d) => Math.max(d.distanceInMi, d.trimp),
          }),
        ),
      ),
    ],
  }),
);
```
