import { Hono } from "hono";

export const whoamiRoute = new Hono();

whoamiRoute.get("/whoami", (c) => {
	const apiKey = process.env.SMITHERY_API_KEY;

	if (!apiKey) {
		return c.json({ error: "SMITHERY_API_KEY not configured" }, 500);
	}

	return c.json({
		SMITHERY_API_KEY: apiKey,
	});
});
