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
import * as Regression from "npm:d3-regression";
import Loess from "npm:loess";
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
      ["vo2", d3.sum(values, (d) => d.VO2max)],
    ]),
  (d) => d3.timeDay.floor(d.Setting),
  new Map([
    ["miles", 0],
    ["trimp", 0],
    ["vo2", 0],
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
const days = view(
  Inputs.range([7, activitiesByDay.size], {
    step: 10,
    value: activitiesByDay.size,
  }),
);
```

```js echo
const activitiesByDaySlice =
  days < activitiesByDay.size
    ? new Map([...activitiesByDay].slice(activitiesByDay.size - days))
    : activitiesByDay;
display(
  Plot.plot({
    color: { legend: true, range: ["grey", "green"] },
    y: { grid: true },
    marks: [
      Plot.lineY(
        activitiesByDaySlice,
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
            stroke: (_) => "effort",
            strokeOpacity: 0.25,
          },
        ),
      ),
      Plot.lineY(
        activitiesByDaySlice,
        Plot.windowY(
          {
            anchor: "end",
            k: k,
            reduce: "sum",
          },
          {
            x: ([k, _]) => k,
            y: ([_, v]) => v.get("miles"),
            stroke: (_) => "mileage",
          },
        ),
      ),
      Plot.tip(
        activitiesByDaySlice,
        Plot.pointer(
          Plot.windowY(
            {
              anchor: "end",
              k: k,
              reduce: "sum",
            },
            {
              title: ([k, v]) =>
                `${k}\n${v.get("miles")} mi\n${v.get("trimp")} trimp`,
              x: ([d, _]) => d,
              y: ([_, v]) => v.get("miles"),
            },
          ),
        ),
      ),
    ],
  }),
);
```

```js echo
const loess = ({ x, y, ...options }) => {
  const z = options.z ?? options.fill ?? options.stroke; // TODO maybeZ; strict undefined
  const [X, setX] = Plot.column(x);
  const [Y, setY] = Plot.column(y);
  const [Y1, setY1] = Plot.column(y);
  const [Y2, setY2] = Plot.column(y);
  return {
    ...Plot.transform(options, function(data, facets) {
      const X = setX(Plot.valueof(data, x));
      const Y = setY(Plot.valueof(data, y));
      const Z = Plot.valueof(data, z);
      const Y1 = setY1(new Float64Array(X.length));
      const Y2 = setY2(new Float64Array(X.length));
      for (const facet of facets) {
        for (const I of Z ? d3.group(facet, (i) => Z[i]).values() : [facet]) {
      console.log("wut", Y,            {
              x: Array.from(I.map((i) => X[i])),
              y: Array.from(I.map((i) => Y[i]))
            }, )
          const model = new Loess.default(
            {
              x: Array.from(I.map((i) => X[i])),
              y: Array.from(I.map((i) => Y[i]))
            },
            {
              span: 2,
              band: 0.5,
              degree: 2
            }
          ).predict();
          for (const [j, i] of I.entries()) {
            Y[i] = model.fitted[j];
            Y1[i] = model.fitted[j] - model.halfwidth[j];
            Y2[i] = model.fitted[j] + model.halfwidth[j];
          }
        }
      }
      return { data, facets };
    }),
    x: X,
    y: Y,
    y1: Y1,
    y2: Y2
  };
}
let vo2 = activities.filter((x) => x.VO2max && x.VO2max > 0).slice(750);
display(JSON.stringify(vo2))
display(
  Plot.plot({
    title: "VO2Max, all time",
    width,
    y: { grid: true, label: "V02max" },
    marks: [
      Plot.dot(
        vo2,
        {
          x: "Setting",
          y: "VO2max",
          stroke: "green",
          tip: true,
        },
      ),
      Plot.line(
        vo2,
        loess({
          x: "Setting",
          y: "VO2max",
        }),
        // modified from: https://observablehq.com/@fil/plot-regression
        // transform: (data, facets) => {
        //   const regressor = Regression.regressionLoess();
        //   regressor.bandwidth(0.5);
        //   const X = Plot.valueof(data, "Setting");
        //   const Y = Plot.valueof(data, "VO2max");
        //   regressor.x((i) => X[i]).y((i) => Y[i]);
        //   console.log("loess", { data, X, Y });

        //   const regFacets = [];
        //   const points = [];
        //   for (const facet of facets) {
        //     const regFacet = [];
        //     for (const I of [facet]) {
        //       console.log(facet, regressor(I));
        //       const reg = regressor(I);
        //       for (const d of reg) {
        //         const j = points.push(d) - 1;
        //         regFacet.push(j);
        //       }
        //     }
        //     regFacets.push(regFacet);
        //   }
        //   console.log("return", { data: points, facets: regFacets });
        //   return { data: points, facets: regFacets };
        // },
      ),
    ],
  }),
);
// display(
//   Plot.plot({
//     title: "VO2Max, all time",
//     width,
//     y: { grid: true, label: "V02max" },
//     marks: [
//       Plot.dot(
//         activities.filter((x) => x.VO2max && x.VO2max > 0),
//         {
//           x: "Setting",
//           y: "VO2max",
//           stroke: "green",
//           tip: true,
//         },
//       ),
//       Plot.line(
//         activities.filter((x) => x.VO2max && x.VO2max > 0),
//         // modified from: https://observablehq.com/@fil/plot-regression
//         loess({
//           x: "Setting",
//           y: "VO2max",
//           stroke: "green",
//           tip: true,
//           type: "loess",
//         }),
//       ),
//     ],
//   }),
// );
// display(activities.filter((x) => x.VO2max && x.VO2max > 0));
// function regress({ x, y, ...options }) {
//   return {
//     ...Plot.transform(options, (data, facets, options) => {
//       const X = Plot.valueof(data, x);
//       const Y = Plot.valueof(data, y);
//       const regressor = Regression.regressionLoess().bandwidth(0.5).x(x).y(y);
//       console.log(regressor(data))
//       console.log("args", data, facets, options);
//       const zip = d3.zip(X, Y);
//       console.log("wtf is plot.column", Plot.column(x))
//       console.log("returning", { data, facets }, zip);
//       return { data, facets };
//     }),
//     x: x,
//     y: y,
//     ...options,
//   };
// }
```
