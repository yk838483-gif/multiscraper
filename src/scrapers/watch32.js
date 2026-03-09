const fetch = require('node-fetch');
const cheerio = require('cheerio');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
// Update this if Vegamovies changes their main domain
const BASE_URL = "https://vegamovies.is"; 

async function getTMDBTitle(tmdbId, mediaType) {
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    const url = `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return mediaType === 'tv' ? data.name : data.title;
    } catch (err) {
        return null;
    }
}

async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    try {
        const title = await getTMDBTitle(tmdbId, mediaType);
        if (!title) return [];

        console.log(`[Vegamovies] Searching for: ${title}`);
        
        // Using our stealth fetcher from the KissKH days
        const { gotScraping } = await import('got-scraping');
        
        const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(title)}`;
        const response = await gotScraping({
            url: searchUrl,
            responseType: 'text',
        });

        const $ = cheerio.load(response.body);
        const streams = [];

        // Find the search results
        $('article').each((i, element) => {
            const postTitle = $(element).find('h2.title a').text();
            const postLink = $(element).find('h2.title a').attr('href');
            
            // Basic title matching to avoid random results
            if (postTitle.toLowerCase().includes(title.toLowerCase())) {
                
                // Vegamovies usually provides entire download pages rather than direct stream links.
                // You can parse the inner page here, but for now, we return the page link as a web-ready stream.
                streams.push({
                    name: "Vegamovies",
                    title: `[Web View]\n${postTitle}`,
                    url: postLink,
                    behaviorHints: { notWebReady: false } 
                });
            }
        });

        console.log(`[Vegamovies] Found ${streams.length} matches.`);
        return streams;

    } catch (err) {
        console.error(`[Vegamovies] Master Error: ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
