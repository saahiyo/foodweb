const axios = require('axios');
const fs = require('fs');

(async () => {
    try {
        const res = await axios.get('http://localhost:3000/api/restaurants');
        const data = res.data.data;
        
        // Write full pageOffset to file
        fs.writeFileSync('page_offset.json', JSON.stringify(data.pageOffset, null, 2));
        console.log("pageOffset written to page_offset.json");
        
        // Now test the update endpoint with correct data
        const updateRes = await axios.post('http://localhost:3000/api/restaurants/update', {
            nextOffset: data.pageOffset?.nextOffset || "",
            widgetOffset: data.pageOffset?.widgetOffset || null,
            filters: {},
            seoParams: {}
        });
        
        const updateData = updateRes.data.data;
        console.log("Update cards count:", updateData?.cards?.length || 0);
        console.log("Update pageOffset:", JSON.stringify(updateData?.pageOffset));
        
        // Count restaurants in update
        let count = 0;
        updateData?.cards?.forEach((card, i) => {
            const rests = card.card?.card?.gridElements?.infoWithStyle?.restaurants;
            if (rests) {
                count += rests.length;
                console.log(`Update Card ${i}: ${rests.length} restaurants`);
            }
        });
        console.log("Total restaurants in update:", count);
        
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.error("Status:", e.response.status);
            console.error("Data:", JSON.stringify(e.response.data).substring(0, 500));
        }
    }
})();
