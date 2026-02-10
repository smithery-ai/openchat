"use client";

import {
	CodeBlock,
	CodeBlockCopyButton,
} from "@openchat/registry/smithery/code-block";

interface InstallCommandProps {
	name: string;
}

export function InstallCommand({ name }: InstallCommandProps) {
	const baseUrl =
		process.env.NEXT_PUBLIC_SITE_URL || "https://openchat-smithery.vercel.app";
	const command = `npx shadcn@latest add "${baseUrl}/r/${name}.json"`;

	return (
		<CodeBlock code={command} language="bash">
			<CodeBlockCopyButton />
		</CodeBlock>
	);
}
