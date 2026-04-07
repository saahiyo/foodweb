const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve static files (index.html, style.css, script.js)
app.use(express.static(path.join(__dirname)));

// Parse JSON body
app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const LAT = "19.07480";
const LNG = "72.88560";

const SWIGGY_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    'Referer': 'https://www.swiggy.com/restaurants',
    'Origin': 'https://www.swiggy.com',
    'Content-Type': 'application/json',
    '__fetch_req__': 'true',
    'platform': 'dweb',
    'accept': '*/*'
};

// Store cookies across requests to maintain session
let sessionCookies = '';

function mergeCookies(existingCookies, newSetCookieHeaders) {
    if (!newSetCookieHeaders) return existingCookies;
    
    const cookieMap = {};
    // Parse existing
    if (existingCookies) {
        existingCookies.split('; ').forEach(c => {
            const [key, ...val] = c.split('=');
            if (key) cookieMap[key.trim()] = val.join('=');
        });
    }
    // Parse new
    const headers = Array.isArray(newSetCookieHeaders) ? newSetCookieHeaders : [newSetCookieHeaders];
    headers.forEach(h => {
        const cookiePart = h.split(';')[0];
        const [key, ...val] = cookiePart.split('=');
        if (key) cookieMap[key.trim()] = val.join('=');
    });

    return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

// Initial listing
app.get('/api/restaurants', async (req, res) => {
    try {
        // Step 1: Hit swiggy.com to get initial cookies
        try {
            const homeRes = await axios.get('https://www.swiggy.com/', {
                headers: { 'User-Agent': SWIGGY_HEADERS['User-Agent'], 'Accept': 'text/html' },
                maxRedirects: 5,
                validateStatus: () => true
            });
            sessionCookies = mergeCookies(sessionCookies, homeRes.headers['set-cookie']);
            console.log("Session cookies after homepage:", sessionCookies ? sessionCookies.substring(0, 100) + '...' : 'None');
        } catch (e) {
            console.log("Homepage cookie fetch skipped:", e.message);
        }

        // Step 2: Fetch restaurant listing
        const url = `https://www.swiggy.com/dapi/restaurants/list/v5?lat=${LAT}&lng=${LNG}&is-seo-homepage-enabled=true&page_type=DESKTOP_WEB_LISTING`;
        const headers = { ...SWIGGY_HEADERS };
        if (sessionCookies) headers['Cookie'] = sessionCookies;

        const response = await axios.get(url, { headers, validateStatus: () => true });
        sessionCookies = mergeCookies(sessionCookies, response.headers['set-cookie']);

        const data = response.data?.data;
        console.log("Initial cards:", data?.cards?.length, "| pageOffset:", data?.pageOffset?.nextOffset?.substring(0, 30) + '...');
        
        res.json(response.data);
    } catch (error) {
        console.error("Initial fetch error:", error.message);
        res.status(500).json({ error: "Failed to fetch data", details: error.message });
    }
});

// Pagination
app.post('/api/restaurants/update', async (req, res) => {
    try {
        const body = req.body;
        const url = 'https://www.swiggy.com/dapi/restaurants/list/update';

        const payload = {
            lat: LAT,
            lng: LNG,
            nextOffset: body.nextOffset || "",
            widgetOffset: body.widgetOffset || {},
            filters: body.filters || {},
            seoParams: {
                seoUrl: "https://www.swiggy.com/restaurants",
                pageType: "FOOD_HOMEPAGE",
                apiName: "FoodHomePage",
                businessLine: "FOOD"
            },
            page_type: "DESKTOP_WEB_LISTING",
            _csrf: ""
        };

        const headers = { ...SWIGGY_HEADERS };
        if (sessionCookies) headers['Cookie'] = sessionCookies;

        console.log("Paginating... nextOffset:", payload.nextOffset.substring(0, 30) + '...');

        const response = await axios.post(url, payload, { headers, validateStatus: () => true });
        sessionCookies = mergeCookies(sessionCookies, response.headers['set-cookie']);

        const data = response.data?.data;
        const cardCount = data?.cards?.length || 0;
        let restCount = 0;
        data?.cards?.forEach(c => {
            const rests = c.card?.card?.gridElements?.infoWithStyle?.restaurants;
            if (rests) restCount += rests.length;
        });

        console.log(`Pagination result: ${cardCount} cards, ${restCount} restaurants, next: ${data?.pageOffset?.nextOffset?.substring(0, 20) || 'none'}...`);

        res.json(response.data);
    } catch (error) {
        console.error("Update fetch error:", error.response?.status, error.message);
        res.status(500).json({ error: "Failed to fetch next page", details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`\nServer running at http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/index.html in your browser\n`);
});
