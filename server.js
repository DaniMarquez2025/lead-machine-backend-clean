import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import Stripe from "stripe";

dotenv.config();

const app = express();

// ⚠️ IMPORTANTE PARA STRIPE WEBHOOK
app.use("/webhook", express.raw({ type: "application/json" }));

app.use(cors());
app.use(express.json());

// 🔥 STRIPE
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔥 FIREBASE
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();


// 🟢 CHECK PREMIUM
app.post("/check-premium", async (req, res) => {
  try {
    const { email } = req.body;

    const doc = await db.collection("users").doc(email).get();

    if (!doc.exists) {
      return res.json({ premium: false });
    }

    res.json({ premium: doc.data().premium === true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error checking premium" });
  }
});


// 💰 CREATE CHECKOUT SESSION (PRECIO FIJO 9,90€)
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email requerido" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],

      customer_email: email,

      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "ClientEngine Acceso Premium",
            },
            unit_amount: 990, // ✅ 9,90€ SIEMPRE
          },
          quantity: 1,
        },
      ],

      success_url: `https://clientengine.netlify.app/?pago=ok&email=${email}`,
      cancel_url: "https://clientengine.netlify.app/?pago=cancel",
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error("ERROR STRIPE:", error);
    res.status(500).json({ error: "Error creating checkout" });
  }
});


// 🔥 WEBHOOK STRIPE (ACTIVA PREMIUM AUTOMÁTICO)
app.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Error webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🎯 CUANDO EL PAGO SE COMPLETA
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const email = session.customer_email;

    if (email) {
      console.log("✅ Pago completado:", email);

      await db.collection("users").doc(email).set({
        email: email,
        premium: true,
        createdAt: new Date(),
      });

      console.log("🔥 Usuario activado como premium");
    }
  }

  res.json({ received: true });
});


// 🚀 SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});