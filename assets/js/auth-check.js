import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.x.x/firebase-auth.js"; // Version match kar lena

const auth = getAuth();

// Ye code jaise hi page load hoga, check karega ki user logged-in hai ya nahi
onAuthStateChanged(auth, (user) => {
  const currentPath = window.location.pathname;

  if (user) {
    // User logged in hai
    console.log("User logged in:", user.email);
    
    // Agar user Login page (root) par hai, toh use Dashboard bhej do
    if (currentPath === "/" || currentPath === "/index.html") {
      window.location.href = "dashboard/";
    }
  } else {
    // User logged out hai
    console.log("No user logged in");

    // Agar user Dashboard ya kisi aur protected page par hai, toh Login page bhej do
    // Par Login page par infinite loop mat banana!
    if (currentPath !== "/" && currentPath !== "/index.html") {
      window.location.href = "/";
    }
  }
});

