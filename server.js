require('dotenv').config();
const express = require('express');
const { OpenAI } = require('openai');

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI();

// Serve static files from the public directory
app.use(express.static('public'));

app.get('/token', async (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] GET /token - Requesting ephemeral Realtime token...`);
    
    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not set in the environment variables.");
        }

        // Create an ephemeral token using the official OpenAI Node.js SDK
        const ephemeralKeyInfo = await openai.realtime.clientSecrets.create({
            session: {
                type: 'realtime',
                model: 'gpt-realtime-2.1',
                instructions: 'You are a friendly voice assistant. Keep responses concise.',
            }
        });

        console.log(`[${new Date().toLocaleTimeString()}] GET /token - Token successfully received.`);
        
        // Return only what the frontend needs
        res.json({ client_secret: ephemeralKeyInfo.value });
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Error creating token:`, error.message);
        // Include the actual error message so it shows up in curl or the browser network tab
        res.status(500).json({ error: "Failed to generate ephemeral token", details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
    console.log(`Backend is ready.`);
});
