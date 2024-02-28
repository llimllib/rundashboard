---
toc: false
---

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

// Creating a binned object from datetimes isn't really supported by d3, as far
// as I can tell: https://github.com/d3/d3-array/issues/134
//
// so let's do it manually

// Create an object with keys for each day in the time range
const [start, end] = d3.extent(activities, (d) => new Date(d.Setting));

// range will exclude the end point, so we need to add 1 day to the max date to
// make the range inclusive.
//
// Create an object {<day>: { distanceInMi: 0, day: _date_ }} for every date in
// the range
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
```

<div class="grid grid-cols-1" style="grid-auto-rows: 504px;">
  <div class="card">${
    resize((width) => Plot.plot({
      title: "Miles run over the trailing 365 days",
      width,
      y: {grid: true, label: "miles"},
      marks: [
        Plot.lineY(
          sumsPerDay,
          Plot.windowY(
            {
              anchor: "end",
              k: 365,
              reduce: "sum",
            },
            {
              x: "day",
              // the trimp value is unitless, so let's just scale it to match it
              // roughly to the distance I've run. Empirically chose 12 as an
              // approximately good value
              y: (d) => d.trimp / 12,
              stroke: "green",
              tip: true,
            },
          ),
        ),
      ]
    }))
  }</div>
</div>
