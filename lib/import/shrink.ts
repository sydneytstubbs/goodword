// Screenshots are shrunk in the browser before upload (PRD F15.1, cost
// control 5): longest side 1568px (as large as the model reads an image),
// JPEG, and under the server's 850KB cap. Image cost scales with size.

const MAX_SIDE = 1568;
const MAX_BYTES = 800_000;
const QUALITIES = [0.82, 0.7, 0.55];

export type Shrunk = { blob: Blob; url: string };

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** A smaller JPEG copy of an image file, or null if the browser can't read it. */
export async function shrinkImage(file: File): Promise<Shrunk | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of QUALITIES) {
    const blob = await canvasBlob(canvas, quality);
    if (blob && (blob.size <= MAX_BYTES || quality === QUALITIES[QUALITIES.length - 1])) {
      return blob.size <= MAX_BYTES ? { blob, url: URL.createObjectURL(blob) } : null;
    }
  }
  return null;
}
