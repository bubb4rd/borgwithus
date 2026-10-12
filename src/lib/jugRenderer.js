import berryGrape from "../assets/jug/berry-grape.webp";
import blackCherry from "../assets/jug/black-cherry.webp";
import clear from "../assets/jug/clear.webp";
import fruitPunch from "../assets/jug/fruit-punch.webp";
import greenThunder from "../assets/jug/green-thunder.webp";
import lemonLime from "../assets/jug/lemon-lime.webp";
import lemonade from "../assets/jug/lemonade.webp";
import strawberryWatermelon from "../assets/jug/strawberry-watermelon.webp";

// Draws the jug configurator's scene: a photo of the jug filled with the MiO flavour (or clear water
// and vodka before one is picked), with the borg's name Sharpied on its front.
// One renderer for the on-page preview and the saved image, so both always match.

export const SCENE = { width: 1080, height: 1350 };

// One photo per flavour in src/data.json (`mio`), all shot from the same spot, so swapping one for
// another only changes the liquid. "clear" is the jug before any MiO.
const PHOTOS = {
  clear,
  Lemonade: lemonade,
  "Fruit Punch": fruitPunch,
  "Strawberry Watermelon": strawberryWatermelon,
  "Berry Grape": berryGrape,
  "Black Cherry": blackCherry,
  "Green Thunder": greenThunder,
  "Lemon Lime": lemonLime,
};
export const CLEAR = "clear";

const MARKER_FONT = '"Permanent Marker", "Comic Sans MS", cursive';
const DISPLAY_FONT = 'Anton, Impact, "Arial Narrow Bold", sans-serif';
const MONO_FONT = '"Space Mono", ui-monospace, Menlo, Consolas, monospace';
const PAPER = "#f3eee2";
const INK = "#0f0e12";

// MiO goes in at the neck, in scene pixels.
const POUR_ORIGIN = { x: 540, y: 160 };
// The front of the jug the name is written on, in scene pixels: centre, writable box, and a
// slight hand-written slant.
const FACE = { x: 540, y: 860, width: 470, height: 380, angle: (-3 * Math.PI) / 180 };

const photoPromises = new Map();
let fontsPromise = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Couldn't load ${src}`));
    image.src = src;
  });
}

// The photo for a flavour name (or CLEAR); unknown names fall back to the clear jug. Cached, and
// stored on `assets.photos` once in so drawScene can use it straight away.
export function loadFlavourPhoto(assets, key) {
  const name = key in PHOTOS ? key : CLEAR;
  if (!photoPromises.has(name)) {
    photoPromises.set(
      name,
      loadImage(PHOTOS[name]).catch((error) => {
        photoPromises.delete(name);
        throw error;
      })
    );
  }
  return photoPromises.get(name).then((image) => {
    assets.photos.set(name, image);
    return image;
  });
}

// Fonts and the clear jug: enough for the first paint. Every flavour photo then loads in the
// background so a MIO roll can pour without waiting.
export async function loadJugAssets() {
  if (!fontsPromise && document.fonts) {
    fontsPromise = Promise.all([
      document.fonts.load(`64px ${MARKER_FONT}`),
      document.fonts.load(`44px ${DISPLAY_FONT}`),
      document.fonts.load(`700 24px ${MONO_FONT}`),
    ]).catch(() => null);
  }
  const assets = { photos: new Map(), pour: document.createElement("canvas") };
  await Promise.all([loadFlavourPhoto(assets, CLEAR), fontsPromise]);
  Object.keys(PHOTOS).forEach((key) => loadFlavourPhoto(assets, key).catch(() => null));
  return assets;
}

function photo(assets, key) {
  return assets.photos.get(key) ?? assets.photos.get(CLEAR);
}

// The new photo blooming out from the neck over the old one as `pour` goes 0 → 1.
function paintPour(ctx, assets, from, to, pour) {
  const { width, height } = SCENE;
  ctx.drawImage(photo(assets, pour >= 1 ? to : from), 0, 0, width, height);
  if (pour <= 0 || pour >= 1 || from === to) return;

  const layer = assets.pour;
  layer.width = width;
  layer.height = height;
  const lctx = layer.getContext("2d");
  lctx.drawImage(photo(assets, to), 0, 0, width, height);
  const reach = 1500 * pour;
  const bloom = lctx.createRadialGradient(POUR_ORIGIN.x, POUR_ORIGIN.y, 0, POUR_ORIGIN.x, POUR_ORIGIN.y, reach);
  bloom.addColorStop(0, "rgba(0,0,0,1)");
  bloom.addColorStop(0.72, "rgba(0,0,0,0.85)");
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  lctx.globalCompositeOperation = "destination-in";
  lctx.fillStyle = bloom;
  lctx.fillRect(0, 0, width, height);
  lctx.globalCompositeOperation = "source-over";
  ctx.drawImage(layer, 0, 0);
}

// Splits the name into lines that fit the face, at the largest marker size that fits. Lines break
// at spaces and after hyphens ("Abdul-" / "Jaborg").
export function fitName(ctx, name) {
  // Each piece knows whether it continues the previous one (the part after a hyphen) or follows
  // a space.
  const pieces = name
    .trim()
    .split(/\s+/)
    .flatMap((word) =>
      word
        .replace(/(.)-(?=.)/g, "$1-\u0000")
        .split("\u0000")
        .map((text, i) => ({ text, joined: i > 0 }))
    );
  for (let size = 124; size >= 30; size -= 2) {
    ctx.font = `${size}px ${MARKER_FONT}`;
    const lines = [];
    let line = "";
    let fits = true;
    for (const { text, joined } of pieces) {
      const next = line ? `${line}${joined ? "" : " "}${text}` : text;
      if (ctx.measureText(next).width <= FACE.width) {
        line = next;
      } else if (!line) {
        // A single piece wider than the face: try a smaller size.
        fits = false;
        break;
      } else {
        lines.push(line);
        line = text;
        if (ctx.measureText(text).width > FACE.width) {
          fits = false;
          break;
        }
      }
    }
    if (line) lines.push(line);
    const lineHeight = size * 1.05;
    if (fits && lines.length * lineHeight <= FACE.height) return { size, lines, lineHeight };
  }
  // Still too long at the smallest size: let the last line run wide rather than drop letters.
  ctx.font = `30px ${MARKER_FONT}`;
  return { size: 30, lines: [name], lineHeight: 32 };
}

// Writes the name across the face; `write` 0 → 1 reveals it left to right, line by line, like a
// marker stroke.
function writeName(ctx, name, write) {
  if (!name || write <= 0) return;
  ctx.save();
  ctx.translate(FACE.x, FACE.y);
  ctx.rotate(FACE.angle);

  const { size, lines, lineHeight } = fitName(ctx, name);
  ctx.font = `${size}px ${MARKER_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.12;
  // A faint sheen under the ink keeps it readable on the darker flavours.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.fillStyle = "rgba(16, 14, 20, 0.94)";

  const widths = lines.map((line) => ctx.measureText(line).width);
  const total = widths.reduce((sum, width) => sum + width, 0);
  let budget = total * Math.min(1, write);
  const top = -((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    if (budget <= 0) return;
    const width = widths[i];
    const shown = Math.min(width, budget);
    budget -= width;
    const y = top + i * lineHeight;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-width / 2 - size, y - lineHeight, shown + size, lineHeight * 2);
    ctx.clip();
    ctx.strokeText(line, 0, y);
    ctx.fillText(line, 0, y);
    ctx.restore();
  });
  ctx.restore();
}

/**
 * Paints the whole scene on `ctx`, already scaled to SCENE units.
 * frame: { from, to (flavour names or CLEAR), pour (0–1), name, write (0–1), flavour (label or
 *   null), marks (draw the saved image's corner marks) }
 */
export function drawScene(ctx, assets, frame) {
  const { width, height } = SCENE;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  paintPour(ctx, assets, frame.from ?? CLEAR, frame.to ?? CLEAR, frame.pour);
  writeName(ctx, frame.name, frame.write);
  if (!frame.marks) {
    ctx.restore();
    return;
  }

  // Corner marks, so a saved image says where it came from. The bottom ones sit on a dark fade
  // over the table so they read on the wood.
  const fade = ctx.createLinearGradient(0, height - 190, 0, height);
  fade.addColorStop(0, "rgba(15, 14, 18, 0)");
  fade.addColorStop(1, "rgba(15, 14, 18, 0.72)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, height - 190, width, 190);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `48px ${DISPLAY_FONT}`;
  ctx.fillText("BORGWITHUS.XYZ", 56, 96);
  ctx.fillStyle = PAPER;
  ctx.font = `700 22px ${MONO_FONT}`;
  if (frame.flavour) ctx.fillText(`MIO ${frame.flavour.toUpperCase()}`, 56, 1302);
  ctx.textAlign = "right";
  ctx.fillText("PLEASE DRINK RESPONSIBLY", width - 56, 1302);
  ctx.restore();
}

// The finished scene at full size, as a JPEG blob (it's a photo; a PNG would be several times
// the size to share).
export async function renderJugImage(assets, frame) {
  const key = frame.flavour ?? CLEAR;
  await loadFlavourPhoto(assets, key);
  const canvas = document.createElement("canvas");
  canvas.width = SCENE.width;
  canvas.height = SCENE.height;
  drawScene(canvas.getContext("2d"), assets, { ...frame, from: key, to: key, pour: 1, write: 1, marks: true });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image."))),
      "image/jpeg",
      0.9
    )
  );
}
