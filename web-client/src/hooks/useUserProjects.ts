import { NDKProject, useNDKCurrentUser, useSubscribe } from "@nostr-dev-kit/ndk-hooks";

/**
 * Hook to fetch all projects for the current user
 * @returns Array of NDKProject events
 */
export function useUserProjects() {
    const currentUser = useNDKCurrentUser();

    const { events: projects = [] } = useSubscribe<NDKProject>(
        currentUser
            ? [
                  {
                      kinds: [NDKProject.kind],
                      authors: [currentUser.pubkey],
                      limit: 50,
                  },
              ]
            : false,
        { wrap: true },
        [currentUser?.pubkey]
    );

    return projects;
}
