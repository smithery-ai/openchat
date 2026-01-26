"use client";

import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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

interface SchemaFormProps {
	schema: JSONSchema;
	onSubmit: (data: Record<string, unknown>) => void;
	isLoading?: boolean;
}

export function SchemaForm({ schema, onSubmit, isLoading }: SchemaFormProps) {
	const {
		register,
		handleSubmit,
		formState: { errors },
		setValue,
		watch,
	} = useForm<Record<string, unknown>>({
		defaultValues: getDefaultValues(schema),
	});

	const properties = schema.properties || {};
	const requiredFields = schema.required || [];

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
			{Object.entries(properties).map(([name, property]) => {
				const isRequired = requiredFields.includes(name);
				return (
					<Field key={name}>
						<FieldLabel htmlFor={name}>
							{formatFieldName(name)}
							{isRequired && <span className="text-destructive ml-1">*</span>}
						</FieldLabel>
						{property.description && (
							<FieldDescription>{property.description}</FieldDescription>
						)}
						{renderField(name, property, register, setValue, watch, isRequired)}
						<FieldError errors={errors[name] ? [errors[name]] : undefined} />
					</Field>
				);
			})}
			<Button type="submit" disabled={isLoading} className="w-full">
				{isLoading ? "Executing..." : "Execute"}
			</Button>
		</form>
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
				<SelectTrigger id={name}>
					<SelectValue placeholder="Select an option" />
				</SelectTrigger>
				<SelectContent>
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
					required: isRequired ? `${formatFieldName(name)} is required` : false,
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
					required: isRequired ? `${formatFieldName(name)} is required` : false,
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
					required: isRequired ? `${formatFieldName(name)} is required` : false,
					validate: (value) => {
						if (!value) return true;
						try {
							const parsed = JSON.parse(value as string);
							return typeof parsed === "object" || "Must be a valid JSON object";
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
					required: isRequired ? `${formatFieldName(name)} is required` : false,
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
				required: isRequired ? `${formatFieldName(name)} is required` : false,
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

function formatFieldName(name: string): string {
	// Keep the original field name as-is
	return name;
}
