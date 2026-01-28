"use client";
import type { Connection } from "@smithery/api/resources/beta/connect/connections.mjs";
import { CopyIcon, MessageSquareIcon, RefreshCcwIcon } from "lucide-react";
import { useCallback, useState } from "react";
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
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { ServerSearch } from "@/registry/new-york/smithery/server-search";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { useChat } from "@ai-sdk/react";
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { Act } from "@/registry/new-york/smithery/act";

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

interface ChatBlockProps {
	token: string | null;
	namespace: string;
}

export function ChatBlock({ token, namespace }: ChatBlockProps) {
	const [input, setInput] = useState("");
	const [model, setModel] = useState<string>(models[0].value);
	const [connections, setConnections] = useState<Connection[]>([]);

	const updateBody = useCallback(() => {
		return {
				model: model,
				connections: connections,
				apiKey: token,
		};
	}, [model, connections, token]);

	const { messages, sendMessage, status, regenerate, addToolOutput } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/chat",
			prepareSendMessagesRequest: (options) => {
				return {
					body: {
						...(options.body || {}),
						...updateBody(),
						messages: options.messages,
					},
					headers: options.headers,
					credentials: options.credentials,
				};
			},
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
	});

	const handleSubmit = (message: PromptInputMessage) => {
		const hasText = Boolean(message.text);
		const hasAttachments = Boolean(message.files?.length);
		if (!(hasText || hasAttachments)) {
			return;
		}
		sendMessage({
			text: message.text || "Sent with attachments",
			files: message.files,
		});
		setInput("");
	};

	// No token selected
	if (!token) {
		return (
			<div className="flex items-center justify-center">
				<div className="text-muted-foreground">
					No token selected. Please create a token.
				</div>
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto p-6 relative size-full">
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
									<EmptyContent>
										<div className="flex-row gap-4 justify-center w-full">
											{emptyStateCards.map((card, _idx) => (
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
										</div>
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
														>
															<p>Formulating...</p>
														</div>
													);
												}

												if (part.state === "input-streaming") {
													return (
														<div
															key={`tool-useServer-input-streaming-${message.id}-${messagePartIndex}`}
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
													>
														<ServerSearch
															hideSearchAfterConnect={true}
															query={searchPart.input.query}
															namespace={namespace}
															token={token}
															onServerConnect={async (connection) => {
																// Notify AI SDK that server was connected
																const newConnections = [
																	...connections,
																	connection,
																];
																// This new connections array won't go to the server!
																// But it'll be in tool output
																setConnections(newConnections);
																addToolOutput({
																	tool: "useServer",
																	toolCallId: part.toolCallId,
																	output: {
																		connectedServer: {
																			name:
																				connection.serverInfo?.title ??
																				connection.serverInfo?.name ??
																				connection.name,
																			description:
																				connection.serverInfo?.description ??
																				"",
																			connectionId: connection.connectionId,
																		},
																		status: "connected",
																	},
																});
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
														>
															<p>Formulating action...</p>
														</div>
													);
												}

												if (part.state === "input-streaming") {
													return (
														<div
															key={`tool-act-input-streaming-${message.id}-${messagePartIndex}`}
														>
															<p>Preparing action: {actPart.input.action}</p>
														</div>
													);
												}

												return (
													<div
														key={`tool-act-input-available-${message.id}-${messagePartIndex}`}
													>
														<Act
															action={actPart.input.action}
															connections={connections}
															namespace={namespace}
															apiKey={token}
														/>
														<br />
														<p>{JSON.stringify(part)}</p>
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
															className="p-3 border rounded-md bg-muted/50"
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
}
