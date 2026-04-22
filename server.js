import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import admin from "firebase-admin";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* =========================
   🔥 FIREBASE CONFIG
========================= */

const firebaseKey = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(firebaseKey),
});

const db = admin.firestore();

/* =========================
   💳 STRIPE CONFIG
========================= */

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* =========================
   🧪 TEST MANUAL
========================= */

app.get("/test-payment", async (req, res) => {
  try {
    const email = "test@test.com";

    const snapshot = await db
      .collection("users")
      .where("email", "==", email)
      .get();

    if (snapshot.empty) {
      return res.send("❌ Usuario no encontrado");
    }

    for (const doc of snapshot.docs) {
      await db.collection("users").doc(doc.id).update({
        paid: true,
      });
    }

    res.send("✅ Usuario actualizado a paid");
  } catch (error) {
    console.error(error);
    res.status(500).send("❌ Error");
  }
});

/* =========================
   💳 CREAR CHECKOUT STRIPE
========================= */

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { email } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Acceso premium",
            },
            unit_amount: 2000, // 20€
          },
          quantity: 1,
        },
      ],
      success_url: "https://tuweb.com/success",
      cancel_url: "https://tuweb.com/cancel",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creando pago");
  }
});

/* =========================
   🚀 SERVER START
========================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});