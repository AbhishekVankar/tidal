(function () {
    console.log('preload script loaded')

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : "");

        // Log API requests
        if (url.includes('api.tidal.com') || url.includes('/v1/') || url.includes('/v2/')) {
            console.log("[FETCH URL]:", url);
        }

        // 1. Subscription Modification
        if (url.includes('/v1/users/') && url.includes('/subscription')) {
            try {
                const response = await originalFetch.apply(this, args);
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();

                console.log("Original Subscription Response:", data);

                data.startDate = "2022-06-08T14:16:13.942+0000";
                data.validUntil = "2033-07-08T14:16:13.942+0000";
                data.status = "ACTIVE";
                data.highestSoundQuality = "LOSSLESS";
                data.premiumAccess = true;
                data.canGetTrial = false;
                if (data.subscription) {
                    data.subscription.type = "PREMIUM_PLUS";
                }

                console.log("Modified Subscription Response:", data);

                return new Response(JSON.stringify(data), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch (e) {
                console.log("Error modifying fetch response:", e.message);
            }
        }
        // 2. User Profile Modification
        if (url.includes('/v1/users/') && !url.includes('/subscription') && !url.includes('/favorites') && !url.includes('/clients') && !url.includes('sessions')) {
            try {
                const response = await originalFetch.apply(this, args);
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();

                if (data.id) {
                    if (typeof data.level !== "undefined") data.level = "PREMIUM_PLUS";
                    if (typeof data.tier !== "undefined") data.tier = "HIFI";
                }

                return new Response(JSON.stringify(data), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch (e) {
                // ignore
            }
        }
        // 3. Sessions Modification
        if (url.includes('/v1/sessions')) {
            try {
                const response = await originalFetch.apply(this, args);
                const clonedResponse = response.clone();
                const data = await clonedResponse.json();

                if (data.client) {
                    data.client.authorizedForOffline = true;
                    data.client.highestSoundQuality = "LOSSLESS";
                    data.client.supportedVideoQualities = ["AUDIO_ONLY", "LOW", "MEDIUM", "HIGH"];
                    data.client.tier = "HIFI";
                }

                return new Response(JSON.stringify(data), {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch (e) {
                // ignore
            }
        }
        // 4. Intercept video (remove preview limit)
        if (url.includes('/v1/videos/') && url.includes('/playbackinfo')) {
            try {
                const getId = (url) => new URL(url).pathname.split("/")[3];
                const id = getId(url);

                console.log("VideoPlaybackInfo intercept:", id);

                const requestOptions = {
                    method: "GET",
                    redirect: "follow"
                };

                const monoResponse = await originalFetch.call(window, localStorage.getItem('streamurl') + "/video/?id=" + id, requestOptions);
                const y = await monoResponse.json();

                const data = {
                    "videoId": id,
                    "streamType": y.video.streamType,
                    "assetPresentation": y.video.assetPresentation,
                    "videoQuality": y.video.videoQuality,
                    "streamingSessionId": crypto.randomUUID(),
                    "manifestMimeType": y.video.manifestMimeType,
                    "manifestHash": y.video.manifestHash,
                    "manifest": y.video.manifest
                }

                return new Response(JSON.stringify(data), {
                    status: monoResponse.status,
                    statusText: monoResponse.statusText,
                    headers: monoResponse.headers
                });

            } catch (e) {
                console.log("VideoPlaybackInfo intercept error:", e.message);
            }
        }
        // 5. Playback / PlaybackInfo bypassing 30-second previews
        if (url.includes('/playbackinfopostpaywall') || url.includes('/playbackinfo') || url.includes('/manifest')) {
            try {
                const response = await originalFetch.apply(this, args);
                const clonedResponse = response.clone();

                // Tidal often uses Base64 encoded XML/JSON for track manifests
                const text = await clonedResponse.text();

                let modifiedText = text;

                // Sometimes Tidal returns JSON for playback info
                if (text.startsWith('{')) {
                    try {
                        const data = JSON.parse(text);
                        console.log("Original Playback Info:", data);

                        // Strip "PREVIEW" limits from JSON
                        if (data.audioQuality) {
                            if (data.audioQuality.includes('PREVIEW')) {
                                // Try tricking the client into believing it's not a preview
                                // Sometimes the actual highest stream is still attached but hidden
                                data.audioQuality = "LOSSLESS";
                            }
                        }
                        if (data.trackId && data.assetPresentation) {
                            data.assetPresentation = "FULL";
                        }
                        if (data.streamingSessionId) {
                            // The actual URL might still point to a 30s bucket on their CDN.
                            // This is harder to modify if the server only generated a 30s token.
                        }

                        console.log("Modified Playback Info:", data);
                        modifiedText = JSON.stringify(data);
                    } catch (e) { }
                }

                return new Response(modifiedText, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                });
            } catch (e) {
                console.log("Error modifying playback:", e.message);
            }
        }
        // 6. Intercept trackManifests (remove preview limit)
        if (url.includes('/v2/trackManifests/')) {
            try {
                const parsedUrl = new URL(url);

                // Extract track ID
                const pathParts = parsedUrl.pathname.split('/');
                const id = pathParts[pathParts.length - 1];

                // Keep all original query params
                const query = parsedUrl.searchParams.toString();

                // Build new URL
                const newUrl = `${localStorage.getItem('streamurl')}/trackManifests/?id=${id}&${query}`;
                const requestOptions = {
                    method: "GET",
                    redirect: "follow"
                };

                const monoResponse = await originalFetch.call(globalThis, newUrl, requestOptions);
                const data = await monoResponse.json();
                return new Response(JSON.stringify(data.data), {
                    status: monoResponse.status,
                    statusText: monoResponse.statusText,
                    headers: monoResponse.headers
                });

            } catch (e) {
                console.log("TrackManifest intercept error:", e.message);
            }
        }
        // Default fetch behavior for other requests
        return originalFetch.apply(this, args);
    };

    // Intercept XMLHttpRequest (XHR)
    const originalXhrOpen = globalThis.XMLHttpRequest.prototype.open;

    globalThis.XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        this._requestUrl = typeof url === 'string' ? url : url.toString();
        if (this._requestUrl.includes('api.tidal.com') || this._requestUrl.includes('/v1/') || this._requestUrl.includes('/v2/')) {
            console.log("[XHR URL]:", this._requestUrl.split('?')[0]);
        }
        return originalXhrOpen.call(this, method, url, ...rest);
    };

    globalThis.addEventListener('DOMContentLoaded', () => {
        console.log('content loaded');

        if (typeof trustedTypes !== 'undefined' && trustedTypes.defaultPolicy === null) {
            let s = s => s, [p, q, r] = [s, s, s];
            s = trustedTypes;
            s.createPolicy('default', { createHTML: s => p(s), createScriptURL: s => q(s), createScript: s => r(s) });
            s.$Ω = s.createPolicy;
            s.createPolicy = function (a, b) {
                if (a === 'default' && s) {
                    s = 0;
                    const { createHTML: x, createScriptURL: y, createScript: z } = b;
                    x && (p = x);
                    y && (q = y);
                    z && (r = z);
                    return this.defaultPolicy;
                }
                return this.$Ω(...arguments);
            };
        }
    });

    function clickButton(label) {
        const btn = document.querySelector(`button[aria-label*="${label}"]`);
        if (btn) btn.click();
    }

    window.__TAURI__.event.listen("media-play-pause", () => {
        clickButton("Play");
    });

    window.__TAURI__.event.listen("media-next", () => {
        clickButton("Next");
    });

    window.__TAURI__.event.listen("media-prev", () => {
        clickButton("Previous");
    });

})()