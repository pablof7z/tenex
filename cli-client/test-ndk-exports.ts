import * as NDK from '@nostr-dev-kit/ndk';
import * as NDKHooks from '@nostr-dev-kit/ndk-hooks';

console.log('=== NDK exports ===');
console.log(Object.keys(NDK).sort().join('\n'));

console.log('\n=== NDKHooks exports ===');
console.log(Object.keys(NDKHooks).sort().join('\n'));

// Check specifically for NDKAgent
console.log('\n=== NDKAgent check ===');
console.log('NDKAgent in NDK:', 'NDKAgent' in NDK);
console.log('NDKAgent in NDKHooks:', 'NDKAgent' in NDKHooks);