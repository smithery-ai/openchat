import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { chatRoute } from "./routes/chat.js";
import { createTokenRoute } from "./routes/create-token.js";
import { toolSearchRoute } from "./routes/tool-search.js";
import { whoamiRoute } from "./routes/whoami.js";
import * as dotenv from "dotenv";

dotenv.config();

const app = new Hono();

app.use(
	"/*",
	cors({
		origin: (origin) => origin,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
		exposeHeaders: ["x-vercel-ai-ui-message-stream", "x-accel-buffering"],
		maxAge: 86400,
	}),
);

app.route("/api", chatRoute);
app.route("/api", toolSearchRoute);
app.route("/api", createTokenRoute);
app.route("/api", whoamiRoute);

const port = Number(process.env.PORT) || 4260;

serve({ fetch: app.fetch, port }, (info) => {
	console.log(`Server is running on http://localhost:${info.port}`);
});
