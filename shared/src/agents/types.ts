export interface AgentConfigEntry {
	nsec: string;
	file?: string;
}

export interface AgentsJson {
	[agentName: string]: AgentConfigEntry;
}

export interface LegacyAgentsJson {
	[agentName: string]: string | AgentConfigEntry;
}

export interface AgentDefinition {
	eventId: string;
	name: string;
	description?: string;
	role?: string;
	instructions?: string;
	version: number;
	publishedAt?: number;
	publisher: string;
}

export interface AgentProfile {
	name: string;
	display_name: string;
	about: string;
	picture: string;
	created_at?: number;
}

export interface AgentSignerResult {
	signer: any; // NDKPrivateKeySigner - avoiding import here
	nsec: string;
	isNew: boolean;
	configFile?: string;
}

export interface AgentConfig {
	name: string;
	description?: string;
	role?: string;
	instructions?: string;
	systemPrompt?: string;
	version?: number;
}
