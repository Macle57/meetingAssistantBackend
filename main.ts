import puppeteer from "puppeteer";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

function waitforme(millisec) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, millisec);
    })
}


// Helper function to click an element based on an XPath.
async function clickXPath(page, xpath) {
  await page.waitForFunction(
    (xp) =>
      document.evaluate(
        xp,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue !== null,
    {},
    xpath
  );

  const handle = await page.evaluateHandle(
    (xp) =>
      document.evaluate(
        xp,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue,
    xpath
  );
  const element = handle.asElement();
  if (!element) {
    throw new Error("Element not found for XPath: " + xpath);
  }
  await element.click();
  await handle.dispose();
}

(async () => {
  // Launch Puppeteer in headful mode for media interactions.
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      "--use-fake-ui-for-media-stream",
      "--auto-select-desktop-capture-source=Entire screen",
    ],
  });
  const page = await browser.newPage();

  // Navigate to the Zoom meeting page.
  await page.goto(
    "https://us05web.zoom.us/j/84268438065?pwd=U2WQnpamdcmlguzA0R7ftFW7vCO78a.1" +
      "#success"
  );

  // Create folders for frames and audio clips.
  const framesDir = join(Deno.cwd(), "frames");
  const audioDir = join(Deno.cwd(), "audio");
  try {
    await mkdir(framesDir, { recursive: true });
    await mkdir(audioDir, { recursive: true });
  } catch (err) {
    console.error("Error creating directories:", err);
  }

  // Expose a Deno function to the page for saving audio chunks.
  await page.exposeFunction("saveAudioChunk", async (base64Data, fileName) => {
    const filePath = join(audioDir, fileName);
    const buffer = Buffer.from(base64Data, "base64");
    await writeFile(filePath, buffer);
    console.log("Saved audio chunk:", fileName);
  });

  // Inject audio recording code into the page.
  await page.evaluate(() => {
    async function startAudioRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        let options = { mimeType: "audio/webm" };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = {}; // fallback if not supported
        }
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.ondataavailable = function (event) {
          if (event.data && event.data.size > 0) {
            const reader = new FileReader();
            reader.onloadend = function () {
              // Remove the data URL prefix.
              const base64Data = reader.result.split(",")[1];
              const fileName = `audio-${Date.now()}.webm`;
              window.saveAudioChunk(base64Data, fileName);
            };
            reader.readAsDataURL(event.data);
          }
        };
        // Record audio in 5-second chunks.
        mediaRecorder.start(5000);
        console.log("MediaRecorder started: capturing 5-sec audio clips.");
      } catch (err) {
        console.error("Error starting audio recording:", err);
      }
    }
    startAudioRecording();
  });

  // Click "Launch Meeting" button using its CSS selector.
  const launchMeetingSelector =
    "#zoom-ui-frame > div.bhauZU7H > div > div.ifP196ZE.x2RD4pnS > div";
  try {
    const launchMeetingButton = await page.$(launchMeetingSelector);
    launchMeetingButton.click();
    console.log("Clicked 'Launch Meeting' button");
  } catch (err) {
    console.error("Error clicking 'Launch Meeting' button:", err);
  }

  // Click "Join from Your Browser" link using the provided XPath.
  const joinFromBrowserXPath =
    "#zoom-ui-frame > div.bhauZU7H > div > div.pUmU_FLW > h3:nth-child(2) > span > a";
    
  try {
    await page.$(joinFromBrowserXPath);
    page.click(joinFromBrowserXPath);
    console.log("Clicked 'Join from Your Browser' link");
  } catch (err) {
    console.error("Error clicking 'Join from Your Browser' link:", err);
  }

  // Before entering your name, disable mic and video using the preview control selectors.
  try {
    // Log the HTML content of the page
    setInterval(async () => {
      try {
        // Generate a unique filename with timestamp
        const timestamp = new Date()
          .toISOString()
          .replace(/[:\-]/g, "")
          .replace("T", "_")
          .replace("Z", "");
        const fileName = `debug-${timestamp}.html`;
        const filePath = join(Deno.cwd(), "debug", fileName);

        // Ensure the debug directory exists
        const debugDir = join(Deno.cwd(), "debug");
        await Deno.mkdir(debugDir, { recursive: true });

        // Get the HTML content of the page
        const html = await page.content();

        // Write the HTML content to the file
        await Deno.writeTextFile(filePath, html);
        console.log(`HTML content saved to: ${filePath}`);
      } catch (err) {
        console.error("Error saving HTML content:", err);
      }
    }, 20000);

    console.log("Waiting for canvas to be available");
    const canvas =
      "/html/body/div[2]/div[2]/div/div[1]/div/div[1]/div/video-player/canvas";
    await page.waitForSelector(canvas);
    console.log("Canvas is now available");
    await page.waitForSelector("#preview-audio-control-button");
    await page.click("#preview-audio-control-button");
    console.log("Disabled microphone (preview)");
  } catch (err) {
    console.error("Error disabling microphone:", err);
  }
  try {
    await page.waitForSelector("#preview-video-control-button");
    await page.click("#preview-video-control-button");
    console.log("Disabled video (preview)");
  } catch (err) {
    console.error("Error disabling video:", err);
  }

  // Enter your name ("robo-ai") into the input field.
  const nameInputSelector =
    "body > div:nth-child(2) > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > div:nth-child(2) > div > input";
  try {
    await page.waitForSelector(nameInputSelector);
    await page.type(nameInputSelector, "robo-ai");
    console.log("Entered name: robo-ai");
  } catch (err) {
    console.error("Error entering name:", err);
  }

  // Click the "Join" button.
  const joinButtonSelector =
    "body > div:nth-child(2) > div:nth-child(2) > div > div:nth-child(1) > div:nth-child(2) > button";
  try {
    await page.waitForSelector(joinButtonSelector);
    await page.click(joinButtonSelector);
    console.log("Clicked 'Join' button");
  } catch (err) {
    console.error("Error clicking 'Join' button:", err);
  }

  // Wait for the meeting container to appear before capturing screenshots.
  try {
    await page.waitForSelector("#meeting-container");
    console.log("Meeting container found, starting frame capture");
  } catch (err) {
    console.error("Error waiting for meeting container:", err);
  }

  // Every 4 seconds, take a screenshot of the meeting container.
  const screenshotInterval = setInterval(async () => {
    const fileName = `frame-${Date.now()}.png`;
    const filePath = join(framesDir, fileName);
    try {
      await page.screenshot({
        path: filePath,
        clip: await page.$eval("#meeting-container", (element) => ({
          x: element.getBoundingClientRect().left,
          y: element.getBoundingClientRect().top,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        })),
      });
      console.log("Saved screenshot:", fileName);
    } catch (err) {
      console.error("Error taking screenshot:", err);
    }
  }, 4000);

  // Run for 60 seconds then clean up.
  setTimeout(async () => {
    clearInterval(screenshotInterval);
    await browser.close();
    Deno.exit();
  }, 60000);
})();
