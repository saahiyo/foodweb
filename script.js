// Swiggy API Configuration - Pointing to local Proxy
const PROXY_API_URL = "http://localhost:3000/api/restaurants";
const PROXY_UPDATE_URL = "http://localhost:3000/api/restaurants/update";
const IMG_CDN_URL = "https://media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto,w_660/";

// DOM Elements
const cuisineList = document.getElementById('cuisine-list');
const topBrandsList = document.getElementById('top-brands-list');
const restaurantList = document.getElementById('restaurant-list');
const cuisineSection = document.getElementById('cuisine-section');
const topBrandsSection = document.getElementById('top-brands-section');
const restaurantCount = document.getElementById('restaurant-count');

// Pagination state
let paginationState = {
    nextOffset: "",
    widgetOffset: null,
    filters: {},
    seoParams: {},
    isLoading: false,
    hasMore: true
};

// Track all seen restaurant IDs for deduplication
const seenIds = new Set();
let totalRestaurants = 0;

// Utility to scroll horizontal sections
window.scrollSection = (id, amount) => {
    const el = document.getElementById(id);
    el.scrollBy({ left: amount, behavior: 'smooth' });
};

// Handle Button visibility based on scroll
function updateScrollButtons(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const section = el.closest('section');
    if (!section) return;
    const leftBtn = section.querySelector('[data-dir="left"]');
    const rightBtn = section.querySelector('[data-dir="right"]');

    if (!leftBtn || !rightBtn) return;

    const isAtStart = el.scrollLeft <= 10;
    const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;

    leftBtn.classList.toggle('disabled', isAtStart);
    rightBtn.classList.toggle('disabled', isAtEnd);
}

// Add scroll listeners to horizontal containers
[cuisineList, topBrandsList].forEach(el => {
    if (!el) return;
    el.addEventListener('scroll', () => updateScrollButtons(el.id));
    setTimeout(() => updateScrollButtons(el.id), 100);
});

// ===== INFINITE SCROLL =====
function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        // Check if we're near the bottom (within 800px)
        const scrolledTo = window.innerHeight + window.scrollY;
        const threshold = document.body.scrollHeight - 800;

        if (scrolledTo >= threshold && !paginationState.isLoading && paginationState.hasMore) {
            loadMoreRestaurants();
        }
    });
}

// ===== INIT =====
async function init() {
    try {
        console.log("Fetching real-time data from local proxy...");
        const response = await fetch(PROXY_API_URL);
        if (!response.ok) throw new Error("Local server not reachable");
        const json = await response.json();
        
        if (json.data) {
            console.log("API Response cards count:", json.data.cards?.length);
            renderInitialData(json.data);
            setupInfiniteScroll();
        } else {
            throw new Error("Invalid API response format");
        }
    } catch (error) {
        console.warn("Express Proxy failed. Falling back to Mock Data:", error.message);
        renderInitialData(MOCK_DATA);
    }
}

function renderInitialData(data) {
    const cards = data?.cards || [];

    // 1. "What's on your mind?" (Cuisines)
    const cuisineCard = cards.find(c => c.card?.card?.id === "whats_on_your_mind");
    if (cuisineCard) {
        const info = cuisineCard.card.card.imageGridCards?.info || [];
        cuisineList.innerHTML = info.map(item => `
            <div class="category-item" title="${item.action?.text || ""}">
                <div class="category-img-wrapper">
                    <img src="${IMG_CDN_URL}${item.imageId}" alt="${item.accessibility?.altText || ''}">
                </div>
            </div>
        `).join('');
    } else {
        cuisineSection.style.display = 'none';
    }

    // 2. Top Brands
    const topBrandsCard = cards.find(c => c.card?.card?.id === "top_brands_for_you");
    if (topBrandsCard) {
        const restaurants = topBrandsCard.card.card.gridElements?.infoWithStyle?.restaurants || [];
        topBrandsList.innerHTML = restaurants.map(res => createRestaurantCard(res.info, true)).join('');
    } else {
        topBrandsSection.style.display = 'none';
    }

    // 3. Main Listing — Collect ALL restaurants from initial response
    const newRestaurants = extractRestaurants(cards);
    console.log(`Initial load: ${newRestaurants.length} unique restaurants`);
    
    if (newRestaurants.length > 0) {
        restaurantList.innerHTML = newRestaurants.map(info => createRestaurantCard(info)).join('');
    }

    // Extract pagination offsets from this response
    extractPaginationOffsets(data);

    updateCountBadge();

    setTimeout(() => {
        updateScrollButtons('cuisine-list');
        updateScrollButtons('top-brands-list');
    }, 300);

    if (window.lucide) lucide.createIcons();
}

function extractRestaurants(cards) {
    const newRestaurants = [];

    cards.forEach(card => {
        const innerCard = card.card?.card;
        
        // Direct restaurants in gridElements
        if (innerCard?.gridElements?.infoWithStyle?.restaurants) {
            innerCard.gridElements.infoWithStyle.restaurants.forEach(res => {
                if (res.info?.id && !seenIds.has(res.info.id)) {
                    seenIds.add(res.info.id);
                    newRestaurants.push(res.info);
                    totalRestaurants++;
                }
            });
        }

        // Nested inside groupedCard
        if (innerCard?.groupedCard?.cardGroupMap?.REGULAR?.cards) {
            innerCard.groupedCard.cardGroupMap.REGULAR.cards.forEach(innerC => {
                const rests = innerC.card?.card?.gridElements?.infoWithStyle?.restaurants;
                if (rests) {
                    rests.forEach(res => {
                        if (res.info?.id && !seenIds.has(res.info.id)) {
                            seenIds.add(res.info.id);
                            newRestaurants.push(res.info);
                            totalRestaurants++;
                        }
                    });
                }
            });
        }
    });

    return newRestaurants;
}

function extractPaginationOffsets(data) {
    // The Swiggy API returns pagination in data.pageOffset
    if (data?.pageOffset) {
        paginationState.nextOffset = data.pageOffset.nextOffset || "";
        paginationState.widgetOffset = data.pageOffset.widgetOffset || {};
        paginationState.hasMore = !!data.pageOffset.nextOffset;
        console.log("Pagination nextOffset:", paginationState.nextOffset);
        console.log("Pagination widgetOffset:", JSON.stringify(paginationState.widgetOffset));
    } else {
        console.log("No pageOffset in response — no more pages.");
        paginationState.hasMore = false;
    }
}

// ===== LOAD MORE (triggered by infinite scroll) =====
async function loadMoreRestaurants() {
    if (paginationState.isLoading || !paginationState.hasMore) return;
    
    paginationState.isLoading = true;
    showLoadingIndicator(true);

    try {
        console.log(`Loading more... offset: "${paginationState.nextOffset}"`);
        const response = await fetch(PROXY_UPDATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nextOffset: paginationState.nextOffset || "",
                widgetOffset: paginationState.widgetOffset,
                filters: paginationState.filters,
                seoParams: paginationState.seoParams
            })
        });

        if (!response.ok) {
            console.warn("Pagination request failed:", response.status);
            paginationState.hasMore = false;
            showLoadingIndicator(false);
            paginationState.isLoading = false;
            return;
        }

        const json = await response.json();
        const cards = json.data?.cards || [];

        if (cards.length === 0) {
            console.log("No more data from API.");
            paginationState.hasMore = false;
            showLoadingIndicator(false);
            paginationState.isLoading = false;
            return;
        }

        const newRestaurants = extractRestaurants(cards);

        if (newRestaurants.length === 0) {
            console.log("No new unique restaurants, stopping.");
            paginationState.hasMore = false;
            showLoadingIndicator(false);
            paginationState.isLoading = false;
            return;
        }

        // Append new cards to the grid
        const fragment = document.createDocumentFragment();
        const temp = document.createElement('div');
        temp.innerHTML = newRestaurants.map(info => createRestaurantCard(info)).join('');
        while (temp.firstElementChild) {
            fragment.appendChild(temp.firstElementChild);
        }
        restaurantList.appendChild(fragment);

        // Update pagination offsets for next request
        if (json.data?.pageOffset) {
            paginationState.nextOffset = json.data.pageOffset.nextOffset || "";
            paginationState.widgetOffset = json.data.pageOffset.widgetOffset || null;
        } else {
            // No more offsets, we've reached the end
            paginationState.hasMore = false;
        }

        updateCountBadge();
        if (window.lucide) lucide.createIcons();

        console.log(`Added ${newRestaurants.length} restaurants. Total: ${totalRestaurants}`);
    } catch (err) {
        console.warn("Error loading more:", err.message);
        paginationState.hasMore = false;
    }

    showLoadingIndicator(false);
    paginationState.isLoading = false;
}

function showLoadingIndicator(show) {
    let indicator = document.getElementById('loading-indicator');
    if (show) {
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'loading-indicator';
            indicator.className = 'loading-indicator';
            indicator.innerHTML = `
                <div class="loading-spinner"></div>
                <span>Loading more restaurants...</span>
            `;
            restaurantList.parentElement.appendChild(indicator);
        }
        indicator.style.display = 'flex';
    } else if (indicator) {
        indicator.style.display = 'none';
    }
}

function updateCountBadge() {
    if (restaurantCount) {
        restaurantCount.textContent = `${totalRestaurants} restaurants`;
    }
}

function createRestaurantCard(info, isCarousel = false) {
    if (!info) return '';
    const {
        name,
        cloudinaryImageId,
        avgRating,
        sla,
        cuisines,
        areaName,
        aggregatedDiscountInfoV3
    } = info;

    const offerHeader = aggregatedDiscountInfoV3?.header || "";
    const offerSubHeader = aggregatedDiscountInfoV3?.subHeader || "";

    return `
        <div class="restaurant-card" ${isCarousel ? 'style="min-width: 240px; scroll-snap-align: start;"' : ''}>
            <div class="image-container">
                <img src="${IMG_CDN_URL}${cloudinaryImageId}" alt="${name}" loading="lazy">
                ${offerHeader ? `
                    <div class="offer-overlay">
                        <div class="offer-text">${offerHeader} ${offerSubHeader}</div>
                    </div>
                ` : ''}
            </div>
            <div class="restaurant-info">
                <div class="restaurant-name" title="${name}">${name}</div>
                <div class="rating-row">
                    <span class="star-icon" style="background: ${avgRating >= 4 ? '#118010' : '#db7c38'}">
                        <i data-lucide="star" style="width: 10px; height: 10px; fill: white; stroke: white;"></i>
                    </span>
                    <span>${avgRating || '4.0'} • ${sla?.slaString || '30 mins'}</span>
                </div>
                <div class="cuisines" title="${cuisines?.join(', ')}">${cuisines?.join(', ') || ''}</div>
                <div class="location">${areaName || ''}</div>
            </div>
        </div>
    `;
}

// Mock Data (Fallback)
const MOCK_DATA = {
    cards: [
        {
            card: {
                card: {
                    id: "whats_on_your_mind",
                    imageGridCards: {
                        info: [
                            { imageId: "MERCHANDISING_BANNERS/IMAGES/MERCH/2025/1/24/05a939eb-fd4e-4308-b989-d1c54f4421b3_northindian1.png", action: { text: "North Indian" }, accessibility: { altText: "North Indian" } },
                            { imageId: "MERCHANDISING_BANNERS/IMAGES/MERCH/2024/7/2/8f508de7-e0ac-4ba8-b54d-def9db98959e_Salad-1.png", action: { text: "South Indian" }, accessibility: { altText: "South Indian" } },
                            { imageId: "MERCHANDISING_BANNERS/IMAGES/MERCH/2024/7/2/6ef07bda-b707-48ea-9b14-2594071593d1_Biryani.png", action: { text: "Biryani" }, accessibility: { altText: "Biryani" } },
                            { imageId: "MERCHANDISING_BANNERS/IMAGES/MERCH/2024/7/2/6ef07bda-b707-48ea-9b14-2594071593d1_Pizzas.png", action: { text: "Pizzas" }, accessibility: { altText: "Pizzas" } },
                            { imageId: "MERCHANDISING_BANNERS/IMAGES/MERCH/2024/7/2/8f508de7-e0ac-4ba8-b54d-def9db98959e_burger.png", action: { text: "Burgers" }, accessibility: { altText: "Burgers" } },
                            { imageId: "MERCHANDISING_BANNERS/IMAGES/MERCH/2024/7/2/6ef07bda-b707-48ea-9b14-2594071593d1_Desserts.png", action: { text: "Dessert" }, accessibility: { altText: "Dessert" } }
                        ]
                    }
                }
            }
        }
    ]
};

// Start the app
init();
