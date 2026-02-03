"use client";

import { useAtom } from "jotai";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
import { selectedTokenAtom, tokensCreatedAtom } from "@/hooks/use-smithery";
import { useSmitheryContext } from "@/registry/new-york/smithery/smithery-provider";

export function Tokens() {
	const [tokensCreated, setTokensCreated] = useAtom(tokensCreatedAtom);
	const [selectedToken, setSelectedToken] = useAtom(selectedTokenAtom);
	const [isOpen, setIsOpen] = useState(false);
	const [isCreatingToken, setIsCreatingToken] = useState(false);
	const [isCreatingNamespace, setIsCreatingNamespace] = useState(false);
	const [newNamespaceName, setNewNamespaceName] = useState("");
	const [showNamespaceInput, setShowNamespaceInput] = useState(false);

	const {
		createToken,
		createNamespace,
		loading,
		namespace,
		namespaces,
		setNamespace,
	} = useSmitheryContext();

	const handleRemoveToken = () => {
		if (!selectedToken) return;

		setTokensCreated((prev) =>
			prev.filter((token) => token.token !== selectedToken.token),
		);
		setSelectedToken(null);
	};

	const handleCreateToken = async () => {
		setIsCreatingToken(true);
		try {
			await createToken();
		} finally {
			setIsCreatingToken(false);
		}
	};

	const handleCreateNamespace = async () => {
		if (!newNamespaceName.trim()) return;
		setIsCreatingNamespace(true);
		try {
			await createNamespace(newNamespaceName.trim());
			setNewNamespaceName("");
			setShowNamespaceInput(false);
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

	if (!selectedToken) return null;

	return (
		<div className="flex items-center gap-4 text-sm text-muted-foreground">
			<span>
				{selectedToken.token.startsWith("v4.public")
					? "Service Token"
					: "Root API Key"}{" "}
				*****{selectedToken.token.slice(-4)}
			</span>
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
						{/* Namespace Section */}
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

						{/* Token Section */}
						<div className="space-y-2">
							<div className="text-sm font-medium">Token</div>
							{tokensCreated.length > 1 && (
								<Select
									value={selectedToken.token}
									onValueChange={(tokenValue) => {
										const token = tokensCreated.find(
											(t) => t.token === tokenValue,
										);
										if (token) setSelectedToken(token);
									}}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{tokensCreated.map((token) => (
											<SelectItem key={token.token} value={token.token}>
												{token.token.startsWith("v4.public")
													? "Service Token"
													: "Root API Key"}
												: *****{token.token.slice(-4)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}

							<div className="rounded-lg border p-4 space-y-2">
								<div className="flex items-start justify-between">
									<div className="space-y-1">
										<div className="font-medium">
											{selectedToken.token.startsWith("v4.public")
												? "Service Token"
												: "Root API Key"}
											: *****{selectedToken.token.slice(-4)}
										</div>
										{selectedToken.expiresAt !== "never" && (
											<div className="text-sm text-muted-foreground">
												Expires:{" "}
												{new Date(selectedToken.expiresAt).toLocaleString()}
											</div>
										)}
									</div>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={handleRemoveToken}
										aria-label="Remove token"
									>
										<Trash2 className="size-4" />
									</Button>
								</div>
							</div>

							<Button
								onClick={handleCreateToken}
								variant="secondary"
								className="w-full"
								disabled={isCreatingToken}
							>
								{isCreatingToken ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										Creating...
									</>
								) : (
									"Create New Token"
								)}
							</Button>
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
