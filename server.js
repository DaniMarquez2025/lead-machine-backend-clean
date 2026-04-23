import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import admin from "firebase-admin";

dotenv.config();

const app = express();

// ⚠️ IMPORTANTE PARA WEBHOOK
app.use('/webhook', express.raw({ type: 'application/json' }));

app.use(cors());
app.use(express.json());

// 🔥 FIREBASE
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 💳 STRIPE
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🟢 CREAR CHECKOUT (CORREGIDO)
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
              name: "Acceso Premium",
            },
            unit_amount: 2000,
          },
          quantity: 1,
        },
      ],

      // 🔥 REDIRECCIÓN PERFECTA
      success_url: "http://localhost:3000/index.html",
      cancel_url: "http://localhost:3000/landing.html",
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error("❌ Error creando checkout:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🟢 WEBHOOK (CLAVE)
app.post("/webhook", (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("❌ Error webhook:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 💥 PAGO COMPLETADO
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const email = session.customer_email;

    console.log("💰 Pago completado:", session.id);
    console.log("📧 Email:", email);

    // 🔥 GUARDAR EN FIREBASE
    db.collection("users").doc(email).set({
      email: email,
      premium: true,
      updatedAt: new Date(),
    });

    console.log("🔥 Usuario actualizado a PREMIUM");
  }

  res.json({ received: true });
});

// 🟢 CHECK PREMIUM
app.post("/check-premium", async (req, res) => {
  const { email } = req.body;

  const doc = await db.collection("users").doc(email).get();

  if (!doc.exists) {
    return res.json({ premium: false });
  }

  res.json({ premium: doc.data().premium === true });
});

// 🚀 SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});