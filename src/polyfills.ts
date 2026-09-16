// Polyfills for browser APIs required by pdfjs-dist / pdf-parse in headless Node.js environments (e.g. Vercel Serverless)
if (typeof globalThis !== "undefined") {
  if (!(globalThis as any).DOMMatrix) {
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;
      constructor(_init?: any) {}
      multiplySelf() { return this; }
      preMultiplySelf() { return this; }
      translate() { return this; }
      scale() { return this; }
      rotate() { return this; }
      invertSelf() { return this; }
    };
  }
  if (!(globalThis as any).ImageData) {
    (globalThis as any).ImageData = class ImageData {
      width: number;
      height: number;
      data: Uint8ClampedArray;
      constructor(width = 0, height = 0) {
        this.width = width;
        this.height = height;
        this.data = new Uint8ClampedArray(width * height * 4);
      }
    };
  }
  if (!(globalThis as any).Path2D) {
    (globalThis as any).Path2D = class Path2D {
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    };
  }
}
