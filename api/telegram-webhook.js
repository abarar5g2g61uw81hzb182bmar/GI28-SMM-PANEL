// File: api/telegram-webhook.js

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req, res) {
    console.log("🔥 WEBHOOK HIT DETECTED! Method:", req.method);
    
    if (req.method !== 'POST') return res.status(200).send('OK');

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const body = req.body;

    if (!body || !body.callback_query) return res.status(200).send('OK');

    const callbackId = body.callback_query.id;
    const chatId = body.callback_query.message.chat.id;
    const messageId = body.callback_query.message.message_id;
    const data = body.callback_query.data; 

    try {
        await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackId, text: "Processing..." })
        });
    } catch (e) { console.error("❌ Failed to stop loading:", e); }

    let db;
    try {
        if (getApps().length === 0) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            initializeApp({ credential: cert(serviceAccount) });
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

            if (!reqDoc.exists) return res.status(200).send('OK');
            
            const reqData = reqDoc.data();

            if (reqData.status !== 'pending') {
                return res.status(200).send('OK');
            }

            // ==========================================
            // LOGIC FOR APPROVE
            // ==========================================
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
                }

                if (reqData.reseller_uid && commissionTokens > 0) {
                    const partnerRef = db.collection('users').doc(reqData.reseller_uid);
                    const partnerDoc = await partnerRef.get();
                    if (partnerDoc.exists) {
                        const currentPartnerBal = partnerDoc.data().reseller_wallet || 0;
                        await partnerRef.update({ reseller_wallet: currentPartnerBal + commissionTokens });
                    }
                }

                await reqRef.update({ 
                    status: 'approved',
                    bonus_given: bonusTokens,
                    bonus_percent: bonusPercent.toFixed(2)
                });

                // 🌟 NAYA MSG FORMAT (Approve)
                const successMsg = `✅ *PAYMENT APPROVED*\n\n` +
                                   `👤 *User:* ${reqData.user_email || 'N/A'}\n` +
                                   `💳 *UTR:* \`${reqData.utr_number}\`\n` +
                                   `🎟 *Coupon:* ${reqData.applied_coupon || 'None'}\n` +
                                   `🆔 *ReqID:* \`${reqId}\`\n` +
                                   `💰 *Tokens Added:* ${totalForUser.toFixed(2)} GI28\n` +
                                   `🎁 *(Bonus included: ${bonusPercent.toFixed(2)}%)*`;

                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: successMsg, parse_mode: 'Markdown' })
                });

            } 
            // ==========================================
            // LOGIC FOR REJECT
            // ==========================================
            else if (action === 'reject') {
                await reqRef.update({ status: 'rejected' });
                
                // 🌟 NAYA MSG FORMAT (Reject)
                const rejectMsg = `❌ *PAYMENT REJECTED*\n\n` +
                                  `👤 *User:* ${reqData.user_email || 'N/A'}\n` +
                                  `💳 *UTR:* \`${reqData.utr_number}\`\n` +
                                  `🆔 *ReqID:* \`${reqId}\``;

                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: rejectMsg, parse_mode: 'Markdown' })
                });
            }
        }
    } catch (error) {
        console.error("❌ Logic Error:", error.message);
    }

    return res.status(200).send('OK');
}
