
                    import { TenexChat } from "/Users/pablofernandez/test123/TENEX-pfkmc9/cli-client/src/chat.js";
                    import { getNDK } from "/Users/pablofernandez/test123/TENEX-pfkmc9/cli-client/src/ndk-setup.js";
                    
                    const nsec = "318feefa3bce6c0e6c8a415eb6d6df537d21675aa88be0351883c695f0d6863b";
                    const ndk = await getNDK({ nsec });
                    
                    try {
                        const projectEvent = await ndk.fetchEvent("naddr1invalid");
                        console.log("Should not reach here");
                    } catch (error) {
                        console.log("ERROR_HANDLED:Invalid naddr");
                    }
                