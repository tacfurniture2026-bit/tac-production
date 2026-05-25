const fs = require('fs');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set } = require('firebase/database');

const firebaseConfig = {
    apiKey: "AIzaSyAtXI3uz70l5P6UF26OC1Tru1fte35343g",
    authDomain: "tac-production-bfd08.firebaseapp.com",
    databaseURL: "https://tac-production-bfd08-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "tac-production-bfd08",
    storageBucket: "tac-production-bfd08.firebasestorage.app",
    messagingSenderId: "299994554225",
    appId: "1:299994554225:web:33f0de3f5f9e53f21de0d0"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const rawData = fs.readFileSync('data/new_master.json', 'utf8');
const data = JSON.parse(rawData);

set(ref(db, 'INV_PRODUCTS'), data).then(() => {
    console.log("Successfully uploaded!");
    process.exit(0);
}).catch((err) => {
    console.error("Error uploading:", err);
    process.exit(1);
});
