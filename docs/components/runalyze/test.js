import fs from "node:fs";
import { parseActivities } from "./parseActivities.js";

console.log(parseActivities(fs.readFileSync("example.html"))[0]);
