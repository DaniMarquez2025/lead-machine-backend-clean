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

// ⚠️ IMPORTANTE: webhook necesita raw
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
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

    // 🔥 GUARDAR EN FIREBASE
    db.collection("users")
      .doc(email)
      .set(
        {
          email: email,
          premium: true,
          updatedAt: new Date(),
        },
        { merge: true }
      )
      .then(() => {
        console.log("🔥 Usuario actualizado a PREMIUM");
      })
      .catch((error) => {
        console.error("❌ Error Firebase:", error);
      });
  }

  res.json({ received: true });
});

// 👇 DESPUÉS del webhook ya usamos json
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
      success_url: "https://tuweb.com/success",
      cancel_url: "https://tuweb.com/cancel",
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error creando checkout" });
  }
});

// 🧪 TEST PAYMENT (para probar rápido)
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

// 🚀 SERVER
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});