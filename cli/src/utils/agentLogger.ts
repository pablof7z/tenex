import chalk from "chalk";

const agentColors = [
	chalk.red,
	chalk.green,
	chalk.yellow,
	chalk.blue,
	chalk.magenta,
	chalk.cyan,
	chalk.white,
	chalk.gray,
	chalk.redBright,
	chalk.greenBright,
	chalk.yellowBright,
	chalk.blueBright,
	chalk.magentaBright,
	chalk.cyanBright,
];

const agentColorMap = new Map<string, typeof chalk.red>();

function getAgentColor(agentName: string): typeof chalk.red {
	if (!agentColorMap.has(agentName)) {
		const index = agentColorMap.size % agentColors.length;
		agentColorMap.set(agentName, agentColors[index]);
	}
	const color = agentColorMap.get(agentName);
	if (!color) {
		// This should never happen, but TypeScript doesn't know that
		return chalk.white;
	}
	return color;
}

export class AgentLogger {
	private projectName: string;
	private agentName: string;
	private color: typeof chalk.red;

	constructor(projectName: string, agentName: string) {
		this.projectName = projectName;
		this.agentName = agentName;
		this.color = getAgentColor(agentName);
	}

	private formatMessage(
		emoji: string,
		message: string,
		colorFn: typeof chalk.red,
	): string {
		const prefix = `${chalk.gray(`[${this.projectName}]`)} ${this.color(`[${this.agentName}]`)} ${emoji}`;
		const coloredMessage = colorFn(message);
		return `${prefix} ${coloredMessage}`;
	}

	info(message: string): void {
		console.log(this.formatMessage("ℹ️", message, chalk.blueBright));
	}

	success(message: string): void {
		console.log(this.formatMessage("✅", message, chalk.greenBright));
	}

	warning(message: string): void {
		console.log(this.formatMessage("⚠️", message, chalk.yellowBright));
	}

	error(message: string): void {
		console.error(this.formatMessage("❌", message, chalk.redBright));
	}

	debug(message: string): void {
		if (process.env.DEBUG) {
			console.log(this.formatMessage("🔍", message, chalk.magentaBright));
		}
	}
}

export function createAgentLogger(
	projectName: string,
	agentName: string,
): AgentLogger {
	return new AgentLogger(projectName, agentName);
}
