/**
 * Common test fixtures
 */

export const testFixtures = {
    /**
     * Sample timestamps
     */
    timestamps: {
        now: 1704067200,
        oneHourAgo: 1704063600,
        oneDayAgo: 1703980800,
        oneWeekAgo: 1703462400,
    },

    /**
     * Sample IDs
     */
    ids: {
        event: "e1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        user: "u1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        project: "p1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    },

    /**
     * Sample keys
     */
    keys: {
        pubkey: "fa984bd7dbb282f07e16e7ae87b26a2a7b9b90b7246a44771f0cf5ae58018f52",
        npub: "npub1l2vyh47mk2p0qlsku7hg0vn29faehy9hy34ygaclpn66ukqp3afqutajft",
        nsec: "nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5",
    },

    /**
     * Sample relay URLs
     */
    relays: {
        primary: "wss://relay.damus.io",
        secondary: "wss://relay.primal.net",
        backup: "wss://nos.lol",
        test: "wss://relay.test.local",
    },

    /**
     * Sample project data
     */
    projects: {
        simple: {
            name: "Simple App",
            naddr: "naddr1test...",
            repo: "https://github.com/test/simple-app",
            description: "A simple test application",
        },
        complex: {
            name: "Complex System",
            naddr: "naddr2test...",
            repo: "https://github.com/test/complex-system",
            description: "A complex multi-component system",
        },
    },

    /**
     * Sample user profiles
     */
    profiles: {
        alice: {
            name: "Alice",
            displayName: "Alice Test",
            about: "Test user Alice",
            image: "https://example.com/alice.jpg",
            nip05: "alice@test.com",
        },
        bob: {
            name: "Bob",
            displayName: "Bob Test",
            about: "Test user Bob",
            image: "https://example.com/bob.jpg",
            nip05: "bob@test.com",
        },
    },

    /**
     * Sample content
     */
    content: {
        shortText: "Hello, world!",
        longText:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        markdown: "# Hello\n\nThis is **bold** and this is *italic*.\n\n- Item 1\n- Item 2",
        code: '```javascript\nconsole.log("Hello, world!");\n```',
        withEntities:
            "Check out this event: nostr:nevent1test... and this user: nostr:npub1test...",
    },
};
