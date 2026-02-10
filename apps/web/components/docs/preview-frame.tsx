interface PreviewFrameProps {
	children: React.ReactNode;
}

export function PreviewFrame({ children }: PreviewFrameProps) {
	return (
		<div className="border-2 border-dashed border-muted rounded-lg overflow-hidden">
			<div className="bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground border-b border-dashed border-muted">
				Component Preview
			</div>
			<div className="overflow-auto">{children}</div>
		</div>
	);
}
