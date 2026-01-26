"use client";

import type { Tool } from "ai";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
	CodeBlock,
	CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
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
	const [isExecuting, setIsExecuting] = useState(false);
	const [result, setResult] = useState<unknown>(null);
	const [error, setError] = useState<string | null>(null);
	const [executedAt, setExecutedAt] = useState<Date | null>(null);
	const [copied, setCopied] = useState(false);
	const [activeTab, setActiveTab] = useState("code");

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
		}
	}, [open, reset, schema]);

	const handleExecuteSubmit = async (params: Record<string, unknown>) => {
		if (!onExecute) return;

		// Switch to output tab when execution starts
		setActiveTab("output");
		setIsExecuting(true);
		setError(null);
		setResult(null);

		try {
			// Parse JSON strings for arrays and objects
			const processedParams: Record<string, unknown> = {};
			for (const [key, value] of Object.entries(params)) {
				if (
					typeof value === "string" &&
					(value.startsWith("[") || value.startsWith("{"))
				) {
					try {
						processedParams[key] = JSON.parse(value);
					} catch {
						processedParams[key] = value;
					}
				} else {
					processedParams[key] = value;
				}
			}

			const res = await onExecute(processedParams);
			setResult(res);
			setExecutedAt(new Date());
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsExecuting(false);
		}
	};

	const handleCopyResult = async () => {
		if (!result) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};

	// Generate code preview
	const generateCodePreview = () => {
		const params: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(formValues)) {
			if (value !== "" && value !== undefined && value !== null) {
				// Try to parse JSON strings
				if (
					typeof value === "string" &&
					(value.startsWith("[") || value.startsWith("{"))
				) {
					try {
						params[key] = JSON.parse(value);
					} catch {
						params[key] = value;
					}
				} else {
					params[key] = value;
				}
			}
		}

		const paramsString = JSON.stringify(params, null, 2)
			.split("\n")
			.map((line, i) => (i === 0 ? line : `  ${line}`))
			.join("\n");

		return `const result = await tools.${name}.execute(${paramsString});

console.log(result);`;
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
					<div className="md:col-span-2 overflow-auto pr-2">
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
									<TabsTrigger value="output">
										Output
										{executedAt && (
											<span className="ml-1.5 text-xs text-muted-foreground">
												({executedAt.toLocaleTimeString()})
											</span>
										)}
									</TabsTrigger>
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
								<CodeBlock
									code={generateCodePreview()}
									language="typescript"
									className="h-full"
								>
									<CodeBlockCopyButton />
								</CodeBlock>
							</TabsContent>
							<TabsContent value="output" className="flex-1 overflow-auto mt-3">
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
									<div className="relative">
										<pre className="rounded-md bg-muted p-4 text-sm overflow-auto max-h-full">
											<code>{JSON.stringify(result, null, 2)}</code>
										</pre>
										<Button
											variant="ghost"
											size="icon"
											className="absolute top-2 right-2 h-7 w-7"
											onClick={handleCopyResult}
										>
											{copied ? (
												<Check className="h-3.5 w-3.5" />
											) : (
												<Copy className="h-3.5 w-3.5" />
											)}
										</Button>
									</div>
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
				defaults[name] = property.minimum || 0;
			} else if (type === "array") {
				defaults[name] = "[]";
			} else if (type === "object") {
				defaults[name] = "{}";
			} else {
				defaults[name] = "";
			}
		}
	}

	return defaults;
}
