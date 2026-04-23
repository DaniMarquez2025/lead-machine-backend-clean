import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import admin from "firebase-admin";

dotenv.config();

const app = express();

// ⚠️ WEBHOOK RAW
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

// 🚀 CREAR SUSCRIPCIÓN
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { email } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,

      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Acceso Premium Mensual",
            },
            unit_amount: 1000,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],

      success_url: "http://localhost:3000/index.html",
      cancel_url: "http://localhost:3000/landing.html",
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// 🔥 CANCELAR SUSCRIPCIÓN (NUEVO)
app.post("/cancel-subscription", async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Buscar cliente en Stripe
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    if (!customers.data.length) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const customer = customers.data[0];

    // 2. Buscar suscripciones activas
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
    });

    if (!subscriptions.data.length) {
      return res.status(404).json({ error: "No hay suscripción activa" });
    }

    const subscription = subscriptions.data[0];

    // 3. Cancelar suscripción
    await stripe.subscriptions.del(subscription.id);

    // 4. Actualizar Firebase
    await db.collection("users").doc(email).update({
      premium: false,
    });

    res.json({ success: true });

  } catch (error) {
    console.error("Error cancelando:", error);
    res.status(500).json({ error: error.message });
  }
});

// 🔥 WEBHOOK
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

  // 💰 ACTIVAR PREMIUM
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_email;

    db.collection("users").doc(email).set({
      email: email,
      premium: true,
      updatedAt: new Date(),
    });
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