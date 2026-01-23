"use client";

import { type UseChatHelpers, useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { createContext, type ReactNode, useContext } from "react";

const ChatContext = createContext<ReturnType<typeof useChat> | undefined>(
	undefined,
);

export const useChatContext = () => {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error("useChatContext must be used within a ChatProvider");
	}
	return context;
};

interface ChatProviderProps {
	children: ReactNode;
}

export const ChatProvider = ({ children }: ChatProviderProps) => {
	const chatHelpers = useChat();

	return (
		<ChatContext.Provider value={chatHelpers}>{children}</ChatContext.Provider>
	);
};
