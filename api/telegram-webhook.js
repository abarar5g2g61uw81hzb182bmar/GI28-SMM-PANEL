// File: api/telegram-webhook.js

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(200).send('OK');

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const body = req.body;

    if (!body.callback_query) return res.status(200).send('OK');

    const callbackId = body.callback_query.id;
    const chatId = body.callback_query.message.chat.id;
    const messageId = body.callback_query.message.message_id;
    const data = body.callback_query.data; // e.g., "approve_utr_REQ123"

    // 1. BUTTON LOADING ROKNE KA COMMAND
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackId, text: "Processing your request..." })
    });

    // Error dikhane wala helper function
    const sendErrorToTelegram = async (errMsg) => {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: `🚨 *SYSTEM ERROR:*\n${errMsg}`, parse_mode: 'Markdown' })
        });
    };

    let db;
    try {
        // Firebase Admin setup
        if (getApps().length === 0) {
            if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
                await sendErrorToTelegram("Bhai, Vercel me `FIREBASE_SERVICE_ACCOUNT` naam ka Environment Variable nahi mila!");
                return res.status(200).send('OK');
            }
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            initializeApp({ credential: cert(serviceAccount) });
        }
        db = getFirestore();
    } catch (error) {
        await sendErrorToTelegram("Firebase Start nahi hua! JSON key check kar.\nError: " + error.message);
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
                await sendErrorToTelegram("Ye request database me nahi mili: " + reqId);
                return res.status(200).send('OK');
            }
            
            const reqData = reqDoc.data();

            if (reqData.status !== 'pending') {
                await sendErrorToTelegram("⚠️ Bhai, isko pehle hi Approve/Reject kar diya gaya hai!");
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

                // User Wallet Update
                const userRef = db.collection('users').doc(reqData.user_uid);
                const userDoc = await userRef.get();
                if(userDoc.exists) {
                    const currentBal = userDoc.data().wallet_balance || 0;
                    await userRef.update({ wallet_balance: currentBal + totalForUser });
                }

                // Partner Wallet Update
                if (reqData.reseller_uid && commissionTokens > 0) {
                    const partnerRef = db.collection('users').doc(reqData.reseller_uid);
                    const partnerDoc = await partnerRef.get();
                    if (partnerDoc.exists) {
                        const currentPartnerBal = partnerDoc.data().reseller_wallet || 0;
                        await partnerRef.update({ reseller_wallet: currentPartnerBal + commissionTokens });
                    }
                }

                // Update Status
                await reqRef.update({ 
                    status: 'approved',
                    bonus_given: bonusTokens,
                    bonus_percent: bonusPercent.toFixed(2)
                });

                // Update Telegram Message
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
            }
        }
    } catch (error) {
        await sendErrorToTelegram("Database Logic Error: " + error.message);
    }

    return res.status(200).send('OK');
}
