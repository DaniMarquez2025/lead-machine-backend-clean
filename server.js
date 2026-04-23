import express from "express";
import cors from "cors";
import Stripe from "stripe";
import admin from "firebase-admin";

const app = express();

// 🔥 STRIPE
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔥 FIREBASE
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ⚠️ WEBHOOK (RAW BODY)
app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
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

  // 💰 PAGO COMPLETADO
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const email = session.customer_details.email;

    console.log("💰 Pago completado:", session.id);
    console.log("📧 Email:", email);

    try {
      await db.collection("users").doc(email).set(
        {
          email: email,
          premium: true,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      console.log("🔥 Usuario actualizado a PREMIUM");
    } catch (error) {
      console.error("❌ Error Firebase:", error);
    }
  }

  res.json({ received: true });
});

// 👇 NORMAL MIDDLEWARE
app.use(cors());
app.use(express.json());

// 🚀 CREAR CHECKOUT
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
            unit_amount: 2000,
          },
          quantity: 1,
        },
      ],
      success_url: "https://google.com",
      cancel_url: "https://google.com",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando checkout" });
  }
});

// 🧪 TEST PAYMENT
app.get("/test-payment", async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: "test@test.com",
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: "Test pago",
          },
          unit_amount: 2000,
        },
        quantity: 1,
      },
    ],
    success_url: "https://google.com",
    cancel_url: "https://google.com",
  });

  res.redirect(session.url);
});

// 🔒 CHECK PREMIUM
app.post("/check-premium", async (req, res) => {
  try {
    const { email } = req.body;

    const userDoc = await db.collection("users").doc(email).get();

    if (!userDoc.exists) {
      return res.json({ premium: false });
    }

    const userData = userDoc.data();

    res.json({
      premium: userData.premium === true,
    });
  } catch (error) {
    console.error("Error check premium:", error);
    res.status(500).json({ error: "Error servidor" });
  }
});

// 🚀 SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});