const fetch = require('node-fetch');
const cheerio = require('cheerio');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

// The master list of Vegamovies mirrors. It will try them one by one.
const DOMAINS = [
    "https://vegamovies.is",
    "https://vegamovies.nl",
    "https://vegamovies.to",
    "https://vegamovies.vg",
    "https://vegamovies.rsvp"
];

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

        const { gotScraping } = await import('got-scraping');
        
        // Loop through the domains until one works
        for (const domain of DOMAINS) {
            console.log(`[Vegamovies] Trying domain: ${domain} for "${title}"`);
            
            try {
                const searchUrl = `${domain}/?s=${encodeURIComponent(title)}`;
                const response = await gotScraping({
                    url: searchUrl,
                    responseType: 'text',
                    timeout: { request: 5000 } // Don't hang forever if the domain is dead
                });

                const $ = cheerio.load(response.body);
                
                // THE SPYGLASS: Check the title of the page we actually received
                const pageTitle = $('title').text().toLowerCase();
                console.log(`[Vegamovies] Received Page Title: "${$('title').text()}"`);

                // If Cloudflare blocked us, skip to the next domain
                if (pageTitle.includes('just a moment') || pageTitle.includes('attention required') || pageTitle.includes('cloudflare')) {
                    console.log(`[Vegamovies] Hit Cloudflare wall on ${domain}. Trying next...`);
                    continue; 
                }

                const streams = [];

                // Broader search targets to catch different website theme layouts
                $('.post-item, article, .blog-item').each((i, element) => {
                    // Find the first link inside a header
                    const titleElement = $(element).find('h2 a, h3 a, .title a').first();
                    const postTitle = titleElement.text().trim();
                    const postLink = titleElement.attr('href');
                    
                    if (postTitle && postLink && postTitle.toLowerCase().includes(title.toLowerCase())) {
                        streams.push({
                            name: "Vegamovies",
                            title: `[Web View]\n${postTitle}`,
                            url: postLink,
                            behaviorHints: { notWebReady: false } 
                        });
                    }
                });

                // If we found streams, return them immediately and stop trying other domains
                if (streams.length > 0) {
                    console.log(`[Vegamovies] BINGO! Found ${streams.length} matches on ${domain}.`);
                    return streams;
                } else {
                    console.log(`[Vegamovies] No matching movies found on ${domain} (Site loaded, but search was empty).`);
                    // We successfully loaded the site but there were no movies, so we can break the loop.
                    break;
                }

            } catch (fetchError) {
                console.log(`[Vegamovies] Domain ${domain} failed to load. Moving to next...`);
            }
        }

        return []; // Return empty if all domains failed

    } catch (err) {
        console.error(`[Vegamovies] Master Error: ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
