const fetch = require('node-fetch');
const cheerio = require('cheerio');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";

const DOMAINS = [
    "https://vegamovies.hot",
    "https://vegamovies.yt",
    "https://vegamovies.pe",
    "https://vegamovies.am",
    "https://vegamovies.la",
    "https://vegamovies.vg",
    "https://vegamovies.to",
    "https://vegamovies.is",
    "https://vegamovies.nl",
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
        
        for (const domain of DOMAINS) {
            console.log(`[Vegamovies] Trying domain: ${domain} for "${title}"`);
            
            try {
                // Fix: WordPress search usually prefers + instead of %20
                const searchFormat = title.replace(/\s+/g, '+');
                const searchUrl = `${domain}/?s=${searchFormat}`;
                
                const response = await gotScraping({
                    url: searchUrl,
                    responseType: 'text',
                    timeout: { request: 8000 }
                });

                const $ = cheerio.load(response.body);
                const pageTitle = $('title').text().toLowerCase();
                
                if (pageTitle.includes('just a moment') || pageTitle.includes('cloudflare') || pageTitle.length < 15) {
                    console.log(`[Vegamovies] Hit Cloudflare or Parked Domain on ${domain}. Moving to next...`);
                    continue; 
                }

                const streams = [];
                const uniqueLinks = new Set(); 

                $('a').each((i, element) => {
                    const linkText = $(element).text().trim();
                    const linkTitleAttr = $(element).attr('title') || "";
                    const imgAlt = $(element).find('img').attr('alt') || ""; // Grab image names!
                    const postLink = $(element).attr('href') || "";
                    
                    // Combine all possible text sources into one string to check
                    const allText = `${linkText} ${linkTitleAttr} ${imgAlt} ${postLink}`.toLowerCase();
                    
                    if (postLink && allText.includes(title.toLowerCase()) && postLink.includes(domain)) {
                        
                        if (!uniqueLinks.has(postLink)) {
                            uniqueLinks.add(postLink);
                            
                            const displayTitle = linkText.length > 3 ? linkText : imgAlt || title;

                            streams.push({
                                name: "Vegamovies",
                                title: `[Web View]\n${displayTitle.trim()}`,
                                url: postLink,
                                behaviorHints: { notWebReady: false } 
                            });
                        }
                    }
                });

                if (streams.length > 0) {
                    console.log(`[Vegamovies] BINGO! Found ${streams.length} matches on ${domain}.`);
                    return streams; 
                } else {
                    console.log(`[Vegamovies] 0 matches on ${domain}. (Maybe movie not on site?)`);
                    continue; 
                }

            } catch (fetchError) {
                console.log(`[Vegamovies] Domain ${domain} failed to load. Moving to next...`);
            }
        }

        return []; 

    } catch (err) {
        console.error(`[Vegamovies] Master Error: ${err.message}`);
        return [];
    }
}

module.exports = { getStreams };
