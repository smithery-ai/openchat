"use client";

import { useState } from "react";
import { ActiveConnection } from "@/registry/new-york/smithery/active-connection";
import { useConnectionConfig } from "@/registry/new-york/smithery/connection-context";
import { ConnectionsList } from "@/registry/new-york/smithery/connections-list";
import { WithQueryClient } from "@/registry/new-york/smithery/query-client-wrapper";

// Re-export useConnectionConfig for backward compatibility
export { useConnectionConfig };

const ConnectionsInner = ({
	token,
	namespace,
}: {
	token: string;
	namespace?: string;
}) => {
	const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
		null,
	);

	return (
		<div className="w-full h-full flex">
			<div className="w-full max-w-sm border-r-3 h-full overflow-auto">
				<ConnectionsList
					token={token}
					namespace={namespace}
					onActiveConnectionIdChange={setActiveConnectionId}
					defaultShowSearchServers={false}
				/>
			</div>
			<div className="w-full flex-1 overflow-auto">
				{activeConnectionId && (
					<ActiveConnection
						token={token}
						namespace={namespace}
						connectionId={activeConnectionId || ""}
					/>
				)}
			</div>
		</div>
	);
};

export const Connections = (props: { token: string; namespace?: string }) => (
	<WithQueryClient>
		<ConnectionsInner {...props} />
	</WithQueryClient>
);
