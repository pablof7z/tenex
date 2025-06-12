import { type NDKProject, useEvent } from "@nostr-dev-kit/ndk-hooks";

export function useProject(encodedProjectId: string | undefined) {
	const event = useEvent<NDKProject>(encodedProjectId || false);
	return event as NDKProject | null;
}
