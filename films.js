const puppeteer = require("puppeteer");
const fs = require("fs");

const baseURL = "https://letterboxd.com/films/popular/page/"; // Base URL to iterate over different pages
const pageStart = 1; // Define the starting page number (inclusive)
const pageEnd = 500; // Define the ending page number (inclusive), adjust as needed

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  let allFilms = []; // Array to store all film data

  try {
    for (let pageNumber = pageStart; pageNumber <= pageEnd; pageNumber++) {
      const currentPageURL = `${baseURL}${pageNumber}/`; // Build the URL for the current page

      // Navigate to the current page
      await page.goto(currentPageURL, { waitUntil: "domcontentloaded", timeout: 60000 }); // Wait until DOM is loaded

      // Wait until all elements with data-film-name are available (expecting 72 items on the page)
      await page.waitForFunction(() => document.querySelectorAll("[data-film-name]").length === 72, { timeout: 50000 });

      // Extract data from each <li class="listitem poster-container">
      const films = await page.evaluate(() => {
        const items = [...document.querySelectorAll("li.listitem.poster-container")];

        return items.map((item) => {
          const filmName = item.querySelector("[data-film-name]") ? item.querySelector("[data-film-name]").getAttribute("data-film-name") : "No name";
          const rating = item.getAttribute("data-average-rating") || "No rating";
          const posterUrl = item.querySelector("img") ? item.querySelector("img").src : "No image";
          const filmLink = item.querySelector("a.frame") ? item.querySelector("a.frame").href : "No link";

          // Extract the slug from the filmLink (e.g., fight-club from https://letterboxd.com/film/fight-club/)
          const slug = filmLink ? filmLink.split("/film/")[1]?.split("/")[0] : "No slug";

          return { filmName, rating, posterUrl, filmLink, slug };
        });
      });

      // Add the films from the current page to the allFilms array
      allFilms = [...allFilms, ...films];

      console.log(`Page ${pageNumber} processed. Collected ${films.length} films.`);
    }

    // Write the collected data to a JSON file
    fs.writeFileSync("films.json", JSON.stringify(allFilms, null, 2));

    console.log(`All pages processed. Data written to films.json.`);
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }
})();
