// File: api/notify-admin.js

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Only POST method allowed' });
    }

    const { type, reqId, uid, email, amount, tokens, utr, coupon, serviceId, targetLink } = req.body;

    // Vercel me save kiye hue Telegram credentials uthana
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        return res.status(500).json({ success: false, error: 'Telegram credentials missing in Vercel' });
    }

    let message = '';
    let inlineKeyboard = [];

    // Logic 1: Agar "Add Funds" (UTR) ki request aayi
    if (type === 'utr') {
        message = `🚨 *NEW PAYMENT REQUEST* 🚨\n\n` +
                  `👤 *User:* ${email}\n` +
                  `💰 *Amount:* ₹${amount} (${tokens} GI28)\n` +
                  `💳 *UTR:* \`${utr}\`\n` +
                  `🎟 *Coupon:* ${coupon || 'None'}\n` +
                  `🆔 *ReqID:* \`${reqId}\``;

        inlineKeyboard = [
            [{ text: "✅ Approve", callback_data: `approve_utr_${reqId}` }],
            [{ text: "❌ Reject", callback_data: `reject_utr_${reqId}` }]
        ];
    } 
    // Logic 2: Agar "₹1 Trial" ki request aayi
    else if (type === 'trial') {
        message = `🆓 *NEW ₹1 TRIAL REQUEST* 🆓\n\n` +
                  `👤 *User:* ${email}\n` +
                  `📦 *Service:* ${serviceId}\n` +
                  `🔗 *Link:* ${targetLink}\n` +
                  `💳 *UTR:* \`${utr}\`\n` +
                  `🆔 *ReqID:* \`${reqId}\``;

        inlineKeyboard = [
            [{ text: "✅ Approve Trial", callback_data: `approve_trial_${reqId}` }],
            [{ text: "❌ Reject Trial", callback_data: `reject_trial_${reqId}` }]
        ];
    }
    // Logic 3: Agar "Manual Order" ki request aayi
    else if (type === 'manual_order') {
        const { serviceName, link, qty, charge, orderId } = req.body;
        message = `🛠 *NEW MANUAL ORDER* 🛠\n\n` +
                  `👤 *User:* ${email}\n` +
                  `📦 *Service:* ${serviceName}\n` +
                  `🔗 *Link:* ${link}\n` +
                  `🔢 *Qty:* ${qty}\n` +
                  `💰 *Charge:* ${charge} GI28\n` +
                  `🆔 *OrderID:* \`${orderId}\``;

        inlineKeyboard = [
            [{ text: "🖥️ View in Admin Panel", url: "https://gi28.in/admin" }]
        ];
    }
    
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        const response = await fetch(telegramUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: inlineKeyboard }
            })
        });

        const data = await response.json();
        
        if (data.ok) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(400).json({ success: false, error: data.description });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to send to Telegram' });
    }
}
