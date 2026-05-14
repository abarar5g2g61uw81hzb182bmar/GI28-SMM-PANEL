// File: api/get-provider-services.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { provider } = req.body;
    let apiUrl = '';
    let apiKey = '';

    // Vercel Environment Variables me in dono keys ka hona zaroori hai
    if (provider === 'bulkfollows') {
        apiUrl = 'https://bulkfollows.com/api/v2';
        apiKey = process.env.BULKFOLLOWS_KEY; 
    } else if (provider === 'xmedia') {
               apiUrl = 'https://xmediasmm.in/api/v2'; 
               apiKey = process.env.XMEDIA_KEY;
    } else {
        return res.status(400).json({ success: false, error: 'Invalid Provider' });
    }

    if (!apiKey) {
        return res.status(500).json({ success: false, error: `${provider.toUpperCase()} API Key not found in Vercel.` });
    }

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: apiKey, action: 'services' })
        });

        const data = await response.json();
        
        if (data.error) {
            return res.status(400).json({ success: false, error: data.error });
        }

        return res.status(200).json({ success: true, services: data });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
