import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import validUrl from "valid-url";
import SuperTokens from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import ThirdParty from "supertokens-node/recipe/thirdparty";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import { errorHandler, middleware } from "supertokens-node/framework/express";
import Dashboard from "supertokens-node/recipe/dashboard";
import { ImageResponse } from "@vercel/og";


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

// Scrape route using @vercel/og for Open Graph metadata
app.get("/scrape", async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const url = req.query.url;

  // Validate the URL
  if (!validUrl.isWebUri(url)) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    // Use @vercel/og to get Open Graph data
    const { title, description, image } = await ImageResponse(url);

    // Send the Open Graph metadata as a response
    res.json({ title, description, icon: image, url });
  } catch (error) {
    console.error("Scraping error:", error);
    res.status(500).json({ error: "Scraping failed" });
  }
});

// General SuperTokens error handler
app.use(errorHandler());

// Catch-all error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res.status(500).send(`Internal Server Error: ${err.message}`);
});

// Start the server on port 4000
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
