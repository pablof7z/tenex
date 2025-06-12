export interface RuleData {
	eventId: string;
	title: string;
	description: string;
	content: string;
}

export interface RuleOptions {
	agent?: string;
	projectPath?: string;
}

export interface AddRuleOptions extends RuleOptions {}

export interface GetRuleOptions extends RuleOptions {
	limit?: number;
}

export interface ListRuleOptions extends RuleOptions {}

export const INSTRUCTION_KIND = 1339;
