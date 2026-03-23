import "dotenv/config";

import { createBot } from "@openwx/bot";

import {
  createLoginQrDisplayProvider,
  resolveDefaultLoginQrPath
} from "../multi-app/src/qr-login.js";
import { createAssistantMessageHandler, describeAssistantMode } from "./src/runtime.js";
import { resolveAssistantProfile } from "./src/setup.js";

const token = process.env.OPENWX_TOKEN?.trim();
const qrImagePath = process.env.OPENWX_QR_IMAGE?.trim() || resolveDefaultLoginQrPath();
const profile = await resolveAssistantProfile();

const bot = createBot({
  ...(token ? { token } : {}),
  autoTyping: true,
  qrDisplay: createLoginQrDisplayProvider({
    outputPath: qrImagePath
  }),
  onMessage: createAssistantMessageHandler(profile)
});

bot.on("ready", () => {
  console.log("Assistant example is ready.");
  console.log(describeAssistantMode(profile));
  if (!token) {
    console.log(`First-run login uses QR image: ${qrImagePath}`);
  }
});

await bot.start();
