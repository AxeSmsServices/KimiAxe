// twitter.js

const axios = require('axios');

const twitterApiUrl = 'https://api.twitter.com/2/tweets';
const bearerToken = 'YOUR_BEARER_TOKEN';  // Replace with your own Bearer Token

async function postTweet(message) {
    try {
        const response = await axios.post(twitterApiUrl, { text: message }, {
            headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Tweet posted successfully:', response.data);
    } catch (error) {
        console.error('Error posting tweet:', error.response ? error.response.data : error.message);
    }
}

// Example usage:
// postTweet('Website has been updated!');