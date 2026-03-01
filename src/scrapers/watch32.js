const fetch = require('node-fetch');

const MAIN_URL = "https://kisskh.id";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const VIDEO_KEY_URL = "https://script.google.com/macros/s/AKfycbzn8B31PuDxzaMa9_CQ0VGEDasFqfzI5bXvjaIZH4DM8DNq9q6xj1ALvZNz_JT3jF0suA/exec?id=";

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0",
    "Accept": "application/json, text/plain, */*",
    "Referer": `${MAIN_URL}/`
};

// A custom fetch that automatically kills the connection if it takes longer than 5 seconds
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Cloudflare Timeout (Anti-Bot Trap)")), timeoutMs);
    });
    return Promise.race([fetch(url, options), timeoutPromise]);
}

async function safeFetchJson(url, options = {}) {
    const res = await fetchWithTimeout(url, options);
    const text = await res.text();
    if (text.trim().startsWith('<')) {
        throw new Error("Blocked by Cloudflare (Received HTML)");
    }
    return JSON.parse(text);
}

async function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetchWithTimeout(url);
        const data = await res.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        return { title };
    } catch (err) {
        return { title: `TMDB ID ${tmdbId}` };
    }
}

async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    console.log(`[KissKH] Fetching streams for TMDB ID: ${tmdbId}`);

    try {
        const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
        
        // 1. Search KissKH Database
        const searchUrl = `${MAIN_URL}/api/DramaList/Search?q=${encodeURIComponent(mediaInfo.title)}&type=0`;
        const searchData = await safeFetchJson(searchUrl, { headers: HEADERS });

        if (!searchData || searchData.length === 0) {
            console.log(`[KissKH] No search results found for ${mediaInfo.title}`);
            return [];
        }

        // Find the best match
        const match = searchData.find(item => item.title.toLowerCase().includes(mediaInfo.title.toLowerCase()));
        if (!match) {
            console.log(`[KissKH] No exact title match found for ${mediaInfo.title}`);
            return [];
        }

        // 2. Get Details to find the correct Episode ID
        const formattedTitle = match.title.replace(/[^a-zA-Z0-9]/g, "-");
        const detailsUrl = `${MAIN_URL}/api/DramaList/Drama/${match.id}?isq=false`;
        
        const detailsHeaders = { ...HEADERS, "Referer": `${MAIN_URL}/Drama/${formattedTitle}?id=${match.id}` };
        const detailsData = await safeFetchJson(detailsUrl, { headers: detailsHeaders });

        if (!detailsData || !detailsData.episodes || detailsData.episodes.length === 0) return [];

        let targetEpisode = null;
        if (mediaType === 'tv') {
            targetEpisode = detailsData.episodes.find(e => Math.floor(e.number) === parseInt(episodeNum));
        } else {
            targetEpisode = detailsData.episodes[0];
        }

        if (!targetEpisode) {
            console.log(`[KissKH] Episode ${episodeNum} not found in their list.`);
            return [];
        }

        // 3. Generate Video Unlock Token (kkey)
        const keyReqUrl = `${VIDEO_KEY_URL}${targetEpisode.id}&version=2.8.10`;
        const keyData = await safeFetchJson(keyReqUrl, { headers: HEADERS });
        const kkey = keyData.key;

        if (!kkey) {
            console.log(`[KissKH] Failed to generate security token.`);
            return [];
        }

        // 4. Get Final Video Link
        const videoApiUrl = `${MAIN_URL}/api/DramaList/Episode/${targetEpisode.id}.png?err=false&ts=&time=&kkey=${kkey}`;
        const videoReferer = `${MAIN_URL}/Drama/${formattedTitle}/Episode-${targetEpisode.number}?id=${match.id}&ep=${targetEpisode.id}&page=0&pageSize=100`;

        const videoHeaders = { ...HEADERS, "Referer": videoReferer };
        const videoData = await safeFetchJson(videoApiUrl, { headers: videoHeaders });

        const streams = [];

        if (videoData.Video) {
            streams.push({
                name: "KissKH",
                title: `${mediaInfo.title} - HD`,
                url: videoData.Video,
                behaviorHints: {
                    notWebReady: true,
                    proxyHeaders: {
                        request: {
                            "Origin": MAIN_URL,
                            "Referer": `${MAIN_URL}/`,
                            "User-Agent": HEADERS["User-Agent"]
                        }
                    }
                }
            });
        }

        if (videoData.ThirdParty) {
             streams.push({
                name: "KissKH (Alt)",
                title: `${mediaInfo.title} - Alt Server`,
                url: videoData.ThirdParty,
                 behaviorHints: {
                    notWebReady: true,
                    proxyHeaders: {
                        request: {
                            "Origin": MAIN_URL,
                            "Referer": `${MAIN_URL}/`,
                            "User-Agent": HEADERS["User-Agent"]
                        }
                    }
                }
            });
        }

        console.log(`[KissKH] Successfully extracted ${streams.length} streams!`);
        return streams;

    } catch (error) {
        console.error(`[KissKH] Master Error: ${error.message}`);
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
