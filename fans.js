const puppeteer = require("puppeteer");
const fs = require("fs");

// Load films data from the JSON file
const filmsData = JSON.parse(fs.readFileSync("films.json", "utf8"));
const totalPages = 50;
const outputFilePath = "film_fans.json";

// Specify the start and stop films
const startFilm = "Once Upon a Time... in Hollywood"; // Replace with the film name to start
const stopFilm = "Zodiac"; // Replace with the film name to stop

// Define the number of films to process before restarting the browser
const filmsPerSession = 10;

function loadExistingFansData(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  } catch (error) {
    console.error("Error reading existing fans data:", error.message);
  }
  return {};
}

async function scrapeFilm(film, page, allFans) {
  const filmName = film.filmName;
  const filmLink = film.filmLink;
  const filmSlug = film.slug;
  const filmFans = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    const fanPageURL = `${filmLink}reviews/rated/5/by/activity/page/${pageNumber}/`;

    try {
      await page.goto(fanPageURL, { waitUntil: "domcontentloaded", timeout: 60000 });

      const selector = "li.film-detail";
      const hasContent = await page.$(selector);

      if (!hasContent) {
        console.log(`No more fans found for film: ${filmName}, Page: ${pageNumber}`);
        break; // Stop if no fans are found
      }

      const fans = await page.evaluate((slug) => {
        const fanElements = [...document.querySelectorAll("li.film-detail")];
        return fanElements
          .map((fan) => {
            const usernameElement = fan.querySelector("a.avatar");
            const username = usernameElement ? usernameElement.getAttribute("href").substring(1) : null;
            return username ? { username, filmSlug: slug } : null;
          })
          .filter((fan) => fan !== null); // Remove null entries
      }, filmSlug);

      if (fans.length === 0) break;

      filmFans.push(...fans);

      console.log(`Page ${pageNumber} for ${filmName} collected ${fans.length} fans.`);
    } catch (error) {
      console.error(`Error on page ${pageNumber} for ${filmName}: ${error.message}`);
      break; // Exit loop for this film if there's an error
    }
  }

  if (!allFans[filmName]) allFans[filmName] = [];
  allFans[filmName].push(...filmFans);

  fs.writeFileSync(outputFilePath, JSON.stringify(allFans, null, 2));
  console.log(`Finished processing film: ${filmName}`);
}

(async () => {
  let allFans = loadExistingFansData(outputFilePath);

  let started = false; // Flag to track when to start processing
  let filmCounter = 0; // Counter for films processed in the current session
  let browser = await puppeteer.launch({ headless: true });
  let page = await browser.newPage();

  for (const film of filmsData) {
    const filmName = film.filmName;

    // Start scraping only when the specified startFilm is reached
    if (!started && filmName === startFilm) {
      started = true;
    }

    // Skip films until the starting point is reached
    if (!started) {
      console.log(`Skipping film: ${filmName}`);
      continue;
    }

    // Stop scraping when the stopFilm is reached
    if (filmName === stopFilm) {
      console.log(`Stopping at film: ${filmName}`);
      break;
    }

    console.log(`Processing film: ${filmName}`);

    try {
      await scrapeFilm(film, page, allFans);
    } catch (error) {
      console.error(`Error processing film: ${filmName}: ${error.message}`);
    }

    filmCounter++;

    // Restart the browser after processing a set number of films
    if (filmCounter >= filmsPerSession) {
      console.log("Restarting browser to manage memory...");

      await page.close();
      await browser.close();

      browser = await puppeteer.launch({ headless: true });
      page = await browser.newPage();

      filmCounter = 0; // Reset the film counter
    }
  }

  console.log("All films have been processed. Closing the browser.");
  await page.close();
  await browser.close();
})();
