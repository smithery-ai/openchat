"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ChatProvider } from "@/contexts/chat-context";

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000, // 1 minute
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<ChatProvider>{children}</ChatProvider>
		</QueryClientProvider>
	);
}
