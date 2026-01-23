"use client";
import type { ServerListResponse } from "@smithery/api/resources/index.mjs";
import {
	BookIcon,
	CopyIcon,
	DatabaseIcon,
	GlobeIcon,
	MessageSquareIcon,
	PlusIcon,
	RefreshCcwIcon,
	SearchIcon,
	WrenchIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
	MessageResponse,
} from "@/components/ai-elements/message";
import {
	PromptInput,
	PromptInputActionAddAttachments,
	PromptInputActionMenu,
	PromptInputActionMenuContent,
	PromptInputActionMenuTrigger,
	PromptInputAttachment,
	PromptInputAttachments,
	PromptInputBody,
	PromptInputFooter,
	PromptInputHeader,
	type PromptInputMessage,
	PromptInputSelect,
	PromptInputSelectContent,
	PromptInputSelectItem,
	PromptInputSelectTrigger,
	PromptInputSelectValue,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
	Source,
	Sources,
	SourcesContent,
	SourcesTrigger,
} from "@/components/ai-elements/sources";
import { ActToolApproval } from "@/components/smithery/act-tool-approval";
import {
	searchTool,
	testConnection,
	validateSmitheryApiKey,
} from "@/components/smithery/actions";
import { ApiKeyConfigDialog } from "@/components/smithery/api-key-config-dialog";
import {
	type ConnectionAction,
	ConnectionsDialog,
} from "@/components/smithery/connections-manager";
import { ServerPill } from "@/components/smithery/server-pill";
import { ServerSearch } from "@/components/smithery/tool-search";
import type { ConnectionConfig } from "@/components/smithery/types";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useChatContext } from "@/contexts/chat-context";

const models = [
	{
		name: "Claude Haiku 4.5",
		value: "anthropic/claude-haiku-4.5",
	},
	{
		name: "DeepSeek V3",
		value: "deepseek/deepseek-v3",
	},
];

const emptyStateCards = [
	{
		text: "Send an email to ani+test@smithery.ai saying 'Hello from chatbot'",
		title: "Send Email",
	},
	{
		text: "Tell me my most recent email",
		title: "Get Most Recent Email",
	},
	{
		text: "Summarize my next day's schedule",
		title: "Summarize Meetings",
	},
];

const ChatBotDemo = () => {
	const [input, setInput] = useState("");
	const [model, setModel] = useState<string>(models[0].value);
	const [servers, setServers] = useState<
		{
			connectionConfig: ConnectionConfig;
			server?: ServerListResponse;
		}[]
	>([]);
	const [apiKey, setApiKey] = useState<string | null>(null);
	const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [isValidating, setIsValidating] = useState(false);
	const { messages, sendMessage, status, regenerate, addToolOutput } =
		useChatContext();

	const checkApiKey = useCallback(async (keyToValidate: string | null) => {
		setIsValidating(true);
		setValidationError(null);
		try {
			const result = await validateSmitheryApiKey(keyToValidate);
			setApiKeyValid(result.isValid);
			if (result.isValid && keyToValidate) {
				setApiKey(keyToValidate);
				localStorage.setItem("smithery_api_key", keyToValidate);
			} else if (!result.isValid) {
				setValidationError(result.error || "Invalid API key");
			}
		} catch (error) {
			setValidationError(
				error instanceof Error ? error.message : "Validation failed",
			);
			setApiKeyValid(false);
		} finally {
			setIsValidating(false);
		}
	}, []);

	// Load API key from localStorage on mount
	useEffect(() => {
		const storedApiKey = localStorage.getItem("smithery_api_key");
		if (storedApiKey) {
			setApiKey(storedApiKey);
		} else {
			// Check if env var is configured
			checkApiKey(null);
		}
	}, [checkApiKey]);

	// Validate API key when it's loaded
	useEffect(() => {
		if (apiKey && apiKeyValid === null) {
			checkApiKey(apiKey);
		}
	}, [apiKey, apiKeyValid, checkApiKey]);

	const handleApiKeySubmit = useCallback(
		(newApiKey: string) => {
			checkApiKey(newApiKey);
		},
		[checkApiKey],
	);

	const submitMessage = useCallback(
		(
			message: PromptInputMessage,
			bodyOverrides?: {
				model?: string;
				servers?: typeof servers;
			},
		) => {
			sendMessage(message, {
				body: {
					model: model,
					servers: servers,
					apiKey: apiKey,
					...bodyOverrides,
				},
			});
		},
		[model, servers, apiKey, sendMessage],
	);

	const connectionActions: ConnectionAction[] = [
		{
			name: "Test Connection",
			icon: <WrenchIcon className="size-4" />,
			onClick: async (connection, context) => {
				const result = await testConnection(
					connection.connectionId,
					context.namespace,
					apiKey,
				);

				if (result.success) {
					toast.success(
						`Connection successful! Found ${result.toolCount} tools.`,
					);
				} else {
					toast.error(`Connection failed: ${result.error}`);
				}
			},
		},
		{
			name: "Use in Chat",
			icon: <PlusIcon className="size-4" />,
			onClick: (connection) => {
				const connectionConfig: ConnectionConfig = {
					serverUrl: connection.mcpUrl,
					configId: connection.connectionId,
				};

				const alreadyAdded = servers.some(
					(s) => "configId" in s && s.configId === connection.connectionId,
				);

				if (alreadyAdded) {
					toast.info("Server already added to chat");
					return;
				}

				setServers([...servers, { connectionConfig }]);
				toast.success(`Added ${connection.name} to chat`);
			},
		},
	];

	const handleSubmit = (message: PromptInputMessage) => {
		const hasText = Boolean(message.text);
		const hasAttachments = Boolean(message.files?.length);
		if (!(hasText || hasAttachments)) {
			return;
		}
		submitMessage({
			text: message.text || "Sent with attachments",
			files: message.files,
		});
		setInput("");
	};

	// Loading state
	if (apiKeyValid === null) {
		return (
			<div className="flex items-center justify-center h-screen">
				<div className="text-muted-foreground">Validating API key...</div>
			</div>
		);
	}

	// Invalid key state
	if (apiKeyValid === false) {
		return (
			<ApiKeyConfigDialog
				error={validationError}
				onSubmit={handleApiKeySubmit}
				isValidating={isValidating}
			/>
		);
	}

	return (
		<div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
			<div className="flex flex-col h-full">
				<Conversation className="h-full">
					<ConversationContent className="h-full">
						{messages.length === 0 ? (
							<div className="h-full flex items-center justify-center">
								<Empty>
									<EmptyHeader>
										<EmptyMedia variant="icon">
											<MessageSquareIcon />
										</EmptyMedia>
										<EmptyTitle>No Messages Yet</EmptyTitle>
										<EmptyDescription>
											Start a conversation by sending a message. You can ask
											questions, request actions, or connect to servers.
										</EmptyDescription>
									</EmptyHeader>
									<EmptyContent className="flex-row gap-4 justify-center">
										{emptyStateCards.map((card, idx) => (
											<Card
												key={card.title}
												className="cursor-pointer hover:bg-accent transition-colors min-w-[200px]"
												onClick={() =>
													handleSubmit({
														text: card.text,
														files: [],
													})
												}
											>
												<CardHeader>
													<CardTitle className="flex justify-center items-center gap-2">
														<span>{card.title}</span>
													</CardTitle>
													<CardDescription>{card.text}</CardDescription>
												</CardHeader>
											</Card>
										))}
									</EmptyContent>
								</Empty>
							</div>
						) : (
							messages.map((message, messageIndex) => (
								<div key={message.id}>
									{message.role === "assistant" &&
										message.parts.filter((part) => part.type === "source-url")
											.length > 0 && (
											<Sources>
												<SourcesTrigger
													count={
														message.parts.filter(
															(part) => part.type === "source-url",
														).length
													}
												/>
												{message.parts
													.filter((part) => part.type === "source-url")
													.map((part, i) => (
														<SourcesContent key={`${message.id}-${i}`}>
															<Source
																key={`${message.id}-${i}`}
																href={part.url}
																title={part.url}
															/>
														</SourcesContent>
													))}
											</Sources>
										)}
									{message.parts.map((part, messagePartIndex) => {
										switch (part.type) {
											case "text": {
												// TODO: This creates an empty div, we should use a different component for this.
												if (message.role === "user" && part.text === "")
													return null;
												const isStreaming =
													status === "streaming" &&
													messageIndex === messages.length - 1 &&
													messagePartIndex === message.parts.length - 1;
												return (
													<Message
														key={`${message.id}-text-${messagePartIndex}`}
														from={message.role}
													>
														<MessageContent>
															<MessageResponse
																key={
																	isStreaming
																		? `streaming-${part.text.length}`
																		: "static"
																}
																mode={isStreaming ? "streaming" : "static"}
															>
																{part.text}
															</MessageResponse>
														</MessageContent>
														{message.role === "assistant" &&
															messagePartIndex === message.parts.length - 1 &&
															messageIndex === messages.length - 1 && (
																<MessageActions>
																	<MessageAction
																		onClick={() => regenerate()}
																		label="Retry"
																	>
																		<RefreshCcwIcon className="size-3" />
																	</MessageAction>
																	<MessageAction
																		onClick={() =>
																			navigator.clipboard.writeText(part.text)
																		}
																		label="Copy"
																	>
																		<CopyIcon className="size-3" />
																	</MessageAction>
																</MessageActions>
															)}
													</Message>
												);
											}
											case "reasoning":
												return (
													<Reasoning
														key={`reasoning-${message.id}-${messagePartIndex}`}
														className="w-full"
														isStreaming={
															status === "streaming" &&
															messagePartIndex === message.parts.length - 1 &&
															messageIndex === messages.length - 1 &&
															message.id === messages.at(-1)?.id
														}
													>
														<ReasoningTrigger />
														<ReasoningContent>{part.text}</ReasoningContent>
													</Reasoning>
												);
											case "tool-useServer": {
												// Type guard to ensure proper structure
												const searchPart = part as typeof part & {
													input: { query: string };
												};
												if (
													!searchPart.input?.query ||
													typeof searchPart.input.query !== "string"
												) {
													return (
														<div
															key={`tool-useServer-input-formulating-${message.id}-${messagePartIndex}`}
															className="mt-4"
														>
															<p>Formulating...</p>
														</div>
													);
												}

												if (part.state === "input-streaming") {
													return (
														<div
															key={`tool-useServer-input-streaming-${message.id}-${messagePartIndex}`}
															className="mt-4"
														>
															<p>
																Searching for servers with query:{" "}
																{searchPart.input.query}
															</p>
														</div>
													);
												}

												return (
													<div
														key={`tool-useServer-input-available-${message.id}-${messagePartIndex}`}
														className="mt-4"
													>
														<ServerSearch
															query={searchPart.input.query}
															apiKey={apiKey}
															onServerConnect={(server, connectionConfig) => {
																// Notify AI SDK that server was connected
																const newServers = [
																	...servers,
																	{ connectionConfig, server },
																];
																setServers(newServers);
																addToolOutput({
																	tool: "useServer",
																	toolCallId: part.toolCallId,
																	output: {
																		connectedServer: {
																			name: server.displayName,
																			description: server.description,
																			connectionId: connectionConfig.configId,
																		},
																		status: "connected",
																	},
																});
																submitMessage(
																	{
																		text: "",
																		files: [],
																	},
																	{ servers: newServers },
																);
															}}
														/>
													</div>
												);
											}
											case "tool-act": {
												// Type guard to ensure proper structure
												const actPart = part as typeof part & {
													input: {
														action: string;
														servers: Array<{ configId: string }>;
													};
												};
												if (
													!actPart.input?.action ||
													typeof actPart.input.action !== "string"
												) {
													return (
														<div
															key={`tool-act-input-formulating-${message.id}-${messagePartIndex}`}
															className="mt-4"
														>
															<p>Formulating action...</p>
														</div>
													);
												}

												if (part.state === "input-streaming") {
													return (
														<div
															key={`tool-act-input-streaming-${message.id}-${messagePartIndex}`}
															className="mt-4"
														>
															<p>Preparing action: {actPart.input.action}</p>
														</div>
													);
												}

												return (
													<div
														key={`tool-act-input-available-${message.id}-${messagePartIndex}`}
														className="mt-4"
													>
														<ActToolApproval
															prompt={actPart.input.action}
															configId={part.toolCallId}
															initialConnectionIds={
																actPart.input.servers?.map((s) => s.configId) ||
																[]
															}
															apiKey={apiKey}
															onExecute={(prompt, connectionIds, result) => {
																console.log("Action executed", {
																	prompt,
																	connectionIds,
																	toolCallId: part.toolCallId,
																});
																// Add tool output to notify AI SDK
																addToolOutput({
																	tool: "act",
																	toolCallId: part.toolCallId,
																	output: {
																		status: "executed",
																		prompt,
																		connectionIds,
																		result,
																	},
																});
																// Continue the conversation
																submitMessage(
																	{
																		text: "",
																		files: [],
																	},
																	{ servers },
																);
															}}
															onReject={() => {
																console.log("Action rejected", {
																	toolCallId: part.toolCallId,
																});
																// Add tool output to notify AI SDK
																addToolOutput({
																	tool: "act",
																	toolCallId: part.toolCallId,
																	output: {
																		status: "rejected",
																	},
																});
																// Continue the conversation
																submitMessage(
																	{
																		text: "",
																		files: [],
																	},
																	{ servers },
																);
															}}
														/>
													</div>
												);
											}
											case "tool-date": {
												if (part.state === "output-available") {
													const datePart = part as typeof part & {
														output: { date: string };
													};
													const dateValue = datePart.output?.date;
													const formattedDate = dateValue
														? new Date(dateValue).toLocaleString()
														: "No date available";

													return (
														<div
															key={`tool-date-${message.id}-${messagePartIndex}`}
															className="mt-4 p-3 border rounded-md bg-muted/50"
														>
															<div className="flex items-center gap-2 text-sm">
																<span className="font-medium">Date:</span>
																<span>{formattedDate}</span>
															</div>
														</div>
													);
												}
												return null;
											}
											case "step-start":
												return (
													<div
														key={`step-start-${message.id}-${messagePartIndex}`}
													/>
												);
											default:
												return (
													<div
														key={`unknown-message-part-${message.id}-${messagePartIndex}`}
														className="pb-8"
													>
														<p>{JSON.stringify(part)}</p>
													</div>
												);
										}
									})}
								</div>
							))
						)}
						{status === "submitted" && <Loader />}
					</ConversationContent>
					<ConversationScrollButton />
				</Conversation>
				<PromptInput
					onSubmit={handleSubmit}
					className="mt-4"
					globalDrop
					multiple
				>
					<PromptInputHeader>
						<PromptInputAttachments>
							{(attachment) => <PromptInputAttachment data={attachment} />}
						</PromptInputAttachments>
						<TooltipProvider>
							<div className="flex flex-wrap gap-1">
								{servers
									.filter(
										(server, index, self) =>
											index ===
											self.findIndex(
												(s) =>
													s.connectionConfig.configId ===
													server.connectionConfig.configId,
											),
									)
									.map((server, i) => {
										const serverId = server.connectionConfig.configId;

										return (
											<ServerPill
												key={`server-${serverId}`}
												server={server}
												onRemove={(id) => {
													setServers(
														servers.filter((s) => {
															return s.connectionConfig.configId !== id;
														}),
													);
												}}
												enablePolling={true}
												apiKey={apiKey}
											/>
										);
									})}
							</div>
						</TooltipProvider>
					</PromptInputHeader>
					<PromptInputBody>
						<PromptInputTextarea
							onChange={(e) => setInput(e.target.value)}
							value={input}
						/>
					</PromptInputBody>
					<PromptInputFooter>
						<PromptInputTools>
							<PromptInputActionMenu>
								<PromptInputActionMenuTrigger />
								<PromptInputActionMenuContent>
									<PromptInputActionAddAttachments />
								</PromptInputActionMenuContent>
							</PromptInputActionMenu>
							<ConnectionsDialog actions={connectionActions} apiKey={apiKey}>
								<Button variant="ghost" size="sm">
									<DatabaseIcon size={16} />
									<span>Connections</span>
								</Button>
							</ConnectionsDialog>
							<PromptInputSelect
								onValueChange={(value) => {
									setModel(value);
								}}
								value={model}
							>
								<PromptInputSelectTrigger>
									<PromptInputSelectValue />
								</PromptInputSelectTrigger>
								<PromptInputSelectContent>
									{models.map((model) => (
										<PromptInputSelectItem
											key={model.value}
											value={model.value}
										>
											{model.name}
										</PromptInputSelectItem>
									))}
								</PromptInputSelectContent>
							</PromptInputSelect>
						</PromptInputTools>
						<PromptInputSubmit disabled={!input && !status} status={status} />
					</PromptInputFooter>
				</PromptInput>
			</div>
		</div>
	);
};
export default ChatBotDemo;
