# LiFa Marketplace

A Shopee-style marketplace: browse by category, product detail pages, cart,
checkout with coupon codes, buyer/seller accounts, a seller dashboard for
listing products, and order history — backed by a real Postgres database
(Neon) and a real Express API.

Two parts:
- `server/` — Express API (Node), connects to Postgres
- `client/` — React (Vite) storefront

The Neon connection string is already filled in at `server/.env`.

## 1. Set up the database (one-time)

Open your Neon project → **SQL Editor**, and run these files **in this exact order**:

1. `schema.sql` — creates all tables (users, products, orders, coupons, etc.)
2. `seed.sql` — adds a demo seller + the Samsung Galaxy S24 Ultra product
3. `seed-more-products.sql` — adds 9 more demo products across categories
4. `add-coupons.sql` — adds 3 test coupon codes: `LIFA10`, `SAVE100`, `WELCOME50`
5. `add-user-coupons.sql` — adds the "collected coupons" wallet table
6. `add-payment-methods.sql` — adds the saved-cards table (for the profile page)

(Alternatively, with `psql` installed locally: `psql "$DATABASE_URL" -f schema.sql`, then the others the same way.)

## 2. Run the backend

```bash
cd server
npm install
npm run dev
```

You should see `Lifa API running on http://localhost:4000` with no red error
lines. Test it by opening `http://localhost:4000/api/products` in a browser —
you should see product data as JSON.

## 3. Run the frontend

In a **second terminal** (keep the first one running):

```bash
cd client
npm install
npm run dev
```

Open the URL it prints — usually `http://localhost:5173`.

## What's included

- **Browse & search UI** — product grid, category filter, product detail page
- **Cart** — add to cart, adjust quantity, remove items
- **Checkout** — address form, payment method selection, pick from your
  collected coupons, order summary. Runs in **test mode**: no real card is
  charged, but a real order is written to the database (stock is
  decremented, coupon usage is tracked, a real order number is generated).
- **Coupons** ("คูปอง" in the header) — Shopee-style: browse all active
  coupons and collect them into your account; only collected, unused coupons
  show up as pickable options at checkout (no free-text code entry)
- **Accounts** — register as a buyer or a seller, log in, session persists
  across page reloads (JWT stored in the browser)
- **Seller dashboard** ("ร้านของฉัน" in the header, visible to seller/admin
  accounts) — list your own products, add new ones with a real image upload
  (drag a file in, not a URL — stored on the server under `server/uploads/`
  and served back to the browser), toggle a product on/off, delete a
  product, see orders that came in for your products
- **Order history** ("คำสั่งซื้อ" in the header) — a buyer's past orders
- **Profile** (click your name in the header) — edit display name/phone,
  manage saved addresses (multiple, with a default), manage saved cards
  (test mode: only brand + last 4 digits are stored, never the full number
  or CVV). Checkout picks from these automatically instead of retyping
  every time.

## Role separation

Three roles exist in the database: `buyer`, `seller`, `admin`.
- **Every signup creates a `buyer` account** — same as real Shopee, there's no
  separate "seller signup." Any logged-in account can click **"เปิดร้านค้า"**
  (Open a Shop) in the header at any time to become a seller — this upgrades
  their role and creates a shop profile, without losing the ability to buy.
- `admin` accounts aren't created through public signup or self-serve upgrade
  — create one manually if needed:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'someone@example.com';
  ```
- Seller-only API routes (`/api/seller/*`) check the logged-in user's role on
  the server — a plain buyer's token can't call them even by hitting the URL
  directly, until they've opened a shop.

## Test payment details

Any card number, expiry, and CVV will "work" — this is explicitly a test
gateway, not connected to any real payment processor. See `CheckoutView` in
`client/src/App.jsx` for where a real processor (Omise, 2C2P, Stripe, etc.)
would eventually plug in.

## Notes

- `server/.env` contains your real database password. It's excluded from git
  via `server/.gitignore` — don't commit `.env` if you push this to GitHub.
  Since this password has been shared in a chat conversation, it's worth
  rotating it from the Neon dashboard when convenient.
- If the backend won't start, check the terminal for a red error — most
  often it means `npm install` didn't fully complete in `server/` after a
  new dependency was added (this project uses `bcryptjs` and `jsonwebtoken`
  for the auth system).
