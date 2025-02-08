import fs from "node:fs";
import { launch, getStream } from "puppeteer-stream";

let screenshotInterval;

const LINK = "https://us04web.zoom.us/j/72940511606?pwd=qwmaeCk8LOirv0ZJbMLkPuCAU9AjNP.1";
const zoomMeetingLink = LINK + "#success";

// Utility function to wait for a given time (in milliseconds)
function waitforme(millisec) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("");
    }, millisec);
  });
}

// Capture the screenshot of the provided iframe element
async function captureFrame(iframe, count) {
  if (!iframe) return;
  await iframe.screenshot({
    path: `screenshots/frame_${count.toString().padStart(4, "0")}.png`,
    type: "png",
  });
}

// Ensure required directories exist
function prepareDirectories() {
  if (!fs.existsSync("screenshots")) fs.mkdirSync("screenshots");
  if (!fs.existsSync("audio")) fs.mkdirSync("audio");
}

// Create a write stream for audio recording
function createAudioFile() {
  return fs.createWriteStream("audio/" + 0 + ".webm", {
    highWaterMark: 1024,
  });
}

// Launch browser instance with desired settings
async function setupBrowser() {
  const browser = await launch({
    headless: "new",
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
async function overridePermissions(context, page) {
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
async function joinZoomMeeting(page, meetingLink) {
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
  const iframe = await frame?.contentFrame();

  await iframe?.locator("::-p-text(Continue without audio or video)").click();

  // await iframe?.locator('#preview-audio-control-button > div.audio-voip-active-icon').click();
  // await iframe?.locator('#preview-video-control-button').click();

  console.log("Successfully muted");

  // 3. Fill name input using CSS selector
  await iframe?.locator("#input-for-name").fill("robo-ai");

  console.log("Filled name input");

  // 5. Click Join button with combined selector
  await iframe
    ?.locator("button.preview-join-button")
    .filter((button) => button.innerText === "Join")
    .click();

  // 6. Wait for loading screen using text selector
  await iframe?.locator("::-p-text(Joining meeting)");

  iframe
    ?.waitForSelector("::-p-text(Host has joined.)", { timeout: 10000 })
    .then(() => {
      console.log("Waitin for approval");
    })
    .catch(() => {});

  await waitforme(2000);
  const joinedFrame = await page.waitForSelector("#webclient");
  const joinedIframe = await joinedFrame?.contentFrame();
  return joinedIframe;
}

// Start the screenshot capture interval
function startScreenshotCapture(joinedIframe) {
  joinedIframe?.locator(
    "#notificationManager > div:nth-child(3) > div > div > i"
  ).setTimeout(20000).click().then(()=>{
    console.log("closed mic pop-up");
  })
  .catch(()=>{
    console.log("mic pop-up missed");
  });
  let frameCount = 0;
  screenshotInterval = setInterval(async () => {
    try {
      await joinedIframe
        ?.locator(
          "#sharee-container > div.sharee-container__viewport.react-draggable > video-player-container > video-player"
        )
        .setTimeout(1000)
        .hover();
      const shareFrame = await joinedIframe?.waitForSelector(
        "#sharee-container > div.sharee-container__viewport.react-draggable > video-player-container > video-player"
      );
      await captureFrame(shareFrame, frameCount);
      frameCount++;
    } catch (error) {
      // console.error("not sharing screen currently");
    }
  }, 4000);
}

// Start audio recording from the page using puppeteer-stream
async function startAudioRecording(page, file) {
  const stream = await getStream(page, { audio: true, video: false });
  stream.pipe(file);
  return (async () => {
    stream.destroy();
    file.close();
    console.log("audio recording done");
  })
}

// Main function to coordinate the entire process
(async () => {
  try {
    prepareDirectories();
    const file = createAudioFile();
    const { browser, context, page } = await setupBrowser();

    await overridePermissions(context, page);

    const joinedIframe = await joinZoomMeeting(page, zoomMeetingLink);

    startScreenshotCapture(joinedIframe);
    const audiocleanup = await startAudioRecording(page, file);

    //Cleanup logic
    await joinedIframe?.locator("::-p-text(This meeting has been ended by host)").setTimeout(0).hover();
    await audiocleanup();
    clearInterval(screenshotInterval);
    try{
      page.close();
      browser.close();
    }
    catch(e){
      // console.log("error closing browser");
    }

  } catch (error) {
    console.error(error);
  } finally {
    // Cleanup can be performed here if needed.
  }
})();
