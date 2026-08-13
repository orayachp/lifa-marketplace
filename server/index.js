require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");

const productsRouter = require("./routes/products");
const categoriesRouter = require("./routes/categories");
const authRouter = require("./routes/auth");
const couponsRouter = require("./routes/coupons");
const sellerRouter = require("./routes/seller");
const ordersRouter = require("./routes/orders");
const profileRouter = require("./routes/profile");
const wishlistRouter = require("./routes/wishlist");
const reviewsRouter = require("./routes/reviews");
const shopsRouter = require("./routes/shops");
const adminRouter = require("./routes/admin");

const app = express();
app.use(cors());
app.use(express.json());

// Serve uploaded product images (written by server/routes/seller.js)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/categories", categoriesRouter);
app.use("/api/products", productsRouter);
app.use("/api/auth", authRouter);
app.use("/api/coupons", couponsRouter);
app.use("/api/seller", sellerRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/profile", profileRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/shops", shopsRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Lifa API running on http://localhost:${PORT}`);
});
