// File: api/telegram-webhook.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ⚠️ IMPORTANT: Hume Firebase Admin Setup karna padega backend ke liye
// Tu pehle is code ko paste kar, phir main bataunga Firebase Admin Service Account kaise dalna hai.

let db;

try {
    // Ye code tabhi chalega jab hum Vercel me FIREBASE_SERVICE_ACCOUNT variable dalenge
    if (!global.firebaseApp) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        global.firebaseApp = initializeApp({
            credential: cert(serviceAccount)
        });
    }
    db = getFirestore();
} catch (error) {
    console.error("Firebase Admin Init Error:", error);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const body = req.body;

    // Check karo ki kisi ne inline button dabaya hai kya
    if (body.callback_query) {
        const callbackId = body.callback_query.id;
        const chatId = body.callback_query.message.chat.id;
        const messageId = body.callback_query.message.message_id;
        const data = body.callback_query.data; // e.g., "approve_utr_REQ123"

        // Telegram ko turant answer dena zaroori hai, warna button loading ghumta rahega
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackId, text: "Processing..." })
        });

        const actionParts = data.split('_'); // ["approve", "utr", "REQ123"]
        const action = actionParts[0];
        const type = actionParts[1];
        const reqId = actionParts[2];

        try {
            if (type === 'utr') {
                const reqRef = db.collection('fund_requests').doc(reqId);
                const reqDoc = await reqRef.get();

                if (!reqDoc.exists) throw new Error("Request not found in DB.");
                const reqData = reqDoc.data();

                if (reqData.status !== 'pending') {
                    await sendTelegramEdit(botToken, chatId, messageId, "⚠️ This request is already processed.");
                    return res.status(200).send('OK');
                }

                if (action === 'approve') {
                    // 1. Random Bonus Logic (0% to 5%)
                    let bonusPercent = 0;
                    let commissionTokens = 0;
                    let bonusTokens = 0;

                    if (reqData.applied_coupon && reqData.applied_coupon !== "") {
                         // Generate random float between 0 and 5
                         bonusPercent = (Math.random() * 5); 
                         bonusTokens = (reqData.tokens_requested * (bonusPercent / 100));
                         // Partner gets fixed 5% or you can change this
                         commissionTokens = (reqData.tokens_requested * 0.05); 
                    }

                    const totalForUser = reqData.tokens_requested + bonusTokens;

                    // 2. User Balance Update
                    const userRef = db.collection('users').doc(reqData.user_uid);
                    const userDoc = await userRef.get();
                    if(userDoc.exists) {
                        const currentBal = userDoc.data().wallet_balance || 0;
                        await userRef.update({ wallet_balance: currentBal + totalForUser });
                    }

                    // 3. Partner Commission Update
                    if (reqData.reseller_uid && commissionTokens > 0) {
                        const partnerRef = db.collection('users').doc(reqData.reseller_uid);
                        const partnerDoc = await partnerRef.get();
                        if (partnerDoc.exists) {
                            const currentPartnerBal = partnerDoc.data().reseller_wallet || 0;
                            await partnerRef.update({ reseller_wallet: currentPartnerBal + commissionTokens });
                        }
                    }

                    // 4. Mark Request as Approved
                    await reqRef.update({ 
                        status: 'approved',
                        bonus_given: bonusTokens,
                        bonus_percent: bonusPercent.toFixed(2)
                    });

                    await sendTelegramEdit(botToken, chatId, messageId, `✅ *PAYMENT APPROVED*\nUser got ${totalForUser.toFixed(2)} Tokens.\n(Bonus: ${bonusPercent.toFixed(2)}%)`);
                
                } else if (action === 'reject') {
                    await reqRef.update({ status: 'rejected' });
                    await sendTelegramEdit(botToken, chatId, messageId, "❌ *PAYMENT REJECTED*");
                }
            }
        } catch (error) {
            console.error("Webhook Error:", error);
            await sendTelegramEdit(botToken, chatId, messageId, "🚨 Error processing request.");
        }
    }

    return res.status(200).send('OK');
}

// Helper function to edit Telegram message
async function sendTelegramEdit(token, chatId, msgId, newText) {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: msgId,
            text: newText,
            parse_mode: 'Markdown'
        })
    });
}
