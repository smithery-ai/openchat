#!/usr/bin/env tsx
/**
 * Environment configuration checker
 *
 * Usage:
 *   pnpm tsx scripts/check-env.ts
 */

import "dotenv/config";

console.log("🔍 Checking environment configuration...\n");

const requiredEnvVars = {
	SMITHERY_API_KEY: process.env.SMITHERY_API_KEY,
};

const optionalEnvVars = {
	NEXT_PUBLIC_SMITHERY_API_URL: process.env.NEXT_PUBLIC_SMITHERY_API_URL,
	NODE_ENV: process.env.NODE_ENV,
};

let hasErrors = false;

console.log("Required Environment Variables:");
console.log("================================");
for (const [key, value] of Object.entries(requiredEnvVars)) {
	if (value) {
		const displayValue =
			key.includes("KEY") || key.includes("SECRET")
				? `${value.substring(0, 10)}...`
				: value;
		console.log(`✅ ${key}: ${displayValue}`);
	} else {
		console.log(`❌ ${key}: NOT SET`);
		hasErrors = true;
	}
}

console.log("\nOptional Environment Variables:");
console.log("================================");
for (const [key, value] of Object.entries(optionalEnvVars)) {
	if (value) {
		console.log(`✅ ${key}: ${value}`);
	} else {
		console.log(`⚠️  ${key}: not set (using default)`);
	}
}

console.log("\nAPI Configuration:");
console.log("==================");
console.log(
	`Base URL: ${process.env.NEXT_PUBLIC_SMITHERY_API_URL || "https://api.smithery.ai (default)"}`,
);

if (hasErrors) {
	console.log("\n❌ Configuration errors found!");
	console.log("Please set the missing environment variables in your .env file");
	process.exit(1);
} else {
	console.log("\n✅ Environment configuration looks good!");
}
