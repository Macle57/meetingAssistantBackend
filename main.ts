import fs from "node:fs";
import { launch, getStream } from "puppeteer-stream";
import "jsr:@std/dotenv/load";
import { PassThrough } from "node:stream";
import { Buffer } from "node:buffer";
import { ElementHandle, Frame, Page, BrowserContext } from "puppeteer-core";
import PocketBase from "pocketbase";

const pb = new PocketBase("https://meets.pockethost.io");
const email = Deno.env.get("DB_EMAIL");
const password = Deno.env.get("DB_PASS");

if (!email || !password) {
  throw new Error("Missing environment variables: DB_EMAIL and/or DB_PASS");
}

pb.collection("users")
  .authWithPassword(email, password);



const keyHandlers: Record<string, () => void> = {
  p: () => console.log("P pressed"),
  q: () => Deno.exit(),
  "\u0003": () => Deno.exit(), // Ctrl+C
};

Deno.stdin.setRaw(true);

const decoder = new TextDecoder();
const reader = Deno.stdin.readable.getReader();

function interuptHandler(reader: ReadableStreamDefaultReader<Uint8Array>) {
  reader.read().then((chunk) => {
    const char = decoder.decode(chunk.value)[0];
    keyHandlers[char]();
    interuptHandler(reader);
  });
}
interuptHandler(reader);


// Utility function to wait for a given time (in milliseconds)
function waitforme(millisec: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("");
    }, millisec);
  });
}

// Capture the screenshot of the provided iframe element
async function captureFrame(iframe: ElementHandle, count: number) {
  if (!iframe) return;
  await iframe.screenshot({
    path: `screenshots/frame_${count.toString().padStart(4, "0")}.png`,
    type: "png",
  });
}

// Ensure required directories exist
function prepareDirectories() {
  if (!fs.existsSync("screenshots")) fs.mkdirSync("screenshots");
}


// Launch browser instance with desired settings
async function setupBrowser() {
  const browser = await launch({
    // headless: "new",
    args: [],
    executablePath:
      "C:\\Users\\adity\\.cache\\puppeteer\\chrome\\win64-133.0.6943.53\\chrome-win64\\chrome.exe",
    allowIncognito: true,
    // slowMo: 1000
  });
  const context = browser.defaultBrowserContext();
  const page = await context.newPage();
  return { browser, context, page };
}

// Set the required permissions and user agent for the page
async function overridePermissions(context: BrowserContext, page: Page) {
  await context.overridePermissions("https://app.zoom.us", [
    "background-sync",
    "clipboard-read",
    "clipboard-sanitized-write",
    "clipboard-write",
    "geolocation",
    "idle-detection",
    "midi-sysex",
    "midi",
    "notifications",
    "persistent-storage",
  ]);
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/91.0.4472.124 Safari/537.36"
  );
}

// Navigate to and join the Zoom meeting, returning the joined iframe context
async function joinZoomMeeting(page: Page, meetingLink: string) {
  await page.goto(meetingLink, { waitUntil: "networkidle2" });
  console.log("searching");

  // 1. Click Launch Meeting button
  const launchBtn = page.locator("::-p-text(Launch Meeting)");
  await launchBtn.click();
  await launchBtn.click();

  // 2. Click "Join from your browser" using text selector
  await page.locator("::-p-text(Join from your browser)").click();

  // page.waitForSelector('::-p-text(This meeting link is invalid (3,001))', ).then(()=>{
  //   throw new Error("Invalid meeting link");
  // })

  // Wait for potential reload
  await page.waitForNavigation();

  const frame = await page.waitForSelector("#webclient");
  if (!frame) throw new Error("Failed to find frame");

  const iframe = await frame.contentFrame();

  await iframe.locator("::-p-text(Continue without audio or video)").click();

  // await iframe.locator('#preview-audio-control-button > div.audio-voip-active-icon').click();
  // await iframe.locator('#preview-video-control-button').click();

  console.log("Successfully muted");

  // 3. Fill name input using CSS selector
  await iframe.locator("#input-for-name").fill("robo-ai");

  console.log("Filled name input");

  // 5. Click Join button with combined selector
  await iframe
    .locator("button.preview-join-button")
    .filter((button) => button.innerText === "Join")
    .click();

  // 6. Wait for loading screen using text selector
  await iframe.locator("::-p-text(Joining meeting)");

  iframe
    .waitForSelector("::-p-text(Host has joined.)", { timeout: 10000 })
    .then(() => {
      console.log("Waitin for approval");
    })
    .catch(() => {});

  await waitforme(2000);
  const joinedFrame = await page.waitForSelector("#webclient");
  if (!joinedFrame) throw new Error("Failed to find frame");

  const joinedIframe = await joinedFrame.contentFrame();
  return {joinedIframe, joinedFrame};
}

async function leaveMeeting(joinedIframe: Frame, joinedFrame: ElementHandle) {
  joinedFrame.hover();
  await joinedIframe.locator(
    "#foot-bar > div.footer__leave-btn-container > button"
  ).click();
  await waitforme(100);
  joinedIframe.locator(
    "#wc-footer > div.footer__inner.leave-option-container > div:nth-child(2) > div > div > button"
  ).click().then(()=>{
    console.log("Successfully left meeting");
  })
  .catch(()=>{
    console.log("Failed to leave meeting");
  });

  await waitforme(1600);

  joinedFrame.hover();
  await joinedIframe
    .locator("#foot-bar > div.footer__leave-btn-container > button")
    .click();
  await waitforme(100);
  joinedIframe
    .locator(
      "#wc-footer > div.footer__inner.leave-option-container > div:nth-child(2) > div > div > button"
    )
    .click()
    .then(() => {
      console.log("Successfully left meeting");
    })
    .catch(() => {
      console.log("Failed to leave meeting");
    });
  
}

// Start the screenshot capture interval
function startScreenshotCapture(joinedIframe: Frame) {
  joinedIframe.locator(
    "#notificationManager > div:nth-child(3) > div > div > i"
  ).setTimeout(20000).click().then(()=>{
    console.log("closed mic pop-up");
  })
  .catch(()=>{
    console.log("mic pop-up missed");
  });
  let frameCount = 0;
  const screenshotInterval = setInterval(async () => {
    try {
      await joinedIframe
        .locator(
          "#sharee-container > div.sharee-container__viewport.react-draggable > video-player-container > video-player"
        )
        .setTimeout(1000)
        .hover();
      const shareFrame = await joinedIframe.waitForSelector(
        "#sharee-container > div.sharee-container__viewport.react-draggable > video-player-container > video-player"
      );
      if (!shareFrame) throw new Error("Failed to capture frame");
      await captureFrame(shareFrame, frameCount);
      frameCount++;
    } catch (error) {
      // console.error("not sharing screen currently");
    }
  }, 4000);
  return screenshotInterval;
}

// Start audio recording from the page using puppeteer-stream


async function startAudioRecording(page: Page) {
  let audioChunks: any = [];
  const stream = await getStream(page, { audio: true, video: false });
  const passThrough = new PassThrough();

  stream.pipe(passThrough);

  passThrough.on("data", (chunk) => {
    audioChunks.push(chunk);
  });

  return async () => {
    // Clean up streams
    stream.destroy();
    passThrough.destroy();

    // Combine all chunks into a single Buffer
    const audioBuffer = Buffer.concat(audioChunks);
    // console.log("Audio buffer:", audioBuffer);
    // console.log("Audio chunks:", audioChunks);

    try {
      // Send to Cloudflare Whisper API
      console.log("Transcribing audio...");
      const response = await run("@cf/openai/whisper-tiny-en", audioBuffer);

      // Log the full response
      console.log("Full:", response);

      // Log just the transcription
      console.log("Transcription:", response.result.text);

      // Clear the chunks array for next recording
      audioChunks = [];

      console.log("Audio recording and transcription completed");

      // Return the full result object instead of just the text
      return {
        text: response.result.text,
        word_count: response.result.word_count,
        vtt: response.result.vtt,
        words: response.result.words,
      };
    } catch (error) {
      console.error("Error during transcription:", error);
      audioChunks = [];
      throw error;
    }
  };
}


async function run(model: string, input: Buffer | string) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${Deno.env.get(
      "ACCOUNT_KEY"
    )}/ai/run/${model}`,
    {
      headers: { Authorization: `Bearer ${Deno.env.get("BEARER_TOKEN")}` },
      method: "POST",
      body: input,
    }
  );
  const result = await response.json();
  return result;
}

// Main function to coordinate the entire process
const analyze = async (zoomMeetingLink: string, meetid: string) => {
  try {
    zoomMeetingLink += "#success";
    console.log(
      " 🚀 Starting the meeting 🚀 \n with the link: " + zoomMeetingLink
    );


    console.log(" Initializing Storage ");
    const { browser, context, page } = await setupBrowser();

    await overridePermissions(context, page);

    const {joinedIframe, joinedFrame} = await joinZoomMeeting(page, zoomMeetingLink);
    if (!joinedIframe) throw new Error("Failed to join meeting");

    console.log(" 📸 Analyzing frames ");
    const screenshotInterval = startScreenshotCapture(joinedIframe);
    console.log(" 📸 Analyzing audio ");
    const audiocleanup = await startAudioRecording(page);

    //Cleanup logic
    keyHandlers["l"]=()=>{
      leaveMeeting(joinedIframe, joinedFrame);
    };

    const meetEnders = [joinedIframe.locator("::-p-text(This meeting has been ended by host)").setTimeout(0).hover(),
    page.locator("::-p-text(How was your experience?)").setTimeout(0).hover(),
    page.locator("::-p-text(Join Meeting)").setTimeout(0).hover()];
    await Promise.any(meetEnders);

    const { text } = await audiocleanup();
    if (meetid !== "") {
      pb.collection('meets').update(meetid, {
        "url": zoomMeetingLink,
        "dialogue_transcript": text,
      })
    }

    clearInterval(screenshotInterval)

    console.log("Closing browser");
    browser.close();

  } catch (error) {
    console.error(error);
  } finally {
    // Cleanup can be performed here if needed.
  }
};


pb.collection("meets").subscribe(
  "*",
  function (e) {
    if (e.action === "create") {
      analyze(e.record.url, e.record.id);
    }
  }
);

if (Deno.args[0]) {
  const url: string = Deno.args[0];
  analyze(url, "");
}