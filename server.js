import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🟢 Ruta base
app.get("/", (req, res) => {
  res.send("Servidor funcionando 🚀");
});

// 💳 TEST CHECKOUT (SIN USUARIO)
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
            unit_amount: 2000, // 20€
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

// 🚀 PUERTO
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});