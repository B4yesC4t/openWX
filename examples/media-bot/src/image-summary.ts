import { imageSize } from "image-size";

export interface ImageSummary {
  readonly width: number;
  readonly height: number;
}

export function describeImage(buffer: Buffer): ImageSummary {
  try {
    const size = imageSize(buffer);
    if (!size.width || !size.height) {
      throw new Error("Unsupported image payload: missing width or height.");
    }

    return {
      width: size.width,
      height: size.height
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Unsupported image payload: missing width or height.") {
      throw error;
    }

    throw new Error("Unsupported image payload: missing width or height.", {
      cause: error
    });
  }
}
