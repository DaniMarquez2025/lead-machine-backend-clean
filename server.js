import express from "express";
import Stripe from "stripe";
import admin from "firebase-admin";

const app = express();
app.use(express.json());

// 🔑 STRIPE
const stripe = new Stripe(process.env.STRIPE_SECRET);

// 🔥 FIREBASE (desde variable de entorno)
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ===============================
// 🧪 TEST MANUAL
// ===============================
app.get("/test-payment", async (req, res) => {
  try {
    const email = "test@test.com";

    const snapshot = await db.collection("users")
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      return res.send("❌ Usuario no encontrado");
    }

    for (const docu of snapshot.docs) {
      await db.collection("users").doc(docu.id).update({
        paid: true
      });
    }

    res.send("✅ Usuario actualizado a paid");

  } catch (error) {
    console.error(error);
    res.status(500).send("❌ Error");
  }
});

// ===============================
// 💳 WEBHOOK STRIPE
// ===============================
app.post("/webhook", async (req, res) => {
  try {
    const event = req.body;

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const email = session.customer_details?.email;

      if (!email) {
        console.log("❌ No email");
        return res.sendStatus(200);
      }

      const snapshot = await db.collection("users")
        .where("email", "==", email)
        .get();

      for (const docu of snapshot.docs) {
        await db.collection("users").doc(docu.id).update({
          paid: true
        });
      }

      console.log("✅ Usuario actualizado:", email);
    }

    res.sendStatus(200);

  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
});

// ===============================
// 🌐 ROOT
// ===============================
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// ===============================
// 🚀 SERVER
// ===============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});