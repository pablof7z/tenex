import { nip19 } from "nostr-tools";

// Define types for different decoded data structures
interface EventPointer {
	id: string;
	relays?: string[];
	author?: string;
	kind?: number;
}

interface AddressPointer {
	kind: number;
	pubkey: string;
	identifier: string;
	relays?: string[];
}

interface ProfilePointer {
	pubkey: string;
	relays?: string[];
}

// Union type for all possible decoded data types
type NostrEntityData = string | EventPointer | AddressPointer | ProfilePointer | Uint8Array;

export interface NostrEntity {
	type: "nevent" | "naddr" | "note" | "npub" | "nprofile";
	bech32: string;
	data: NostrEntityData;
}

/**
 * Parse text to find Nostr entity references (nostr:nevent1..., nostr:naddr1...)
 */
export function findNostrEntities(text: string): NostrEntity[] {
	const regex = /nostr:(nevent1|naddr1|note1|npub1|nprofile1)[\w]+/g;
	const matches = text.match(regex) || [];

	const entities: NostrEntity[] = [];

	for (const match of matches) {
		const bech32 = match.replace("nostr:", "");

		try {
			const decoded = nip19.decode(bech32);

			entities.push({
				type: decoded.type as NostrEntity["type"],
				bech32,
				data: decoded.data,
			});
		} catch (error) {
			console.warn(`Failed to decode Nostr entity: ${bech32}`, error);
		}
	}

	return entities;
}

/**
 * Replace Nostr entity references in text with placeholders for rendering
 */
export function replaceNostrEntities(
	text: string,
	replacer: (entity: NostrEntity, match: string) => string,
): string {
	const regex = /nostr:(nevent1|naddr1|note1|npub1|nprofile1)[\w]+/g;

	return text.replace(regex, (match) => {
		const bech32 = match.replace("nostr:", "");

		try {
			const decoded = nip19.decode(bech32);
			const entity: NostrEntity = {
				type: decoded.type as NostrEntity["type"],
				bech32,
				data: decoded.data,
			};

			return replacer(entity, match);
		} catch (error) {
			// If decode fails, return original match
			return match;
		}
	});
}

/**
 * Type guard to check if data is AddressPointer
 */
export function isAddressPointer(data: NostrEntityData): data is AddressPointer {
	return typeof data === "object" && data !== null && !(data instanceof Uint8Array) && "identifier" in data && "pubkey" in data && "kind" in data;
}


/**
 * Check if a Nostr entity is an NDKArticle (kind 30023)
 */
export function isArticleEntity(entity: NostrEntity): boolean {
	if (entity.type === "naddr" && entity.data) {
		if (isAddressPointer(entity.data)) {
			return entity.data.kind === 30023;
		}
	}

	// For nevent, we'd need to fetch the event to check its kind
	// This would require async operation
	return false;
}

/**
 * Type guard to check if data is EventPointer
 */
export function isEventPointer(data: NostrEntityData): data is EventPointer {
	return typeof data === "object" && data !== null && !(data instanceof Uint8Array) && "id" in data;
}

/**
 * Check if a Nostr entity is a Task (kind 1934)
 */
export function isTaskEntity(entity: NostrEntity): boolean {
	if (entity.type === "nevent" && entity.data) {
		if (isEventPointer(entity.data)) {
			return entity.data.kind === 1934;
		}
	}
	return false;
}

/**
 * Get display information for a Nostr entity
 */
export function getEntityDisplayInfo(entity: NostrEntity): {
	title: string;
	description: string;
	icon: string;
} {
	switch (entity.type) {
		case "naddr":
			if (isAddressPointer(entity.data)) {
				if (entity.data.kind === 30023) {
					return {
						title: "Specification Document",
						description: `View ${entity.data.identifier.toUpperCase() || "specification"}`,
						icon: "📄",
					};
				}
				return {
					title: "Parameterized Replaceable Event",
					description: `Kind ${entity.data.kind}`,
					icon: "🔗",
				};
			}
			return {
				title: "Parameterized Replaceable Event",
				description: "Kind unknown",
				icon: "🔗",
			};

		case "nevent":
			if (isEventPointer(entity.data)) {
				// Check if it's a task event
				if (entity.data.kind === 1934) {
					return {
						title: "Task",
						description: "View task details",
						icon: "✅",
					};
				}
			}
			return {
				title: "Event",
				description: "View Nostr event",
				icon: "⚡",
			};

		case "note":
			return {
				title: "Note",
				description: "View note",
				icon: "📝",
			};

		case "npub":
			return {
				title: "Public Key",
				description: "View profile",
				icon: "👤",
			};

		case "nprofile":
			return {
				title: "Profile",
				description: "View profile with relays",
				icon: "👤",
			};

		default:
			return {
				title: "Unknown Entity",
				description: entity.type,
				icon: "❓",
			};
	}
}
