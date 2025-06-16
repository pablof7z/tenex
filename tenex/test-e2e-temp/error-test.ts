import { TenexChat } from "/Users/pablofernandez/test123/TENEX-pfkmc9/cli-client/src/chat.js";
import { getNDK } from "/Users/pablofernandez/test123/TENEX-pfkmc9/cli-client/src/ndk-setup.js";

const nsec = "bf406c63f30f2882bbfc95fb6ec1a73ca2bedd0bde3f30435e5f683975d3bf80";
const ndk = await getNDK({ nsec });

try {
    const _projectEvent = await ndk.fetchEvent("naddr1invalid");
    console.log("Should not reach here");
} catch (_error) {
    console.log("ERROR_HANDLED:Invalid naddr");
}
