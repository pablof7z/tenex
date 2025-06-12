/**
 * TENEX CLI: Shared Types
 * Defines config, agent, and command parameter types.
 */

export type TenexConfig = {
	user: {
		nsec: string;
	};
};

export type AgentDefinition = {
	title: string;
	avatar: string;
	description: string;
	role: string;
	instructions: string;
	models: string[];
	files: { [filename: string]: string };
};

export type AgentPublishParams = {
	title?: string;
	avatar?: string;
	description?: string;
	role?: string;
	instructions?: string;
	models?: string;
	file?: string[];
};
