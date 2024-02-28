# Run dashboard experiment

```js
// Keeping this here to show how to import it, but it doesn't work because I
// have the same function defined inline
// import { rollupEveryDay } from "./components/timeline.js";

// import these so I can get autocomplete; full list of imports here:
// https://observablehq.com/framework/javascript/imports#implicit-imports
// also: tsserver doesn't seem happy with the `npm:` prefix, so I've removed it
// here
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

I couldn't figure out how to use d3.rollup in a simple way and get a key for every day, including days where there were no activities, so I ended up writing a `rollupEveryDay` function for that task

```js echo
function rollupEveryDay(data, reduce, dateKey, defaultValue) {
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
```

Now we can get a map of the mileage and TRIMP of every day's activity

```js echo
const activitiesByDay = rollupEveryDay(
  activities,
  (values) =>
    new Map([
      ["miles", d3.sum(values, (d) => d.Distance)],
      ["trimp", d3.sum(values, (d) => d.TRIMP)],
    ]),
  (d) => d3.timeDay.floor(d.Setting),
  new Map([
    ["miles", 0],
    ["trimp", 0],
  ]),
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
        activitiesByDay,
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
            x: ([k, _]) => k,
            // the trimp value is unitless, so let's just scale it to match it
            // roughly to the distance I've run. Empirically chose 12 as an
            // approximately good value
            y: ([_, v]) => v.get("trimp") / 12,
            stroke: "green",
          },
        ),
      ),
      Plot.lineY(
        activitiesByDay,
        Plot.windowY(
          {
            anchor: "end",
            k: k,
            reduce: "sum",
          },
          {
            x: ([k, _]) => k,
            y: ([_, v]) => v.get("miles"),
            stroke: "grey",
          },
        ),
      ),
      Plot.tip(
        activitiesByDay,
        Plot.windowY(
          {
            anchor: "end",
            k: k,
            reduce: "sum",
          },
          Plot.pointer({
            title: ([k, v]) =>
              `${k}\n${v.get("miles")} mi\n${v.get("trimp")} trimp`,
            x: ([d, _]) => d,
            // y: ([_, v]) => v.get("miles"),
            y: ([_, v]) => Math.max(v.get("miles"), v.get("trimp") / 12),
          }),
        ),
      ),
      Plot.text(
        activitiesByDay,
        Plot.selectLast(
          Plot.windowY(
            {
              anchor: "end",
              k: k,
              reduce: "sum",
            },
            {
              x: ([d, _]) => d,
              y: ([_, v]) => v.get("miles"),
              text: (_) => "mileage",
              dx: 12,
            },
          ),
        ),
      ),
      Plot.text(
        activitiesByDay,
        Plot.selectLast(
          Plot.windowY(
            {
              anchor: "end",
              k: k,
              reduce: "sum",
            },
            {
              x: ([d, _]) => d,
              y: ([_, v]) => v.get("trimp") / 12,
              text: (_) => "trimp",
              dx: 12,
            },
          ),
        ),
      ),
    ],
  }),
);
```
