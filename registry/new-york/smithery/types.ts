import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export type SuccessfulToolSearch = {
	connectionStatus: "connected";
	connectionLatency: number;
	toolsTokenCount: number;
};
export type FailedToolSearch = {
	connectionStatus: "failed";
	connectionLatency: number;
	error: string;
};

export type ToolSearchResult = {
	action: string;
	searchResults: {
		connectionId: string;
		tool: Tool;
	}[];
	latency: number;
	totalTools: number;
	tokensProcessed: number;
	connectionStats: Record<string, SuccessfulToolSearch | FailedToolSearch>;
};
