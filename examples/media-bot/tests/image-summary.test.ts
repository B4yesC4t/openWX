import { describe, expect, it } from "vitest";

import { exampleAssetPath } from "../src/assets.js";
import { describeImage } from "../src/image-summary.js";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0ioAAAAASUVORK5CYII=",
  "base64"
);

describe("describeImage", () => {
  it("reads width and height from a PNG buffer", () => {
    expect(describeImage(ONE_BY_ONE_PNG)).toEqual({
      width: 1,
      height: 1
    });
  });

  it("throws for unsupported binary data", () => {
    expect(() => describeImage(Buffer.from("not-an-image"))).toThrow(
      "Unsupported image payload: missing width or height."
    );
  });
});

describe("exampleAssetPath", () => {
  it("resolves files inside the example asset directory", () => {
    expect(exampleAssetPath("cat.svg")).toMatch(/examples\/media-bot\/assets\/cat\.svg$/);
  });
});
