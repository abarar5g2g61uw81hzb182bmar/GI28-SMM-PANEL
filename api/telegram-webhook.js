// File: api/telegram-webhook.js
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(req, res) {
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackId, text: "Processing..." })
        });
    } catch (e) { console.error(e); }

    let db;
    try {
        if (getApps().length === 0) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            initializeApp({ credential: cert(serviceAccount) });
        }
        db = getFirestore();
    } catch (error) { return res.status(200).send('OK'); }

    const actionParts = data.split('_'); 
    const action = actionParts[0];
    const type = actionParts[1];
    const reqId = actionParts[2];

    try {
        // 1. ADD FUNDS (UTR) LOGIC
        if (type === 'utr') {
            const reqRef = db.collection('fund_requests').doc(reqId);
            const reqDoc = await reqRef.get();
            if (!reqDoc.exists) return res.status(200).send('OK');
            const reqData = reqDoc.data();
            if (reqData.status !== 'pending') return res.status(200).send('OK');

            if (action === 'approve') {
                let bonusPercent = 0; let commissionTokens = 0; let bonusTokens = 0;
                if (reqData.applied_coupon && reqData.applied_coupon !== "") {
                     bonusPercent = (Math.random() * 5); 
                     bonusTokens = (reqData.tokens_requested * (bonusPercent / 100));
                     commissionTokens = (reqData.tokens_requested * 0.05); 
                }
                const totalForUser = reqData.tokens_requested + bonusTokens;

                const userRef = db.collection('users').doc(reqData.user_uid);
                const userDoc = await userRef.get();
                if(userDoc.exists) { await userRef.update({ wallet_balance: (userDoc.data().wallet_balance || 0) + totalForUser }); }

                if (reqData.reseller_uid && commissionTokens > 0) {
                    const partnerRef = db.collection('users').doc(reqData.reseller_uid);
                    const partnerDoc = await partnerRef.get();
                    if (partnerDoc.exists) { await partnerRef.update({ reseller_wallet: (partnerDoc.data().reseller_wallet || 0) + commissionTokens }); }
                }

                await reqRef.update({ status: 'approved', bonus_given: bonusTokens, bonus_percent: bonusPercent.toFixed(2) });

                const successMsg = `✅ *PAYMENT APPROVED*\n\n👤 *User:* ${reqData.user_email}\n💳 *UTR:* \`${reqData.utr_number}\`\n💰 *Tokens Added:* ${totalForUser.toFixed(2)} GI28\n🎁 *(Bonus: ${bonusPercent.toFixed(2)}%)*`;
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: successMsg, parse_mode: 'Markdown' }) });
            } else if (action === 'reject') {
                await reqRef.update({ status: 'rejected' });
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: `❌ *PAYMENT REJECTED*\n\n👤 *User:* ${reqData.user_email}\n💳 *UTR:* \`${reqData.utr_number}\``, parse_mode: 'Markdown' }) });
            }
        }
        // 2. PARTNER PAYOUT LOGIC
        else if (type === 'payout') {
            const payoutRef = db.collection('payouts').doc(reqId);
            const payoutDoc = await payoutRef.get();
            if (!payoutDoc.exists) return res.status(200).send('OK');
            const reqData = payoutDoc.data();
            if (reqData.status !== 'pending') return res.status(200).send('OK');

            if (action === 'paid') {
                await payoutRef.update({ status: 'paid' });
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: `✅ *PAYOUT COMPLETED*\n\n🏦 *UPI:* \`${reqData.upi}\`\n💰 *Paid:* ₹${reqData.amount_inr}`, parse_mode: 'Markdown' })
                });
            } else if (action === 'reject') {
                const userRef = db.collection('users').doc(reqData.user_uid);
                const userDoc = await userRef.get();
                if(userDoc.exists) { await userRef.update({ reseller_wallet: (userDoc.data().reseller_wallet || 0) + reqData.amount_tokens }); }
                await payoutRef.update({ status: 'rejected' });
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: `❌ *PAYOUT REJECTED & REFUNDED*\n\n🏦 *UPI:* \`${reqData.upi}\``, parse_mode: 'Markdown' })
                });
            }
        }
        // 3. ₹1 TRIAL ORDER LOGIC
        else if (type === 'trial') {
            const trialRef = db.collection('trial_orders').doc(reqId);
            const trialDoc = await trialRef.get();
            if (!trialDoc.exists) return res.status(200).send('OK');
            const reqData = trialDoc.data();
            if (reqData.status !== 'pending') return res.status(200).send('OK');

            if (action === 'approve') {
                await trialRef.update({ status: 'approved' });
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: `✅ *TRIAL APPROVED*\n\n👤 *User:* ${reqData.user_email}\n🔗 *Link:* ${reqData.target_url}`, parse_mode: 'Markdown' })
                });
            } else if (action === 'reject') {
                await trialRef.update({ status: 'rejected' });
                await db.collection('users').doc(reqData.user_uid).update({ has_used_trial: false });
                await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: `❌ *TRIAL REJECTED (FAKE UTR)*\n\n👤 *User:* ${reqData.user_email}\n🔓 *User Limit Unblocked.*`, parse_mode: 'Markdown' })
                });
            }
        }
    } catch (error) { console.error("Logic Error:", error.message); }

    return res.status(200).send('OK');
}
