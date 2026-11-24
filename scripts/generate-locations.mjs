// One-off generator for location pages and illustration images.
//
//   node scripts/generate-locations.mjs            # create missing pages + images
//   node scripts/generate-locations.mjs --force    # regenerate everything (overwrites CMS edits!)
//
// Location pages are written to src/content/locations/<old-url-slug>.md so each
// page keeps the exact URL it had on the previous WordPress site.
// After generation, the Markdown files are the source of truth and are edited in Pages CMS.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright"); // pre-installed globally; or: npm i -D playwright

const FORCE = process.argv.includes("--force");
const IMAGES = process.argv.includes("--images"); // with --force, also re-render existing images
const root = new URL("../", import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Locations: [town, county, region, oldSlug?]
// oldSlug only where the previous site's URL differs from a plain slug of the town name.
// ---------------------------------------------------------------------------
const L = (town, county, region, slug) => ({ town, county, region, slug });
const locations = [
  // Berkshire
  ...["Ascot", "Bracknell", "Maidenhead", "Newbury", "Reading", "Sandhurst", "Slough", "Windsor", "Wokingham"].map((t) => L(t, "Berkshire", "Berkshire")),
  // Buckinghamshire
  L("Aylesbury", "Buckinghamshire", "Buckinghamshire"),
  L("Beaconsfield", "Buckinghamshire", "Buckinghamshire"),
  L("Gerrards Cross", "Buckinghamshire", "Buckinghamshire", "gerrardscross"),
  L("High Wycombe", "Buckinghamshire", "Buckinghamshire", "highwycombe"),
  L("Marlow", "Buckinghamshire", "Buckinghamshire"),
  L("Wendover", "Buckinghamshire", "Buckinghamshire"),
  // Dorset
  ...["Bournemouth", "Christchurch", "Dorchester", "Poole"].map((t) => L(t, "Dorset", "Dorset")),
  // Hampshire
  ...["Aldershot", "Andover", "Basingstoke", "Bordon", "Eastleigh", "Fareham", "Farnborough", "Fleet", "Gosport", "Havant",
    "Hedge End", "Portsmouth", "Ringwood", "Romsey", "Southampton", "Totton", "Waterlooville", "Winchester"].map((t) => L(t, "Hampshire", "Hampshire")),
  // Hertfordshire
  L("Rickmansworth", "Hertfordshire", "Hertfordshire"),
  L("Watford", "Hertfordshire", "Hertfordshire"),
  // London
  L("London", "London", "London"),
  ...["Barking", "Barnet", "Bexley", "Brent", "Bromley", "Camden", "Chelsea", "Coulsdon", "Croydon", "Ealing"].map((t) => L(t, "Greater London", "London")),
  L("Earls Court", "Greater London", "London", "earlscourt"),
  ...["Enfield", "Feltham", "Fulham", "Greenwich", "Hackney", "Hammersmith", "Haringey", "Harlington", "Harrow", "Havering", "Hayes",
    "Hillingdon", "Hounslow", "Islington", "Kensington", "Kingston upon Thames", "Lambeth", "Lewisham", "Merton", "Mitcham", "New Malden",
    "Newham", "Northwood", "Paddington", "Pinner", "Redbridge", "Richmond", "Ruislip", "Southwark", "Sutton", "Surbiton", "Teddington"].map((t) => L(t, "Greater London", "London")),
  L("Tower Hamlets", "Greater London", "London", "towerhamlets"),
  ...["Twickenham", "Uxbridge", "Wandsworth", "Westminster", "Wimbledon"].map((t) => L(t, "Greater London", "London")),
  // Oxfordshire
  L("Abingdon", "Oxfordshire", "Oxfordshire"),
  L("Henley-on-Thames", "Oxfordshire", "Oxfordshire", "henley"),
  L("Oxford", "Oxfordshire", "Oxfordshire"),
  // South West England
  L("Bath", "Somerset", "South West England"),
  L("Bristol", "Bristol", "South West England"),
  L("Cheltenham", "Gloucestershire", "South West England"),
  L("Chippenham", "Wiltshire", "South West England"),
  L("Cirencester", "Gloucestershire", "South West England"),
  L("Frome", "Somerset", "South West England"),
  L("Gloucester", "Gloucestershire", "South West England"),
  L("Portishead", "Somerset", "South West England"),
  L("Salisbury", "Wiltshire", "South West England"),
  L("Swindon", "Wiltshire", "South West England"),
  L("Trowbridge", "Wiltshire", "South West England"),
  L("Weston-super-Mare", "Somerset", "South West England"),
  // South Wales
  L("Cardiff", "Cardiff", "South Wales"),
  // Surrey
  L("Surrey", "Surrey", "Surrey"),
  ...["Bagshot", "Camberley", "Chertsey", "Chessington", "Cobham", "Dorking", "Epsom", "Esher", "Farnham", "Godalming", "Guildford",
    "Hindhead", "Leatherhead", "Oxshott", "Redhill", "Reigate", "Shepperton", "Staines", "Sunbury"].map((t) => L(t, "Surrey", "Surrey")),
  L("Virginia Water", "Surrey", "Surrey", "virginiawater"),
  L("Walton-on-Thames", "Surrey", "Surrey"),
  L("West Molesey", "Surrey", "Surrey", "westmoseley"), // old URL was misspelt – kept so rankings carry over
  L("Weybridge", "Surrey", "Surrey"),
  L("Woking", "Surrey", "Surrey"),
  // Sussex
  ...["Arundel", "Bognor Regis", "Chichester", "Crawley", "Horsham", "Worthing"].map((t) => L(t, "West Sussex", "Sussex")),
  ...["Brighton", "Eastbourne", "Hove"].map((t) => L(t, "East Sussex", "Sussex")),
  // North West
  L("Manchester", "Greater Manchester", "North West"),
];

const slugify = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (arr, s, salt = "") => arr[hash(s + salt) % arr.length];
const place = (l) => (l.town === l.county || l.county === "Greater London" && l.town === "London" ? l.town : `${l.town}, ${l.county}`);

// What the properties in each region are typically like – keeps copy specific without inventing facts.
const regionBlurb = {
  "Berkshire": "cleaning everything from family homes in commuter towns to offices along the M4 corridor",
  "Buckinghamshire": "cleaning everything from Chiltern cottages to busy town-centre offices",
  "Dorset": "cleaning everything from coastal homes and holiday lets to shops and offices",
  "Hampshire": "cleaning everything from city flats to family homes in market towns",
  "Hertfordshire": "cleaning everything from commuter homes to local shops and offices",
  "London": "cleaning everything from flats and period terraces to offices and rental properties",
  "Oxfordshire": "cleaning everything from period properties to family homes and student lets",
  "South West England": "cleaning everything from period townhouses to modern family homes and offices",
  "South Wales": "cleaning everything from city apartments to family homes and offices",
  "Surrey": "cleaning everything from family homes and period properties to offices",
  "Sussex": "cleaning everything from seaside flats and holiday lets to family homes and offices",
  "North West": "cleaning everything from city-centre apartments to family homes and offices",
};
const windowView = {
  "Dorset": "sea", "Sussex": "sea", "Hampshire": "sea", "South Wales": "city",
  "London": "city", "North West": "city", "South West England": "hills",
};
const viewWords = { sea: "the sea", city: "a city skyline", hills: "green hills" };

// ---------------------------------------------------------------------------
// Page copy
// ---------------------------------------------------------------------------
function locationMarkdown(l) {
  const T = l.town, P = place(l), B = regionBlurb[l.region];
  const intro = pick([
    `Your home should feel clean, fresh and comfortable. In ${T}, we help you get there with deep carpet, rug and upholstery cleaning that fits around your day, your family and your budget.`,
    `You work hard to keep your ${T} home looking its best. We take on the hard part, lifting out the dirt, stains and allergens that everyday life leaves behind.`,
    `Whether you own your home, let a property or run a business in ${P}, you want carpets that look good, smell fresh and last longer. That's exactly what our cleaning gives you.`,
    `You deserve carpets that are clean, soft and safe for everyone who walks on them. Across ${P}, we make that simple, with clear prices, flexible booking and fast drying times.`,
  ], T);
  const second = pick([
    `You choose the day and the time, seven days a week from 8am to 8pm. You get a clear, fixed quote before we start. And you get your rooms back within hours, not days.`,
    `Booking fits around you: early mornings, evenings and weekends are all available. Your quote is free, fixed and has no hidden extras. Your carpets are usually dry in 2 to 4 hours.`,
    `We arrive when it suits you, protect your home while we work, and leave your rooms the way you like them. All you have to do is enjoy the difference.`,
  ], T, "b");
  const why = pick([`Why ${T} customers choose us`, `What you can expect in ${T}`, `Your clean, your way`], T, "c");
  return `## Cleaner carpets for your ${T} home or business

${intro}

${B.replace(/^cleaning everything from /, "From ")}, we look after every kind of property in ${T}. ${second}

## How we help you in ${T}

- **[Carpet cleaning](/services/carpet-cleaning/)**: brighter colours, softer fibres and fewer allergens in your home or office.
- **[Upholstery cleaning](/services/upholstery-cleaning/)**: a fresher sofa, armchair or headboard for you to relax on.
- **[Rug cleaning](/services/rug-cleaning/)**: gentle care that protects the colours, fibres and value of your rugs.
- **[Stain and odour removal](/services/stain-odour-removal/)**: help with wine, coffee and pet accidents, so your home smells fresh again.
- **[End of tenancy carpet cleaning](/services/end-of-tenancy-carpet-cleaning/)**: helping tenants protect their deposit and landlords re-let faster in ${T}.
- **[Commercial carpet cleaning](/services/commercial-carpet-cleaning/)**: cleaner offices, shops and venues that impress your staff, customers and visitors.

## What happens on the day

1. **You tell us what you need:** the rooms, the furniture and any stains that worry you.
2. **We prepare and protect:** we check your carpet type, protect your skirting boards and pre-treat problem areas.
3. **We deep clean:** hot water extraction lifts out the dirt, bacteria and allergens that vacuuming leaves behind.
4. **You enjoy the result:** fresh, soft carpets that are usually dry within 2 to 4 hours.

## ${why}

- Booking that suits you, 7 days a week from 8am to 8pm
- A free, fixed quote with no surprises on the day
- Cleaning solutions that are safe for your children, your pets and your carpets
`;
}

function faqs(l) {
  const T = l.town;
  return [
    { question: `How much will my carpet cleaning in ${T} cost?`, answer: `Your price depends on the number of rooms, their size and the condition of your carpets. Call us or send an enquiry and you'll get a free, fixed quote with no hidden extras.` },
    { question: `Can I book a clean in ${T} at the weekend or in the evening?`, answer: `Yes. You can book any day of the week between 8am and 8pm, so your clean fits around your work, your family and your plans.` },
    { question: `How soon can I use my rooms again?`, answer: `Most carpets are dry within 2 to 4 hours, depending on your carpet type, ventilation and the weather. You can usually walk on them sooner in clean socks.` },
    { question: `Is the cleaning safe for my children and pets?`, answer: `Yes. We use cleaning solutions that are safe for your children, your pets and all common carpet and fabric types.` },
  ];
}

const yaml = (v) => JSON.stringify(v); // JSON strings are valid YAML

function frontMatter(obj) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const item of v) {
        const entries = Object.entries(item);
        entries.forEach(([ik, iv], i) => lines.push(`${i === 0 ? "  - " : "    "}${ik}: ${yaml(iv)}`));
      }
    } else lines.push(`${k}: ${yaml(v)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Illustrations (rendered with Playwright, saved as optimised JPEG source images)
// ---------------------------------------------------------------------------
const walls = ["#e8eef0", "#f3ece2", "#e6efe9", "#efe8f1", "#f1efe6"];
const sofas = [["#5b7c99", "blue"], ["#8a5a44", "brown"], ["#4f6d5a", "green"], ["#7a6a9a", "purple"], ["#3f5873", "navy"], ["#b07d56", "tan"]];
const carpets = [["#cbb89d", "beige"], ["#b4b7b1", "grey"], ["#c9ae9c", "oatmeal"], ["#a9b7a6", "sage green"], ["#bdb3c8", "lilac"]];

function sceneSvg({ scene, seed, view = "hills" }) {
  const wall = pick(walls, seed, "w");
  const [sofa] = pick(sofas, seed, "s");
  const [carpet] = pick(carpets, seed, "c");
  const sky = view === "sea" ? "#bfe3f2" : "#cfe8f5";
  const viewArt = {
    sea: `<rect x="790" y="190" width="180" height="70" fill="#3f8fb8"/><path d="M790 205 q15 -6 30 0 t30 0 t30 0 t30 0 t30 0 t30 0" stroke="#e8f6fb" stroke-width="3" fill="none"/><circle cx="930" cy="130" r="22" fill="#ffd66b"/>`,
    city: `<g fill="#7d93a3"><rect x="800" y="170" width="30" height="90"/><rect x="835" y="140" width="40" height="120"/><rect x="880" y="185" width="26" height="75"/><rect x="910" y="150" width="34" height="110"/><rect x="948" y="195" width="22" height="65"/></g><g fill="#cfe8f5">${Array.from({ length: 10 }, (_, i) => `<rect x="${843 + (i % 3) * 10}" y="${150 + Math.floor(i / 3) * 22}" width="5" height="8"/>`).join("")}</g>`,
    hills: `<path d="M790 230 Q850 170 910 220 T970 205 V260 H790Z" fill="#7fb77e"/><path d="M790 245 Q860 205 930 245 T970 240 V260 H790Z" fill="#5e9e63"/><circle cx="820" cy="120" r="20" fill="#ffd66b"/>`,
  }[view];

  const sofaArt = `<g><rect x="90" y="250" width="380" height="120" rx="22" fill="${sofa}"/><rect x="70" y="300" width="60" height="120" rx="18" fill="${sofa}"/><rect x="430" y="300" width="60" height="120" rx="18" fill="${sofa}"/><rect x="120" y="330" width="320" height="70" rx="14" fill="${sofa}" style="filter:brightness(1.12)"/><rect x="140" y="275" width="90" height="70" rx="14" fill="#fff" opacity=".25"/><rect x="330" y="275" width="90" height="70" rx="14" fill="#fff" opacity=".25"/><rect x="95" y="418" width="14" height="22" fill="#5a4636"/><rect x="451" y="418" width="14" height="22" fill="#5a4636"/></g>`;
  const plant = `<g><rect x="540" y="350" width="50" height="60" rx="6" fill="#c56d4a"/><path d="M565 350 C540 300 520 290 525 260 C550 280 560 310 565 350 C570 300 585 270 610 255 C610 290 590 320 565 350" fill="#4f8a57"/></g>`;
  const rug = `<g><ellipse cx="540" cy="535" rx="330" ry="70" fill="#8c4b5a"/><ellipse cx="540" cy="535" rx="300" ry="56" fill="none" stroke="#e8c27a" stroke-width="6" stroke-dasharray="14 10"/><ellipse cx="540" cy="535" rx="200" ry="34" fill="#a85f6f"/></g>`;
  const boxes = `<g><rect x="110" y="320" width="150" height="110" fill="#c89b62"/><rect x="110" y="320" width="150" height="16" fill="#b0854f"/><rect x="170" y="320" width="30" height="110" fill="#e3c58f" opacity=".6"/><rect x="280" y="355" width="120" height="75" fill="#d1a66d"/><rect x="280" y="355" width="120" height="12" fill="#b0854f"/><rect x="140" y="240" width="110" height="80" fill="#d1a66d"/><rect x="140" y="240" width="110" height="12" fill="#b0854f"/></g>`;
  const office = `<g><rect x="80" y="300" width="380" height="18" fill="#6b5442"/><rect x="95" y="318" width="14" height="112" fill="#6b5442"/><rect x="430" y="318" width="14" height="112" fill="#6b5442"/><rect x="200" y="200" width="150" height="95" rx="6" fill="#2f3d47"/><rect x="210" y="210" width="130" height="75" fill="#8fc1d8"/><rect x="265" y="295" width="20" height="8" fill="#2f3d47"/><rect x="480" y="330" width="80" height="20" rx="6" fill="#33454f"/><rect x="490" y="250" width="60" height="85" rx="10" fill="#33454f"/><rect x="515" y="350" width="10" height="60" fill="#33454f"/><rect x="490" y="408" width="60" height="8" fill="#33454f"/></g>`;
  const stain = `<g><ellipse cx="380" cy="520" rx="70" ry="26" fill="#7b1e34" opacity=".75"/><ellipse cx="420" cy="530" rx="30" ry="12" fill="#7b1e34" opacity=".6"/></g>`;

  // machine + hose + wand; wand head position varies for upholstery
  const head = scene === "upholstery" ? { x: 330, y: 355 } : { x: 640, y: 560 };
  const machine = `<g>
    <path d="M1010 470 C 940 520, 860 380, ${head.x + 120} ${head.y - 150}" stroke="#263238" stroke-width="10" fill="none"/>
    <line x1="${head.x + 120}" y1="${head.y - 150}" x2="${head.x + 30}" y2="${head.y}" stroke="#90a4ae" stroke-width="10" stroke-linecap="round"/>
    <rect x="${head.x - 25}" y="${head.y - 8}" width="110" height="22" rx="6" fill="#455a64"/>
    <rect x="950" y="360" width="130" height="160" rx="18" fill="#0b6e6e"/>
    <rect x="965" y="380" width="100" height="40" rx="8" fill="#0d8a8a"/>
    <rect x="1000" y="320" width="14" height="45" fill="#263238"/><rect x="985" y="312" width="80" height="14" rx="7" fill="#263238"/>
    <circle cx="975" cy="528" r="18" fill="#263238"/><circle cx="1055" cy="528" r="18" fill="#263238"/>
    <circle cx="975" cy="528" r="7" fill="#90a4ae"/><circle cx="1055" cy="528" r="7" fill="#90a4ae"/>
  </g>`;
  const cleanStripe = scene === "upholstery" ? "" : `<path d="M${head.x - 30} 630 L${head.x - 20} ${head.y + 10} L1200 ${head.y - 40} L1200 630 Z" fill="#fff" opacity=".22"/>`;
  const sparkle = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -18 L5 -5 L18 0 L5 5 L0 18 L-5 5 L-18 0 L-5 -5Z" fill="#fff"/>`;
  const sparkles = scene === "upholstery"
    ? sparkle(240, 320, 1.1) + sparkle(420, 300, .8) + sparkle(300, 400, .7)
    : sparkle(820, 560, 1.2) + sparkle(1000, 600, .9) + sparkle(720, 600, .7) + sparkle(1120, 560, .8);

  const furniture = { living: sofaArt + plant, upholstery: sofaArt + plant, rug: sofaArt + rug, tenancy: boxes, office, stain: sofaArt + stain }[scene];

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
    <defs><pattern id="pile" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#000" opacity=".07"/><circle cx="6" cy="6" r="1.2" fill="#fff" opacity=".1"/></pattern></defs>
    <rect width="1200" height="430" fill="${wall}"/>
    <rect x="770" y="60" width="220" height="220" rx="6" fill="#fff"/><rect x="785" y="75" width="190" height="190" fill="${sky}"/>${viewArt}
    <rect x="785" y="75" width="190" height="190" fill="none" stroke="#fff" stroke-width="0"/><line x1="880" y1="75" x2="880" y2="265" stroke="#fff" stroke-width="8"/><line x1="785" y1="170" x2="975" y2="170" stroke="#fff" stroke-width="8"/>
    <rect y="415" width="1200" height="18" fill="#fff"/>
    <rect y="433" width="1200" height="197" fill="${carpet}"/><rect y="433" width="1200" height="197" fill="url(#pile)"/>
    ${scene === "rug" ? "" : cleanStripe}
    ${furniture}
    ${scene === "rug" ? cleanStripe : ""}
    ${machine}
    ${sparkles}
  </svg>`;
}

function describeScene({ scene, seed, view = "hills" }) {
  const [, sofaName] = pick(sofas, seed, "s");
  const [, carpetName] = pick(carpets, seed, "c");
  return {
    living: `a hot water extraction carpet cleaning machine cleaning a ${carpetName} living room carpet beside a ${sofaName} sofa, with a window looking out over ${viewWords[view]}`,
    upholstery: `an upholstery cleaning wand cleaning the seat of a ${sofaName} fabric sofa in a living room`,
    rug: `a carpet cleaning machine cleaning a red patterned wool rug in front of a ${sofaName} sofa`,
    tenancy: `a carpet cleaning machine cleaning the ${carpetName} carpet of an empty room with moving boxes stacked against the wall`,
    office: `a commercial carpet cleaning machine cleaning a ${carpetName} office carpet beside a desk, computer monitor and office chair`,
    stain: `a carpet cleaning machine about to remove a red wine stain from a ${carpetName} carpet beside a ${sofaName} sofa`,
  }[scene];
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const pageHtml = (svg, kicker, heading, sub) => `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;width:1200px;height:630px;position:relative;font-family:"Inter","DejaVu Sans",Arial,sans-serif}
  .b{position:absolute;left:32px;top:28px;max-width:600px;background:rgba(8,79,79,.94);color:#fff;padding:20px 26px;border-radius:18px;box-shadow:0 8px 30px rgba(0,0,0,.18)}
  .k{font-size:19px;letter-spacing:.04em;color:#f2b134;font-weight:700;text-transform:uppercase;margin-bottom:8px}
  .h{font-size:44px;font-weight:800;line-height:1.08}
  .s{font-size:24px;margin-top:6px;color:#d6eeee}
</style></head><body>${svg}<div class="b"><div class="k">${esc(kicker)}</div><div class="h">${esc(heading)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ""}</div></body></html>`;

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
const jobs = [];

for (const l of locations) {
  const slug = `carpet-cleaning-${l.slug || slugify(l.town)}`;
  const mdPath = `${root}src/content/locations/${slug}.md`;
  const label = place(l);
  const view = windowView[l.region] || "hills";
  const imageFile = `carpet-cleaning-${slugify(l.town)}${l.town === l.county || l.town === "London" ? "" : "-" + slugify(l.county)}.jpg`;
  const imageAlt = `Illustration of ${describeScene({ scene: "living", seed: l.town, view })}, captioned "Carpet Cleaning in ${label}" by Carpet Cleaning Professionals`;
  const metaTitle = [`Carpet Cleaning ${l.town} | Carpet & Upholstery Cleaners`, `Carpet Cleaning ${l.town} | Free Quotes`, `Carpet Cleaning ${l.town}`].find((t) => t.length <= 60);
  const description = `Professional carpet, rug & upholstery cleaning in ${label}. Fast drying, pet-safe & open 7 days, 8am–8pm. Call 0808 196 8603 for a free quote.`;

  // Hand-written (featured) pages are never overwritten
  const handWritten = existsSync(mdPath) && /^featured: true/m.test(readFileSync(mdPath, "utf8"));
  if (!handWritten && (FORCE || !existsSync(mdPath))) {
    writeFileSync(mdPath, frontMatter({
      title: `Carpet Cleaning in ${l.town}`,
      town: l.town,
      county: l.county,
      region: l.region,
      metaTitle,
      description,
      intro: `Professional carpet, rug and upholstery cleaning in ${label}. Open 7 days a week, 8am to 8pm.`,
      image: `/images/locations/${imageFile}`,
      imageAlt,
      faqs: faqs(l),
    }) + locationMarkdown(l));
  }
  jobs.push({ out: `${root}src/images/locations/${imageFile}`, scene: "living", seed: l.town, view, kicker: "Carpet Cleaning Professionals", heading: `Carpet Cleaning in ${l.town}`, sub: l.town === l.county || l.town === "London" ? "Carpet, rug & upholstery cleaning" : l.county });
}

// Service + blog images: [mdPath, imagePath, scene, heading, altLead]
const extra = [
  ["services/carpet-cleaning.md", "services/professional-carpet-cleaning-hot-water-extraction.jpg", "living", "Carpet Cleaning"],
  ["services/upholstery-cleaning.md", "services/professional-sofa-upholstery-cleaning.jpg", "upholstery", "Upholstery Cleaning"],
  ["services/rug-cleaning.md", "services/professional-wool-rug-cleaning.jpg", "rug", "Rug Cleaning"],
  ["services/stain-odour-removal.md", "services/carpet-stain-and-odour-removal.jpg", "stain", "Stain & Odour Removal"],
  ["services/end-of-tenancy-carpet-cleaning.md", "services/end-of-tenancy-carpet-cleaning-empty-room.jpg", "tenancy", "End of Tenancy Carpet Cleaning"],
  ["services/commercial-carpet-cleaning.md", "services/commercial-office-carpet-cleaning.jpg", "office", "Commercial Carpet Cleaning"],
  ["posts/2026-10-06-how-often-should-you-clean-your-carpets.md", "blog/how-often-to-professionally-clean-carpets.jpg", "living", "How often should carpets be cleaned?"],
  ["posts/2026-11-03-how-to-deal-with-common-carpet-stains.md", "blog/how-to-remove-common-carpet-stains.jpg", "stain", "How to deal with carpet stains"],
];
for (const [md, img, scene, heading] of extra) {
  const seed = img;
  const alt = `Illustration of ${describeScene({ scene, seed })}, captioned "${heading}" by Carpet Cleaning Professionals`;
  const mdPath = `${root}src/content/${md}`;
  let text = readFileSync(mdPath, "utf8");
  if (!/^image:/m.test(text) || (FORCE && /^image: "?\/images\/(services|blog)\//m.test(text))) {
    text = text.replace(/^image:.*\n|^imageAlt:.*\n/gm, "");
    text = text.replace(/\n---\n/, `\nimage: ${yaml("/images/" + img)}\nimageAlt: ${yaml(alt)}\n---\n`);
    writeFileSync(mdPath, text);
  }
  jobs.push({ out: `${root}src/images/${img}`, scene, seed, view: "hills", kicker: "Carpet Cleaning Professionals", heading, sub: "" });
}

// Render missing images
const todo = jobs.filter((j) => (FORCE && IMAGES) || !existsSync(j.out));
if (todo.length) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  for (const j of todo) {
    mkdirSync(j.out.replace(/\/[^/]+$/, ""), { recursive: true });
    await page.setContent(pageHtml(sceneSvg(j), j.kicker, j.heading, j.sub));
    await page.screenshot({ path: j.out, type: "jpeg", quality: 82 });
  }
  await browser.close();
}
console.log(`${locations.length} locations, ${todo.length} images rendered`);
