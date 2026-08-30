import { PDFDocument } from "pdf-lib";

const A4 = {
  portrait: [595.28, 841.89] as [number, number],
  landscape: [841.89, 595.28] as [number, number],
};

function fileStem(filename: string) {
  return filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("La photo n’a pas pu être convertie."));
    }, type, quality);
  });
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();

  try {
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new Error("La photo n’a pas pu être lue par le navigateur.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function normalizeDocumentImage(image: HTMLImageElement) {
  const maxDimension = 2600;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Le traitement d’image n’est pas disponible.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);
  const histogram = new Uint32Array(256);

  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance = Math.round(
      pixels.data[index] * 0.299
      + pixels.data[index + 1] * 0.587
      + pixels.data[index + 2] * 0.114,
    );
    histogram[luminance] += 1;
  }

  const sampleCount = width * height;
  const lowLimit = sampleCount * 0.01;
  const highLimit = sampleCount * 0.99;
  let low = 0;
  let high = 255;
  let cumulative = 0;

  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative >= lowLimit) {
      low = value;
      break;
    }
  }

  cumulative = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative >= highLimit) {
      high = value;
      break;
    }
  }

  const range = Math.max(24, high - low);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const luminance =
      pixels.data[index] * 0.299
      + pixels.data[index + 1] * 0.587
      + pixels.data[index + 2] * 0.114;
    const normalized = Math.max(0, Math.min(255, ((luminance - low) / range) * 255));
    pixels.data[index] = normalized;
    pixels.data[index + 1] = normalized;
    pixels.data[index + 2] = normalized;
  }

  context.putImageData(pixels, 0, 0);
  return canvas;
}

export async function photoToCleanPdf(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Ce fichier n’est pas une photo.");
  }

  const image = await loadImage(file);
  const canvas = normalizeDocumentImage(image);
  const jpeg = await canvasToBlob(canvas, "image/jpeg", 0.92);
  const jpegBytes = await jpeg.arrayBuffer();
  const pdf = await PDFDocument.create();
  const embedded = await pdf.embedJpg(jpegBytes);
  const pageSize = canvas.width > canvas.height ? A4.landscape : A4.portrait;
  const page = pdf.addPage(pageSize);
  const margin = 20;
  const availableWidth = pageSize[0] - margin * 2;
  const availableHeight = pageSize[1] - margin * 2;
  const fitScale = Math.min(availableWidth / embedded.width, availableHeight / embedded.height);
  const drawWidth = embedded.width * fitScale;
  const drawHeight = embedded.height * fitScale;

  page.drawImage(embedded, {
    x: (pageSize[0] - drawWidth) / 2,
    y: (pageSize[1] - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });

  const bytes = await pdf.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new File([buffer], `${fileStem(file.name)}-normalise.pdf`, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}
