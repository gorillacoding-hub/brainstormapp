/** Longest side kept for an imported picture. Keeps boards small enough for local storage. */
const MAX_SIDE = 900;

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be opened as a picture."));
    };
    image.src = url;
  });
}

/**
 * Read a picture file and return it as a data URL.
 * The picture keeps its exact proportions (never cropped or stretched); it is only
 * scaled down when larger than MAX_SIDE. Transparency is kept.
 */
export async function readPicture(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a picture file.");
  const image = await load(file);
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  if (!w || !h) throw new Error("That picture has no size.");
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.88);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
}
