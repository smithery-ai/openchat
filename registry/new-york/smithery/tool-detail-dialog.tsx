"use client";

import type { Tool } from "ai";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { estimateTokenCount } from "tokenx";
import {
	CodeBlock,
	CodeBlockCopyButton,
} from "@/components/smithery/code-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useConnectionConfig } from "@/registry/new-york/smithery/connection-context";
import { ToolOutputViewer } from "@/registry/new-york/smithery/tool-output-viewer";

interface JSONSchema {
	type?: string;
	properties?: Record<string, JSONSchemaProperty>;
	required?: string[];
	additionalProperties?: boolean;
}

interface JSONSchemaProperty {
	type?: string | string[];
	description?: string;
	enum?: string[];
	minimum?: number;
	maximum?: number;
	default?: unknown;
	items?: JSONSchemaProperty;
}

interface ToolDetailDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	tool: Tool;
	onExecute?: (params: Record<string, unknown>) => Promise<unknown>;
}

export function ToolDetailDialog({
	open,
	onOpenChange,
	name,
	tool,
	onExecute,
}: ToolDetailDialogProps) {
	const connectionConfig = useConnectionConfig();
	const [isExecuting, setIsExecuting] = useState(false);
	const [result, setResult] = useState<unknown>(null);
	const [error, setError] = useState<string | null>(null);
	const [executedAt, setExecutedAt] = useState<Date | null>(null);
	const [activeTab, setActiveTab] = useState("code");
	const [estimatedTokens, setEstimatedTokens] = useState<number | null>(null);
	const [latency, setLatency] = useState<number | null>(null);

	// Extract schema
	const inputSchema = tool.inputSchema;
	const schema: JSONSchema =
		typeof inputSchema === "object" &&
		inputSchema &&
		"jsonSchema" in inputSchema
			? (inputSchema as { jsonSchema: JSONSchema }).jsonSchema
			: (inputSchema as JSONSchema) || {};

	const properties = schema.properties || {};
	const requiredFields = schema.required || [];
	const hasParameters = Object.keys(properties).length > 0;

	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
		watch,
		reset,
	} = useForm<Record<string, unknown>>({
		defaultValues: getDefaultValues(schema),
	});

	const formValues = watch();

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			reset(getDefaultValues(schema));
			setResult(null);
			setError(null);
			setExecutedAt(null);
			setActiveTab("code");
			setEstimatedTokens(null);
			setLatency(null);
		}
	}, [open, reset, schema]);

	// Check if a value is empty and should be excluded
	const isEmptyValue = (value: unknown): boolean => {
		if (value === "" || value === undefined || value === null) return true;
		if (typeof value === "number" && Number.isNaN(value)) return true;
		if (Array.isArray(value) && value.length === 0) return true;
		if (
			typeof value === "object" &&
			value !== null &&
			Object.keys(value).length === 0
		)
			return true;
		return false;
	};

	const handleExecuteSubmit = async (params: Record<string, unknown>) => {
		if (!onExecute) return;

		// Switch to output tab when execution starts
		setActiveTab("output");
		setIsExecuting(true);
		setError(null);
		setResult(null);
		setEstimatedTokens(null);
		setLatency(null);

		const startTime = performance.now();

		try {
			// Parse JSON strings for arrays and objects, filter out empty values
			const processedParams: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(params)) {
				// Try to parse JSON strings first
				let parsedValue = value;
				if (
					typeof value === "string" &&
					(value.startsWith("[") || value.startsWith("{"))
				) {
					try {
						parsedValue = JSON.parse(value);
					} catch {
						// Keep original string if parsing fails
					}
				}

				// Skip empty values
				if (isEmptyValue(parsedValue)) {
					continue;
				}
				processedParams[key] = parsedValue;
			}

			const res = await onExecute(processedParams);
			const endTime = performance.now();
			const executionLatency = endTime - startTime;

			// Estimate token count of the result
			const resultString = JSON.stringify(res);
			const tokens = estimateTokenCount(resultString);

			setResult(res);
			setExecutedAt(new Date());
			setLatency(executionLatency);
			setEstimatedTokens(tokens);
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsExecuting(false);
		}
	};

	// Generate code preview
	const generateCodePreview = () => {
		const params: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(formValues)) {
			// Try to parse JSON strings first
			let parsedValue = value;
			if (
				typeof value === "string" &&
				(value.startsWith("[") || value.startsWith("{"))
			) {
				try {
					parsedValue = JSON.parse(value);
				} catch {
					// Keep original string if parsing fails
				}
			}

			if (!isEmptyValue(parsedValue)) {
				params[key] = parsedValue;
			}
		}

		return generateToolExecuteCode(name, params, connectionConfig);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="!max-w-[75vw] !max-h-[85vh] overflow-hidden flex flex-col">
				<DialogHeader>
					<div className="flex items-start justify-between gap-4 pr-8">
						<div>
							<DialogTitle className="text-lg font-semibold break-all">
								{name}
							</DialogTitle>
							{tool.description && (
								<DialogDescription className="mt-1.5">
									{tool.description}
								</DialogDescription>
							)}
						</div>
						{tool.type && tool.type !== "dynamic" && (
							<Badge variant="outline" className="shrink-0">
								{tool.type}
							</Badge>
						)}
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-5 gap-6 min-h-0">
					{/* Left Panel - Parameters */}
					<div className="md:col-span-2 overflow-auto px-2">
						<form id="tool-form" onSubmit={handleSubmit(handleExecuteSubmit)}>
							{hasParameters ? (
								(() => {
									const requiredEntries = Object.entries(properties).filter(
										([fieldName]) => requiredFields.includes(fieldName),
									);
									const optionalEntries = Object.entries(properties).filter(
										([fieldName]) => !requiredFields.includes(fieldName),
									);

									const renderFieldSet = (
										entries: Array<[string, JSONSchemaProperty]>,
										isRequired: boolean,
										label: string,
									) => {
										if (entries.length === 0) return null;

										return (
											<FieldSet>
												<FieldLegend>{label}</FieldLegend>
												<FieldGroup>
													{entries.map(([fieldName, property]) => (
														<Field key={fieldName}>
															<FieldLabel htmlFor={fieldName}>
																{fieldName}
															</FieldLabel>
															{renderField(
																fieldName,
																property,
																register,
																setValue,
																watch,
																isRequired,
															)}
															{property.description && (
																<FieldDescription>
																	{property.description}
																</FieldDescription>
															)}
															<FieldError
																errors={
																	errors[fieldName]
																		? [errors[fieldName]]
																		: undefined
																}
															/>
														</Field>
													))}
												</FieldGroup>
											</FieldSet>
										);
									};

									const requiredSection = renderFieldSet(
										requiredEntries,
										true,
										"Required",
									);
									const optionalSection = renderFieldSet(
										optionalEntries,
										false,
										"Optional",
									);

									return (
										<FieldGroup>
											{requiredSection}
											{requiredSection && optionalSection && <FieldSeparator />}
											{optionalSection}
										</FieldGroup>
									);
								})()
							) : (
								<p className="text-sm text-muted-foreground">
									This tool has no parameters.
								</p>
							)}
						</form>
					</div>

					{/* Right Panel - Code & Output */}
					<div className="md:col-span-3 overflow-hidden flex flex-col min-h-0">
						<Tabs
							value={activeTab}
							onValueChange={setActiveTab}
							className="flex-1 flex flex-col min-h-0"
						>
							<div className="flex items-center justify-between gap-2">
								<TabsList className="w-fit">
									<TabsTrigger value="code">Code</TabsTrigger>
									<TabsTrigger value="output">Output</TabsTrigger>
								</TabsList>
								<Button
									type="button"
									disabled={isExecuting}
									onClick={() => handleSubmit(handleExecuteSubmit)()}
									size="sm"
								>
									{isExecuting ? "Executing..." : "Execute"}
								</Button>
							</div>
							<TabsContent value="code" className="flex-1 overflow-auto mt-3">
								<div className="flex flex-col gap-3 h-full">
									<CodeBlock
										code="npm install @smithery/api @modelcontextprotocol/sdk"
										language="bash"
									>
										<CodeBlockCopyButton />
									</CodeBlock>
									<CodeBlock
										code={generateCodePreview()}
										language="typescript"
										className="flex-1 overflow-auto"
									>
										<CodeBlockCopyButton />
									</CodeBlock>
								</div>
							</TabsContent>
							<TabsContent
								value="output"
								className="flex-1 overflow-auto mt-3 flex flex-col gap-3"
							>
								{executedAt && estimatedTokens !== null && latency !== null && (
									<div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
										<span>{executedAt.toLocaleTimeString()}</span>
										<span>•</span>
										<span className="font-medium">
											{estimatedTokens.toLocaleString()} tokens
										</span>
										<span>•</span>
										<span className="font-medium">
											{latency.toLocaleString()}ms
										</span>
									</div>
								)}
								{isExecuting ? (
									<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
										<div className="flex flex-col items-center gap-2">
											<div className="animate-spin h-6 w-6 border-2 border-muted-foreground border-t-transparent rounded-full" />
											<span>Executing...</span>
										</div>
									</div>
								) : error ? (
									<div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
										{error}
									</div>
								) : result ? (
									<ToolOutputViewer result={result} />
								) : (
									<div className="flex items-center justify-center h-full text-muted-foreground text-sm">
										Execute the tool to see output
									</div>
								)}
							</TabsContent>
						</Tabs>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function renderField(
	name: string,
	property: JSONSchemaProperty,
	register: ReturnType<typeof useForm>["register"],
	setValue: ReturnType<typeof useForm>["setValue"],
	watch: ReturnType<typeof useForm>["watch"],
	isRequired: boolean,
) {
	const type = Array.isArray(property.type) ? property.type[0] : property.type;

	// Handle enums with Select
	if (property.enum && property.enum.length > 0) {
		const currentValue = watch(name);
		return (
			<Select
				value={currentValue as string}
				onValueChange={(value) => setValue(name, value)}
			>
				<SelectTrigger className="w-full" id={name}>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent className="w-full">
					{property.enum.map((option) => (
						<SelectItem key={option} value={option}>
							{option}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	// Handle boolean with Switch
	if (type === "boolean") {
		const currentValue = watch(name);
		return (
			<div className="flex items-center gap-2">
				<Switch
					id={name}
					checked={currentValue as boolean}
					onCheckedChange={(checked) => setValue(name, checked)}
				/>
				<span className="text-sm text-muted-foreground">
					{currentValue ? "Enabled" : "Disabled"}
				</span>
			</div>
		);
	}

	// Handle number with Input type number
	if (type === "number" || type === "integer") {
		return (
			<Input
				id={name}
				type="number"
				{...register(name, {
					required: isRequired ? `${name} is required` : false,
					valueAsNumber: true,
					min: property.minimum,
					max: property.maximum,
				})}
			/>
		);
	}

	// Handle arrays
	if (type === "array") {
		return (
			<Textarea
				id={name}
				placeholder="Enter JSON array (e.g., [1, 2, 3])"
				{...register(name, {
					required: isRequired ? `${name} is required` : false,
					validate: (value) => {
						if (!value) return true;
						try {
							const parsed = JSON.parse(value as string);
							return Array.isArray(parsed) || "Must be a valid JSON array";
						} catch {
							return "Must be valid JSON";
						}
					},
				})}
			/>
		);
	}

	// Handle objects
	if (type === "object") {
		return (
			<Textarea
				id={name}
				placeholder='Enter JSON object (e.g., {"key": "value"})'
				{...register(name, {
					required: isRequired ? `${name} is required` : false,
					validate: (value) => {
						if (!value) return true;
						try {
							const parsed = JSON.parse(value as string);
							return (
								typeof parsed === "object" || "Must be a valid JSON object"
							);
						} catch {
							return "Must be valid JSON";
						}
					},
				})}
			/>
		);
	}

	// Handle string - use Textarea if description suggests long text
	const useLongText =
		property.description?.toLowerCase().includes("description") ||
		property.description?.toLowerCase().includes("long") ||
		property.description?.toLowerCase().includes("paragraph");

	if (useLongText) {
		return (
			<Textarea
				id={name}
				{...register(name, {
					required: isRequired ? `${name} is required` : false,
				})}
			/>
		);
	}

	// Default to regular Input for strings
	return (
		<Input
			id={name}
			type="text"
			{...register(name, {
				required: isRequired ? `${name} is required` : false,
			})}
		/>
	);
}

interface ConnectionConfig {
	mcpUrl: string;
	apiKey: string;
	namespace: string;
	connectionId: string;
}

function generateToolExecuteCode(
	toolName: string,
	params: Record<string, unknown>,
	config: ConnectionConfig | null,
): string {
	const mcpUrl = config?.mcpUrl || "process.env.MCP_URL";
	const _namespace = config?.namespace
		? `"${config.namespace}"`
		: "process.env.SMITHERY_NAMESPACE";
	const connectionId = config?.connectionId
		? `"${config.connectionId}"`
		: "connectionId";

	const code = `import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import Smithery from '@smithery/api';
import { createConnection } from '@smithery/api/mcp';

const mcpUrl = "${mcpUrl}";
const connectionId = ${connectionId};
const apiKey = process.env.SMITHERY_API_KEY;

const { transport } = await createConnection({
  client: new Smithery({ apiKey }),
  connectionId,
  mcpUrl,
});

// Initialize the Traditional MCP Client
const mcpClient = new Client({
    name: "smithery-mcp-client",
    version: "1.0.0",
});

// Connect explicitly
await mcpClient.connect(transport);

const result = await mcpClient.callTool({
  name: "${toolName}",
  arguments: ${JSON.stringify(params, null, 2)},
});
console.log(result);
`;

	return code.trim();
}

function getDefaultValues(schema: JSONSchema): Record<string, unknown> {
	const defaults: Record<string, unknown> = {};
	const properties = schema.properties || {};

	for (const [name, property] of Object.entries(properties)) {
		if (property.default !== undefined) {
			defaults[name] = property.default;
		} else {
			const type = Array.isArray(property.type)
				? property.type[0]
				: property.type;
			// Set sensible defaults based on type
			if (type === "boolean") {
				defaults[name] = false;
			} else if (type === "number" || type === "integer") {
				defaults[name] = "";
			} else if (type === "array") {
				defaults[name] = "";
			} else if (type === "object") {
				defaults[name] = "";
			} else {
				defaults[name] = "";
			}
		}
	}

	return defaults;
}
