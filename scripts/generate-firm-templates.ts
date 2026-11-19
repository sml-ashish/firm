import fs from "node:fs";
import path from "node:path";
import { buildFirmSample, buildFirmTemplate } from "../src/lib/firm/intake";

const outDir = path.join(process.cwd(), "public", "templates");
fs.mkdirSync(outDir, { recursive: true });

const templatePath = path.join(outDir, "FIRM-Fleet-Upload-Template.xlsx");
const samplePath = path.join(outDir, "FIRM-Sample-Fleet.xlsx");

fs.writeFileSync(templatePath, buildFirmTemplate());
fs.writeFileSync(samplePath, buildFirmSample());

console.log(`Wrote ${path.relative(process.cwd(), templatePath)}`);
console.log(`Wrote ${path.relative(process.cwd(), samplePath)}`);
