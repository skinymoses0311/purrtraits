// Browser-side image cropper.
//
// Why we need this: Nano Banana's edit endpoint doesn't expose an aspect
// ratio parameter. The model heavily inherits aspect from its reference
// images, so the most reliable way to get 3:4 portrait outputs is to feed
// it 3:4 portrait inputs. We center-crop the user's upload before sending
// it to Convex storage.

const TARGET_ASPECT = 3 / 4; // width / height for portrait
const MAX_LONG_EDGE = 1536;  // cap input size so uploads + AI calls stay snappy

export async function cropToAspect(file: File): Promise<Blob> {
  const img = await loadImage(file);
  const srcAspect = img.width / img.height;

  // Compute the crop rectangle in source coordinates (centred).
  let sw: number, sh: number, sx: number, sy: number;
  if (srcAspect > TARGET_ASPECT) {
    // Source is too wide — keep full height, narrow the width.
    sh = img.height;
    sw = sh * TARGET_ASPECT;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    // Source is too tall — keep full width, shorten the height.
    sw = img.width;
    sh = sw / TARGET_ASPECT;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  // Output dimensions: cap the long edge (height) so we don't ship huge files
  // while still giving Nano Banana plenty of detail to work with.
  const outH = Math.min(MAX_LONG_EDGE, sh);
  const outW = outH * TARGET_ASPECT;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(outW);
  canvas.height = Math.round(outH);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  // PNG preserves transparency; for everything else JPEG keeps file size sane.
  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
      outputType,
      0.92,
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
}
