// File: api/telegram-webhook.js

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req, res) {
    // 🚨 TRACKER 1: Pata chalega ki Telegram ne hit kiya ya nahi
    console.log("🔥 WEBHOOK HIT DETECTED! Method:", req.method);
    
    if (req.method !== 'POST') {
        console.log("⚠️ Not a POST request.");
        return res.status(200).send('OK');
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) console.error("❌ ERROR: BOT TOKEN MISSING IN VERCEL!");

    const body = req.body;
    // 🚨 TRACKER 2: Telegram ne kya data bheja, wo log me print hoga
    console.log("📦 TELEGRAM PAYLOAD:", JSON.stringify(body));

    if (!body || !body.callback_query) {
        console.log("⚠️ Callback query nahi mili, ignoring...");
        return res.status(200).send('OK');
    }

    const callbackId = body.callback_query.id;
    const chatId = body.callback_query.message.chat.id;
    const messageId = body.callback_query.message.message_id;
    const data = body.callback_query.data; // e.g., "approve_utr_REQ123"

    console.log(`🔘 BUTTON CLICKED: ${data}`);

    try {
        // Button ki loading rokne ka code
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackId, text: "Processing..." })
        });
        console.log("✅ Button loading stopped.");
    } catch (e) {
        console.error("❌ Failed to stop button loading:", e);
    }

    let db;
    try {
        if (getApps().length === 0) {
            if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
                console.error("❌ FIREBASE_SERVICE_ACCOUNT is missing in Vercel!");
                return res.status(200).send('OK');
            }
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            initializeApp({ credential: cert(serviceAccount) });
            console.log("✅ Firebase initialized successfully.");
        }
        db = getFirestore();
    } catch (error) {
        console.error("❌ Firebase Init Error:", error.message);
        return res.status(200).send('OK');
    }

    const actionParts = data.split('_'); 
    const action = actionParts[0];
    const type = actionParts[1];
    const reqId = actionParts[2];

    try {
        if (type === 'utr') {
            const reqRef = db.collection('fund_requests').doc(reqId);
            const reqDoc = await reqRef.get();

            if (!reqDoc.exists) {
                console.error("❌ Request ID not found in DB: " + reqId);
                return res.status(200).send('OK');
            }
            
            const reqData = reqDoc.data();
            console.log("✅ Request Data found in DB for user:", reqData.user_uid);

            if (reqData.status !== 'pending') {
                console.log("⚠️ Request already processed.");
                return res.status(200).send('OK');
            }

            if (action === 'approve') {
                let bonusPercent = 0;
                let commissionTokens = 0;
                let bonusTokens = 0;

                if (reqData.applied_coupon && reqData.applied_coupon !== "") {
                     bonusPercent = (Math.random() * 5); 
                     bonusTokens = (reqData.tokens_requested * (bonusPercent / 100));
                     commissionTokens = (reqData.tokens_requested * 0.05); 
                }

                const totalForUser = reqData.tokens_requested + bonusTokens;

                const userRef = db.collection('users').doc(reqData.user_uid);
                const userDoc = await userRef.get();
                if(userDoc.exists) {
                    const currentBal = userDoc.data().wallet_balance || 0;
                    await userRef.update({ wallet_balance: currentBal + totalForUser });
                    console.log("✅ User balance updated.");
                }

                if (reqData.reseller_uid && commissionTokens > 0) {
                    const partnerRef = db.collection('users').doc(reqData.reseller_uid);
                    const partnerDoc = await partnerRef.get();
                    if (partnerDoc.exists) {
                        const currentPartnerBal = partnerDoc.data().reseller_wallet || 0;
                        await partnerRef.update({ reseller_wallet: currentPartnerBal + commissionTokens });
                        console.log("✅ Partner commission added.");
                    }
                }

                await reqRef.update({ 
                    status: 'approved',
                    bonus_given: bonusTokens,
                    bonus_percent: bonusPercent.toFixed(2)
                });
                console.log("✅ DB status marked as approved.");

                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        message_id: messageId,
                        text: `✅ *PAYMENT APPROVED*\nUser got ${totalForUser.toFixed(2)} Tokens.\n(Bonus: ${bonusPercent.toFixed(2)}%)`,
                        parse_mode: 'Markdown'
                    })
                });
                console.log("✅ Telegram message updated.");
            } else if (action === 'reject') {
                await reqRef.update({ status: 'rejected' });
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        message_id: messageId,
                        text: "❌ *PAYMENT REJECTED*",
                        parse_mode: 'Markdown'
                    })
                });
                console.log("✅ DB and Telegram marked as rejected.");
            }
        }
    } catch (error) {
        console.error("❌ Logic Error:", error.message);
    }

    return res.status(200).send('OK');
}
