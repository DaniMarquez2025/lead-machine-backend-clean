import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

const app = express();

// ⚠️ IMPORTANTE: webhook necesita raw antes que json
app.use("/webhook", express.raw({ type: "application/json" }));

app.use(cors());
app.use(express.json());

// 🔐 Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🟢 Ruta base
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// 💳 TEST CHECKOUT
app.get("/test-payment", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
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

    res.redirect(session.url);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creando sesión");
  }
});

// 🔔 WEBHOOK STRIPE
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

  // ✅ Pago completado
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    console.log("💰 Pago completado:", session.id);
  }

  res.json({ received: true });
});

// 🚀 PUERTO
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});