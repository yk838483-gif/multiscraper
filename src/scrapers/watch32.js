const fetch = require('node-fetch');

const MAIN_URL = "https://kisskh.id";
const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

// The secret Google Scripts used to generate unlock tokens
const VIDEO_KEY_URL = "https://script.google.com/macros/s/AKfycbzn8B31PuDxzaMa9_CQ0VGEDasFqfzI5bXvjaIZH4DM8DNq9q6xj1ALvZNz_JT3jF0suA/exec?id=";
const SUB_KEY_URL = "https://script.google.com/macros/s/AKfycbyq6hTj0ZhlinYC6xbggtgo166tp6XaDKBCGtnYk8uOfYBUFwwxBui0sGXiu_zIFmA/exec?id=";

async function getTMDBDetails(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        return { title, year };
    } catch (err) {
        return { title: `TMDB ID ${tmdbId}`, year: null };
    }
}

async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    console.log(`[KissKH] Fetching streams for TMDB ID: ${tmdbId}`);

    try {
        const mediaInfo = await getTMDBDetails(tmdbId, mediaType);
        
        // 1. Search KissKH Database
        const searchUrl = `${MAIN_URL}/api/DramaList/Search?q=${encodeURIComponent(mediaInfo.title)}&type=0`;
        const searchRes = await fetch(searchUrl, {
            headers: { "Referer": `${MAIN_URL}/` }
        });
        const searchData = await searchRes.json();

        if (!searchData || searchData.length === 0) {
            console.log(`[KissKH] No search results found for ${mediaInfo.title}`);
            return [];
        }

        // Find the best match (basic title match)
        const match = searchData.find(item => item.title.toLowerCase().includes(mediaInfo.title.toLowerCase()));
        if (!match) {
            console.log(`[KissKH] No exact title match found.`);
            return [];
        }

        // 2. Get Details to find the correct Episode ID
        const formattedTitle = match.title.replace(/[^a-zA-Z0-9]/g, "-");
        const detailsUrl = `${MAIN_URL}/api/DramaList/Drama/${match.id}?isq=false`;
        const detailsRes = await fetch(detailsUrl, {
            headers: { "Referer": `${MAIN_URL}/Drama/${formattedTitle}?id=${match.id}` }
        });
        const detailsData = await detailsRes.json();

        if (!detailsData || !detailsData.episodes || detailsData.episodes.length === 0) return [];

        let targetEpisode = null;
        if (mediaType === 'tv') {
            // KissKH usually lists episodes absolutely (1, 2, 3) rather than by season. 
            // For a basic implementation, we try to match the episode number directly.
            // Note: If a show has multiple seasons on KissKH, they are usually separate entries entirely.
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
        const keyRes = await fetch(keyReqUrl);
        const keyData = await keyRes.json();
        const kkey = keyData.key;

        if (!kkey) {
            console.log(`[KissKH] Failed to generate security token.`);
            return [];
        }

        // 4. Get Final Video Link
        const videoApiUrl = `${MAIN_URL}/api/DramaList/Episode/${targetEpisode.id}.png?err=false&ts=&time=&kkey=${kkey}`;
        const videoReferer = `${MAIN_URL}/Drama/${formattedTitle}/Episode-${targetEpisode.number}?id=${match.id}&ep=${targetEpisode.id}&page=0&pageSize=100`;

        const videoRes = await fetch(videoApiUrl, {
            headers: { "Referer": videoReferer }
        });
        const videoData = await videoRes.json();

        const streams = [];

        // Add primary video
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
                            "Referer": `${MAIN_URL}/`
                        }
                    }
                }
            });
        }

        // Add backup ThirdParty video if it exists
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
                            "Referer": `${MAIN_URL}/`
                        }
                    }
                }
            });
        }

        console.log(`[KissKH] Found ${streams.length} streams!`);
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
