// Instagram API Integration

const axios = require('axios');

const INSTAGRAM_API_URL = 'https://graph.instagram.com';
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN';

async function postContent(imageUrl, caption) {
    try {
        const response = await axios.post(`${INSTAGRAM_API_URL}/me/media`, {
            image_url: imageUrl,
            caption: caption,
            access_token: ACCESS_TOKEN
        });
        console.log('Media created: ', response.data);
        await publishMedia(response.data.id);
    } catch (error) {
        console.error('Error posting to Instagram: ', error);
    }
}

async function publishMedia(mediaId) {
    try {
        const response = await axios.post(`${INSTAGRAM_API_URL}/me/media_publish`, {
            media_id: mediaId,
            access_token: ACCESS_TOKEN
        });
        console.log('Media published: ', response.data);
    } catch (error) {
        console.error('Error publishing media to Instagram: ', error);
    }
}

// Example usage
// postContent('https://example.com/image.jpg', 'Check out this amazing image!');