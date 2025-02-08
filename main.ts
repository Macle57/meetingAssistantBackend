import puppeteer from "puppeteer";
import fs from "node:fs";
import { launch, getStream } from "puppeteer-stream";





let screenshotInterval;
const zoomMeetingLink =
  "https://us04web.zoom.us/j/73785383064?pwd=lQtOC5N2fxioVJllfog01p8v4QUCLE.1" +
  "#success";


async function captureFrame(iframe, count) {
  if (!iframe) return;
  await iframe.screenshot({
    path: `screenshots/frame_${count.toString().padStart(4, '0')}.png`,
    type: 'png'
  });
}

function waitforme(millisec) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("");
    }, millisec);
  });
}

if (!fs.existsSync('screenshots')) fs.mkdirSync('screenshots');
if (!fs.existsSync('audio')) fs.mkdirSync('audio');

const file = fs.createWriteStream("audio/" + 0 + ".webm", {
		highWaterMark: 1024
	});

const browser = await launch({
  headless: false,
  args: [
  ],
  executablePath: "C:\\Users\\adity\\.cache\\puppeteer\\chrome\\win64-133.0.6943.53\\chrome-win64\\chrome.exe",
  allowIncognito: true,
  // slowMo: 1000
});
const context = browser.defaultBrowserContext();
const page = await context.newPage();
try {
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
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );

  // Navigate to Zoom meeting
  await page.goto(zoomMeetingLink, { waitUntil: "networkidle2" });

  // 1. Click Launch Meeting button
  console.log("searching");
  const launch = page
    .locator(
      '::-p-text(Launch Meeting)'
    )

    await launch.click();
    await launch.click();


  // 2. Click "Join from your browser" using text selector
  await page.locator("::-p-text(Join from your browser)").click();

  // page.waitForSelector('::-p-text(This meeting link is invalid (3,001))', ).then(()=>{
  //   throw new Error("Invalid meeting link");
  // })

  // Wait for potential reload
  await page.waitForNavigation();


  const frame = await page.waitForSelector("#webclient");
  const iframe = await frame?.contentFrame();

  await iframe?.locator('::-p-text(Continue without audio or video)').click();


// await iframe?.locator('#preview-audio-control-button > div.audio-voip-active-icon').click();
// await iframe?.locator('#preview-video-control-button').click();

console.log("Successfully muted");

  // 3. Fill name input using CSS selector
  await iframe?.locator("#input-for-name").fill("robo-ai");

  console.log("Filled name input");


  // 5. Click Join button with combined selector
  await iframe?
    .locator("button.preview-join-button")
    .filter(button => button.innerText === "Join")
    .click();

  // 6. Wait for loading screen using text selector
  await iframe?.locator("::-p-text(Joining meeting)")
  
  iframe?.waitForSelector("::-p-text(Host has joined.)", {timeout: 10000}).then(()=>{
    console.log("Waitin for approval");
  }).catch(()=>{});


  await waitforme(2000);
  const joinedframe = await page.waitForSelector("#webclient");
  const joinediframe = await joinedframe?.contentFrame();

  // console.log("Successfully joined meeting!");
  let frameCount = 0;


  screenshotInterval = setInterval(async () => {
      try {
        await joinediframe?.locator("#sharee-container > div.sharee-container__viewport.react-draggable > video-player-container > video-player").setTimeout(1000).hover();
        const shareframe = await joinediframe?.waitForSelector("#sharee-container > div.sharee-container__viewport.react-draggable > video-player-container > video-player");
        await captureFrame(shareframe, frameCount);
        frameCount++;
      }
      catch (error) {
        // console.error("not sharing screen currently");
      }
  }, 4000)

  const stream = await getStream(page, { audio: true, video: false });
  stream.pipe(file);
  setTimeout(async () => {
		stream.destroy();
		file.close();
		console.log("finished");
		// await page.close();
	}, 1000 * 50);

  

}
  catch (error) {
    console.error(error);
  }
finally {
}
