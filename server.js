require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const validUrl = require("valid-url");
const SuperTokens = require("supertokens-node");
const Session = require("supertokens-node/recipe/session");
const ThirdParty = require("supertokens-node/recipe/thirdparty");
const EmailPassword = require("supertokens-node/recipe/emailpassword");
const {
  errorHandler,
  middleware,
} = require("supertokens-node/framework/express");
const Dashboard = require("supertokens-node/recipe/dashboard");

// Initialize SuperTokens
SuperTokens.init({
  framework: "express",
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_CONNECTION_URI,
    apiKey: process.env.SUPERTOKENS_API_KEY,
  },
  appInfo: {
    apiDomain: "https://open-graph-and-auth-for-share-link.vercel.app",
    appName: "sharelink",
    websiteDomain: "http://localhost:3000",
  },
  recipeList: [
    EmailPassword.init(),
    ThirdParty.init({
      signInAndUpFeature: {
        providers: [
          {
            config: {
              thirdPartyId: "google",
              clients: [
                {
                  clientId: process.env.GOOGLE_CLIENT_ID,
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                },
              ],
            },
          },
          {
            config: {
              thirdPartyId: "apple",
              clients: [
                {
                  clientId: process.env.APPLE_CLIENT_ID,
                  additionalConfig: {
                    keyId: process.env.APPLE_KEY_ID,
                    privateKey: process.env.APPLE_PRIVATE_KEY,
                    teamId: process.env.APPLE_TEAM_ID,
                  },
                },
              ],
            },
          },
        ],
      },
    }),
    Session.init(),
    Dashboard.init(),
  ],
});

// Express App Setup
const app = express();

// Enable CORS
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    allowedHeaders: ["content-type", ...SuperTokens.getAllCORSHeaders()],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// SuperTokens middleware
app.use(middleware());

// Middleware to parse JSON request bodies
app.use(express.json());

// Puppeteer launch options
const puppeteerOptions = {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--single-process",
  ],
};

// Scrape route with enhanced error handling
app.get("/scrape", async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const url = req.query.url;

  // Validate the URL
  if (!validUrl.isWebUri(url)) {
    return res.status(400).send({ error: "Invalid URL" });
  }

  let browser;

  try {
    // Launch Puppeteer with timeout
    browser = await puppeteer.launch(puppeteerOptions);
    const page = await browser.newPage();

    // Intercept and block unnecessary requests
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (
        ["image", "stylesheet", "font", "media", "scripts"].includes(
          request.resourceType()
        )
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate to the URL with a strict timeout
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    // Get the page content
    const html = await page.content();
    const $ = cheerio.load(html);

    // Scrape title and icon
    const title =
      $("title").text() || $('meta[property="og:title"]').attr("content");
    const icon =
      $('link[rel="icon"]').attr("href") ||
      $('meta[property="og:image"]').attr("content");

    // Send response
    res.json({ title, icon, url });
  } catch (error) {
    console.error("Scraping error:", error);
  } finally {
    if (browser) await browser.close();
  }
});

// General SuperTokens error handler
app.use(errorHandler());

// Catch-all error handler
app.use((err, res) => {
  console.error("Server error:", err.stack);
  res.status(500).send(`Internal Server Error: ${err.message}`);
});

// Start the server on port 4000
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
