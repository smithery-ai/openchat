interface ComponentFrameProps {
	title: string;
	description?: string;
	children: React.ReactNode;
}

export function ComponentFrame({
	title,
	description,
	children,
}: ComponentFrameProps) {
	return (
		<div className="h-full flex flex-col">
			<div className="p-6 border-b shrink-0">
				<h2 className="text-lg font-semibold">{title}</h2>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>

			{/* Component Preview - clearly framed */}
			<div className="flex-1 border-2 border-dashed border-muted m-4 rounded-lg overflow-hidden">
				<div className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-dashed border-muted">
					Component Preview
				</div>
				<div className="h-[calc(100%-32px)] overflow-auto">{children}</div>
			</div>
		</div>
	);
}
