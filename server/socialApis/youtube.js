// youtube.js

const axios = require('axios');
const API_KEY = 'YOUR_YOUTUBE_API_KEY'; // Replace with your YouTube API key

const CHANNEL_ID = 'YOUR_CHANNEL_ID'; // Replace with your channel ID

async function fetchLatestVideos() {
    try {
        const response = await axios.get(`https://www.googleapis.com/youtube/v3/search`, {
            params: {
                key: API_KEY,
                channelId: CHANNEL_ID,
                part: 'snippet',
                order: 'date',
                maxResults: 5 // You can modify this to fetch more videos
            }
        });
        return response.data.items;
    } catch (error) {
        console.error('Error fetching videos:', error);
        throw error;
    }
}

async function postAnnouncements(videos) {
    // Implement your announcement logic here
    for (const video of videos) {
        console.log(`New video posted: ${video.snippet.title}`);
        // Add your logic to post the announcement
    }
}

async function main() {
    const latestVideos = await fetchLatestVideos();
    await postAnnouncements(latestVideos);
}

main();