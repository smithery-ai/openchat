"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useSmitheryContext } from "@/registry/new-york/smithery/smithery-provider";

function getTokenLabel(token: string): string {
	const tokenType = token.startsWith("v4.public")
		? "Service Token"
		: "Root API Key";
	const suffix = token.length >= 4 ? token.slice(-4) : token;
	return `${tokenType} *****${suffix}`;
}

export function Tokens() {
	const [isOpen, setIsOpen] = useState(false);
	const [isCreatingNamespace, setIsCreatingNamespace] = useState(false);
	const [newNamespaceName, setNewNamespaceName] = useState("");
	const [showNamespaceInput, setShowNamespaceInput] = useState(false);
	const [namespaceError, setNamespaceError] = useState<string | null>(null);

	const {
		createNamespace,
		loading,
		namespace,
		namespaces,
		setNamespace,
		token,
	} = useSmitheryContext();

	const handleCreateNamespace = async () => {
		if (!newNamespaceName.trim()) return;
		setIsCreatingNamespace(true);
		setNamespaceError(null);
		try {
			await createNamespace(newNamespaceName.trim());
			setNewNamespaceName("");
			setShowNamespaceInput(false);
		} catch (err) {
			setNamespaceError(
				err instanceof Error ? err.message : "Failed to create namespace",
			);
		} finally {
			setIsCreatingNamespace(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="size-4 animate-spin" />
				<span>Loading...</span>
			</div>
		);
	}

	if (!token) return null;

	return (
		<div className="flex items-center gap-4 text-sm text-muted-foreground">
			<span>{getTokenLabel(token)}</span>
			{namespace && (
				<span className="text-xs bg-muted px-2 py-0.5 rounded">
					{namespace}
				</span>
			)}
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogTrigger asChild>
					<Button variant="outline" size="sm">
						Settings
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Settings</DialogTitle>
					</DialogHeader>
					<div className="space-y-6">
						<div className="space-y-2">
							<div className="text-sm font-medium">Namespace</div>
							{namespaces.length > 0 && (
								<Select value={namespace} onValueChange={setNamespace}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select namespace" />
									</SelectTrigger>
									<SelectContent>
										{namespaces.map((ns) => (
											<SelectItem key={ns} value={ns}>
												{ns}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
							{namespaceError && (
								<div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
									{namespaceError}
								</div>
							)}
							{showNamespaceInput ? (
								<div className="flex gap-2">
									<Input
										placeholder="Namespace name"
										value={newNamespaceName}
										onChange={(e) => setNewNamespaceName(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleCreateNamespace();
											if (e.key === "Escape") {
												setShowNamespaceInput(false);
												setNewNamespaceName("");
											}
										}}
										disabled={isCreatingNamespace}
									/>
									<Button
										onClick={handleCreateNamespace}
										disabled={isCreatingNamespace || !newNamespaceName.trim()}
										size="sm"
									>
										{isCreatingNamespace ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											"Create"
										)}
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											setShowNamespaceInput(false);
											setNewNamespaceName("");
										}}
										disabled={isCreatingNamespace}
									>
										Cancel
									</Button>
								</div>
							) : (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setShowNamespaceInput(true)}
									className="w-full"
								>
									<Plus className="size-4 mr-2" />
									Create Namespace
								</Button>
							)}
						</div>

						<div className="space-y-2">
							<div className="text-sm font-medium">API Key</div>
							<div className="rounded-lg border p-4">
								<div className="font-medium">{getTokenLabel(token)}</div>
							</div>
						</div>

						<Button onClick={() => setIsOpen(false)} className="w-full">
							Done
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
