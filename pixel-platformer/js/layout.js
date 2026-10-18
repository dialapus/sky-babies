// Canvas viewport geometry only. Gameplay physics keeps its original 256x144 world.
// Choose integer physical-pixel steps when that does not shrink the useful view.
export function computeViewport(cssWidth, cssHeight, dpr = 1, { touch = false } = {}) {
  const cssW = Math.max(1, Math.round(Number(cssWidth) || 256));
  const cssH = Math.max(1, Math.round(Number(cssHeight) || 144));
  const pixelRatio = Number.isFinite(Number(dpr)) && Number(dpr) > 0
    ? Math.min(8, Number(dpr)) : 1;
  const portrait = cssH > cssW;

  let scale;
  if (touch) {
    // Portrait: enough horizontal room for movement, while the viewport
    // extends beneath the 144px playable world into decorative underterrain.
    // Landscape: expose roughly 400 logical pixels without shortening the
    // playable 144px world. A fractional fallback avoids side letterboxing.
    const targetWidth = portrait ? 192 : 400;
    const ideal = cssW / targetWidth;
    const largestAllowed = Math.max(0.1, Math.min(cssW / (portrait ? 192 : 256), cssH / 144));
    const physicalStep = Math.floor(ideal * pixelRatio) / pixelRatio;
    scale = physicalStep > 0 && physicalStep >= ideal * 0.90
      ? physicalStep : ideal;
    scale = Math.min(scale, largestAllowed);
    if (!portrait && cssW / scale > 400) {
      // More important than an exact integer physical scale on a short phone:
      // a near-400-wide full-bleed landscape image with no blank margins.
      scale = Math.min(cssW / 400, largestAllowed);
    }
  } else {
    // At 1280x720 the full desktop view is the classic 256x144 at 5x;
    // the desktop shell normally provides a smaller 16:9 stage.
    const ideal = Math.min(cssW / 256, cssH / 144);
    const integral = Math.floor(ideal * pixelRatio) / pixelRatio;
    scale = integral >= 1 ? integral : Math.max(ideal, 0.1);
  }
  scale = Math.max(scale, 0.01);
  return {
    width: Math.max(1, Math.ceil(cssW / scale - 1e-8)),
    height: Math.max(1, Math.ceil(cssH / scale - 1e-8)),
    scale,
    cssWidth: cssW,
    cssHeight: cssH
  };
}

// CSS dimensions fill the stage exactly; backing dimensions are logical pixels.
// Re-sizing the backing bitmap resets the 2D context state in all browsers.
export function applyViewport(canvas, view) {
  if (!canvas || !view) return null;
  if (canvas.width !== view.width) canvas.width = view.width;
  if (canvas.height !== view.height) canvas.height = view.height;
  if (canvas.style) {
    canvas.style.width = view.cssWidth + 'px';
    canvas.style.height = view.cssHeight + 'px';
  }
  const ctx = canvas.getContext?.('2d') ?? null;
  if (ctx) ctx.imageSmoothingEnabled = false;
  return ctx;
}
