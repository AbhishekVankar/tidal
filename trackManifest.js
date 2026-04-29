const parsedUrl = new URL(url);
const id = parsedUrl.pathname.split("/").pop();
const formats = parsedUrl.searchParams.getAll("formats");

// Determine quality
let quality = "LOW";
if (formats.includes("FLAC_HIRES")) quality = "HI_RES_LOSSLESS";
else if (formats.includes("FLAC")) quality = "LOSSLESS";
else if (formats.includes("AACLC")) quality = "HIGH";
else if (formats.includes("HEAACV1")) quality = "LOW";

console.log("TrackManifest intercept:", id, "Quality:", quality);

// Request config
const requestOptions = {
    method: "GET",
    redirect: "follow"
};

// Fetch from your backend
const monoResponse = await originalFetch.call(
    globalThis,
    localStorage.getItem("streamurl") + "/track/?id=" + id + "&quality=" + quality,
    requestOptions
);

const y = await monoResponse.json();

// Construct response
const data = {
    data: {
        id: y.data.trackId,
        type: "trackManifests",
        attributes: {
            trackPresentation: "Full",
            uri: "data:" + y.data.manifestMimeType + ";base64," + y.data.manifest,
            hash: y.data.manifestHash,
            formats: formats,
            albumAudioNormalizationData: {
                replayGain: y.data.albumReplayGain,
                peakAmplitude: y.data.albumPeakAmplitude
            },
            trackAudioNormalizationData: {
                replayGain: y.data.trackReplayGain,
                peakAmplitude: y.data.trackPeakAmplitude
            }
        }
    },
    links: {
        self: `/trackManifests/${id}?uriScheme=DATA&adaptive=true&formats=${encodeURIComponent(
            formats.join(",")
        )}&usage=PLAYBACK&manifestType=MPEG_DASH`
    }
};

// Return modified response
return new Response(JSON.stringify(data), {
    status: monoResponse.status,
    statusText: monoResponse.statusText,
    headers: monoResponse.headers
});
