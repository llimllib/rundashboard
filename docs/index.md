---
toc: false
---

```js
import { rollupEveryDay } from "./components/timeline.js";
```

<style>

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--sans-serif);
  margin: 4rem 0 8rem;
  text-wrap: balance;
  text-align: center;
}

.hero h1 {
  margin: 2rem 0;
  max-width: none;
  font-size: 14vw;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(30deg, var(--theme-foreground-focus), currentColor);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero h2 {
  margin: 0;
  max-width: 34em;
  font-size: 20px;
  font-style: initial;
  font-weight: 500;
  line-height: 1.5;
  color: var(--theme-foreground-muted);
}

@media (min-width: 640px) {
  .hero h1 {
    font-size: 90px;
  }
}

</style>

<div class="hero">
  <h1>Run dashboard</h1>
</div>

```js
const METERS_PER_MILE = 1609.344;
const activities = (
  await FileAttachment("components/runalyze/all_activities.json").json()
).filter((x) => x.Sport.includes("Run"));

// convert meters to miles and iso date strings to date objects
activities.forEach((a) => {
  a.Distance = a.Distance / METERS_PER_MILE;
  a.Setting = new Date(a.Setting);
});

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

<div class="grid grid-cols-1" style="grid-auto-rows: 504px;">
  <div class="card">${
    resize((width) => Plot.plot({
      title: "Miles run over the trailing 365 days",
      width,
      y: {grid: true, label: "miles"},
      marks: [
        Plot.lineY(
          activitiesByDay,
          Plot.windowY(
            {
              anchor: "end",
              k: 365,
              reduce: "sum",
            },
            {
              x: ([k, _]) => k,
              y: ([_, v]) => v.get("miles"),
              stroke: "green",
              tip: true,
            },
          ),
        ),
      ]
    }))
  }</div>
</div>

<div class="grid grid-cols-1" style="grid-auto-rows: 504px;">
  <div class="card">${
    resize((width) => Plot.plot({
      title: "Miles run over the trailing 28 days, last two years",
      width,
      y: {grid: true, label: "miles"},
      marks: [
        Plot.lineY(
          new Map([...activitiesByDay].slice(activitiesByDay.size - (365*2))),
          Plot.windowY(
            {
              anchor: "end",
              k: 28,
              reduce: "sum",
            },
            {
              x: ([k, _]) => k,
              y: ([_, v]) => v.get("miles"),
              stroke: "green",
              tip: true,
            },
          ),
        ),
      ]
    }))
  }</div>
</div>

<div class="grid grid-cols-1" style="grid-auto-rows: 504px;">
  <div class="card">${
  Inputs.table(activities, {
    columns: ["Setting", "TRIMP", "Distance", "Duration", "Pace", "Elev.", "Energy", "VO2max"],
    header: {
      Setting: "date",
    },
    reverse: true,
    sort: "Setting",
    maxWidth: width-30,
  })
  }</div>
</div>

<div class="grid grid-cols-1" style="grid-auto-rows: 504px;">
  <div class="card">${
    resize((width, height) => Plot.plot({
      title: "VO2Max, all time",
      width,
      height,
      y: {grid: true, label: "miles"},
      marks: [
        Plot.lineY(
          activitiesByDay, {
          x: ([k, _]) => k,
          y: ([_, v]) => v.get("VO2max"),
          stroke: "green",
          tip: true,
        }),
      ]
    }))
  }</div>
</div>
