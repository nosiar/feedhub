import "dotenv/config";
import { google } from "googleapis";
import { createServer } from "node:http";

const oauth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "http://localhost:3000/api/auth/gmail/callback"
);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
  ],
});

console.log("\n1. Open this URL in your browser:\n");
console.log(authUrl);
console.log("\nWaiting for callback on http://localhost:3000 ...\n");
console.log("(Stop feedhub server first if running on port 3000)\n");

const server = createServer(async (req, res) => {
  const url = new URL(req.url!, "http://localhost:3000");
  if (url.pathname === "/api/auth/gmail/callback") {
    const code = url.searchParams.get("code");
    if (!code) { res.writeHead(400); res.end("Missing code"); return; }
    try {
      const { tokens } = await oauth2.getToken(code);
      console.log("\n=== SUCCESS ===\n");
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log("\nAdd this to your .env file.\n");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h2>Success!</h2><p>Refresh token received. You can close this tab.</p>");
    } catch (err) {
      console.error("Token exchange failed:", err);
      res.writeHead(500); res.end("Failed");
    }
    setTimeout(() => server.close(), 1000);
  }
});

server.listen(3000);
