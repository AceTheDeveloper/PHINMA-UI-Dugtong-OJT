// Generates the app icons in public/icons/ from the Dugtong mark. Run once,
// and again only if the mark or the background colour changes:
//   node scripts/generate-icons.mts
// The PNGs are committed. sharp is not a dependency of the app; Next.js brings
// it in for image optimization, which is all this one-off script needs.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const mark = join(root, "public", "dugtong-mark.png");
const out = join(root, "public", "icons");

// The page background of the light theme (--background in app/globals.css),
// also the manifest's background_color, so the splash screen matches the icon.
const background = "#f4f6fb";

// How much of the icon the mark fills. A maskable icon is cropped to a circle
// by some launchers, so its mark stays inside the central 56% (the safe zone).
const icons = [
  { file: "icon-192.png", size: 192, fill: 0.78 },
  { file: "icon-512.png", size: 512, fill: 0.78 },
  { file: "icon-maskable-512.png", size: 512, fill: 0.56 },
  // iOS rounds the corners itself and paints transparency black, so it is opaque.
  { file: "apple-touch-icon.png", size: 180, fill: 0.74 },
] as const;

// The mark's soft edge is black at partial opacity, which shows as a dark outline
// on a light icon. Make the edge hard first; shrinking the image smooths it again.
const raw = await sharp(mark).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 3; i < raw.data.length; i += 4) raw.data[i] = raw.data[i] >= 200 ? 255 : 0;
const cleanMark = await sharp(raw.data, {
  raw: { width: raw.info.width, height: raw.info.height, channels: 4 },
})
  .png()
  .toBuffer();

await mkdir(out, { recursive: true });
for (const icon of icons) {
  const inner = Math.round(icon.size * icon.fill);
  const resized = await sharp(cleanMark).resize(inner, inner, { fit: "contain" }).toBuffer();
  await sharp({
    create: { width: icon.size, height: icon.size, channels: 3, background },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(join(out, icon.file));
  console.log(`public/icons/${icon.file}`);
}
