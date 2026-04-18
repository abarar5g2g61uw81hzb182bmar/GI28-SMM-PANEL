// File: api/place-order.js

export default async function handler(req, res) {
    // CORS headers zaroori hain taaki tera frontend isey call kar sake
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Only POST method is allowed' });
    }

    const { provider_name, provider_service_id, link, quantity } = req.body;

    let apiUrl = '';
    let apiKey = '';

    // Provider check karo aur uski API key Vercel environment se uthao
    if (provider_name === 'bulkfollows') {
        apiUrl = 'https://bulkfollows.com/api/v2';
        apiKey = process.env.BULKFOLLOWS_KEY;
    } else if (provider_name === 'xmedia') {
        apiUrl = 'https://xmedia.com/api/v2'; // Agar xmedia ka url kuch aur ho toh yahan change kar lena
        apiKey = process.env.XMEDIA_KEY;
    } else {
        return res.status(400).json({ success: false, error: 'Invalid Provider in Database' });
    }

    const params = new URLSearchParams();
    params.append('key', apiKey);
    params.append('action', 'add');
    params.append('service', provider_service_id);
    params.append('link', link);
    params.append('quantity', quantity);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            body: params
        });
        const data = await response.json();

        if (data.order) {
            // Order successful
            return res.status(200).json({ success: true, provider_order_id: data.order });
        } else {
            // Provider error (e.g., low balance, invalid link)
            return res.status(400).json({ success: false, error: data.error || 'Provider Panel Error' });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Server connection failed' });
    }
}
