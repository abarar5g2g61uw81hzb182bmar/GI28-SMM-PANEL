import { db, auth } from "./firebase-config.js";
import { doc, getDoc, setDoc, onSnapshot, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "../"; return; }

    const userRef = doc(db, "users", user.uid);
    
    // Real-time listener for balance updates
    onSnapshot(userRef, (docSnap) => {
        const data = docSnap.data();
        
        // 1. Generate/Display Coupon Code if missing
        if (!data.partner_code) {
            const newCode = "REF-" + Math.random().toString(36).substr(2, 6).toUpperCase();
            setDoc(userRef, { partner_code: newCode }, { merge: true });
        }
        document.getElementById('partnerCode').innerText = data.partner_code || "Generating...";
        
        // 2. Update Stats
        const bal = parseFloat(data.reseller_wallet || 0).toFixed(2);
        document.getElementById('availableBal').innerText = bal + " GI28";
        // Assuming 1 GI28 = ₹99
        document.getElementById('inrValue').innerText = "~ ₹" + (bal * 99).toFixed(2);
    });
});

window.requestWithdrawal = async () => {
    const amt = parseFloat(document.getElementById('withdrawAmt').value);
    const upi = document.getElementById('upiId').value;
    const user = auth.currentUser;

    if (!amt || amt <= 0 || !upi) return alert("Enter valid amount and UPI!");

    // Check balance
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const currentBal = userSnap.data().reseller_wallet || 0;

    if (amt > currentBal) return alert("Insufficient balance!");

    // Create Payout Request
    await addDoc(collection(db, "payouts"), {
        user_uid: user.uid,
        amount_tokens: amt,
        amount_inr: (amt * 99).toFixed(2),
        upi: upi,
        status: "pending",
        timestamp: serverTimestamp()
    });

    // Deduct from wallet
    await setDoc(doc(db, "users", user.uid), { reseller_wallet: currentBal - amt }, { merge: true });
    
    alert("Withdrawal request sent! Your employee will process this shortly.");
};

window.copyCode = () => {
    navigator.clipboard.writeText(document.getElementById('partnerCode').innerText);
    alert("Coupon code copied!");
};
