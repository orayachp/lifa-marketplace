import React, { useState, useMemo, useEffect } from "react";
import {
  Search, ShoppingCart, Heart, Star, ChevronRight, Minus, Plus,
  ShieldCheck, Truck, RotateCcw, Store, Trash2, ChevronLeft, Menu, Loader2,
  MapPin, CreditCard, Landmark, Wallet, CheckCircle2, Copy, Home,
  User, LogOut, Mail, Lock, Phone, Tag, X, Package, PlusCircle, Edit3, Trash, ImagePlus
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const DEMO_SLUG = "samsung-galaxy-s24-ultra-titanium"; // the product seeded by seed.sql

const THB = (n) => Number(n).toLocaleString("th-TH");

// ---------------------------------------------------------------------------

function LifaLogo({ size = 44 }) {
  return (
    <img
      src="/logo.jpg"
      alt="LiFa"
      className="select-none rounded-md"
      style={{ height: size, width: "auto", objectFit: "contain" }}
    />
  );
}

function StarRow({ rating, size = 14 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function App() {
  const [view, setView] = useState("list");
  const [categories, setCategories] = useState([]);
  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | error

  const [selectedSlug, setSelectedSlug] = useState(DEMO_SLUG);
  const [activeCategory, setActiveCategory] = useState(null); // category slug or null = all
  const [listProducts, setListProducts] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const [activeImg, setActiveImg] = useState(0);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState("");
  const [lastOrder, setLastOrder] = useState(null);

  // --- Auth state -----------------------------------------------------
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("lifa_token"));
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false); // came from "checkout" while logged out

  // On load, validate any stored token against the server
  useEffect(() => {
    if (!authToken) { setAuthChecked(true); return; }
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => setAuthUser(data.user))
      .catch(() => { localStorage.removeItem("lifa_token"); setAuthToken(null); })
      .finally(() => setAuthChecked(true));
  }, [authToken]);

  function handleAuthSuccess(token, user) {
    localStorage.setItem("lifa_token", token);
    setAuthToken(token);
    setAuthUser(user);
    if (pendingCheckout) {
      setPendingCheckout(false);
      setView("checkout");
    } else {
      setView("list");
    }
  }
  function logout() {
    localStorage.removeItem("lifa_token");
    setAuthToken(null);
    setAuthUser(null);
    setView("list");
  }
  function goToCheckout() {
    if (!authUser) {
      setPendingCheckout(true);
      setView("login");
    } else {
      setView("checkout");
    }
  }
  async function becomeSeller() {
    const res = await fetch(`${API}/api/auth/become-seller`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ shopName: authUser?.display_name }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "เปิดร้านค้าไม่สำเร็จ");
      return;
    }
    localStorage.setItem("lifa_token", data.token);
    setAuthToken(data.token);
    setAuthUser(data.user);
    setView("seller");
    showToast("เปิดร้านค้าสำเร็จ! เริ่มลงสินค้าได้เลย");
  }

  // Load categories once on mount
  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .catch((err) => console.error(err));
  }, []);

  // Load the selected product whenever selectedSlug changes
  useEffect(() => {
    setStatus("loading");
    fetch(`${API}/api/products/${selectedSlug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Product fetch failed");
        return r.json();
      })
      .then((prod) => {
        setProduct(prod);
        setVariantId(prod.variants?.[0]?.id ?? null);
        setActiveImg(0);
        setStatus("ok");
      })
      .catch((err) => {
        console.error(err);
        setStatus("error");
      });
  }, [selectedSlug]);

  // Load the product grid whenever the view is "list", or the category/search changes
  const [searchQuery, setSearchQuery] = useState(null); // null = not searching
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    if (view !== "list") return;
    setListLoading(true);
    const params = new URLSearchParams();
    if (activeCategory) params.set("category", activeCategory);
    if (searchQuery) params.set("q", searchQuery);
    fetch(`${API}/api/products?${params.toString()}`)
      .then((r) => r.json())
      .then(setListProducts)
      .catch((err) => console.error(err))
      .finally(() => setListLoading(false));
  }, [view, activeCategory, searchQuery]);

  function openProduct(slug) {
    setSelectedSlug(slug);
    setView("product");
  }
  function openList(categorySlug = null) {
    setActiveCategory(categorySlug);
    setSearchQuery(null);
    setView("list");
  }
  function runSearch(term) {
    setActiveCategory(null);
    setSearchQuery(term);
    setView("list");
  }
  const [shopSlug, setShopSlug] = useState(null);
  function openShop(slug) {
    setShopSlug(slug);
    setView("shop");
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  }

  function addToCart(buyNow = false) {
    if (!product) return;
    const variant = product.variants.find((v) => v.id === variantId);
    const unitPrice = Number(product.price) + Number(variant?.price_delta || 0);
    const key = `${product.id}-${variantId}`;
    setCart((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i));
      return [
        ...prev,
        { key, id: product.id, name: product.name, img: product.images[0], price: unitPrice, variantName: variant?.name, qty },
      ];
    });
    showToast(buyNow ? "ไปที่ตะกร้าเพื่อชำระเงิน" : "เพิ่มลงตะกร้าแล้ว");
    if (buyNow) setView("cart");
  }

  function updateQty(key, delta) {
    setCart((prev) => prev.map((i) => (i.key === key ? { ...i, qty: Math.max(1, i.qty + delta) } : i)).filter((i) => i.qty > 0));
  }
  function removeItem(key) {
    setCart((prev) => prev.filter((i) => i.key !== key));
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa]" style={{ fontFamily: "'Noto Sans Thai', Inter, sans-serif" }}>
      <header style={{ background: "linear-gradient(180deg,#0b1a3d 0%,#0d234f 100%)" }} className="sticky top-0 z-30 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <button className="md:hidden text-amber-200"><Menu size={22} /></button>
          <button onClick={() => openList(null)} className="shrink-0"><LifaLogo /></button>
          <div className="flex-1 flex items-center bg-white rounded-full overflow-hidden max-w-xl">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch(searchInput.trim())}
              placeholder="ค้นหาสินค้า, ร้านค้า หรือแบรนด์"
              className="flex-1 px-4 py-2 text-sm text-gray-700 outline-none"
            />
            <button onClick={() => runSearch(searchInput.trim())} className="px-4 py-2 text-white" style={{ background: "#c9982f" }}>
              <Search size={18} />
            </button>
          </div>
          <button onClick={() => setView("coupons")} className="hidden sm:flex items-center gap-1 text-amber-100/90 hover:text-amber-200 text-sm">
            <Tag size={17} /> คูปอง
          </button>
          <button onClick={() => (authUser ? setView("wishlist") : setView("login"))} className="hidden sm:flex text-amber-100/90 hover:text-amber-200">
            <Heart size={20} />
          </button>
          <button onClick={() => setView("cart")} className="relative flex items-center text-amber-100/90 hover:text-amber-200">
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-amber-400 text-[#0b1a3d] text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
          {authUser ? (
            <div className="hidden sm:flex items-center gap-3">
              {authUser.role === "seller" || authUser.role === "admin" ? (
                <button onClick={() => setView("seller")} className="flex items-center gap-1 text-amber-100/90 hover:text-amber-200 text-sm">
                  <Store size={15} /> ร้านของฉัน
                </button>
              ) : (
                <button onClick={becomeSeller} className="flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full border border-amber-400/40 text-amber-200 hover:bg-amber-400/10">
                  <Store size={14} /> เปิดร้านค้า
                </button>
              )}
              {authUser.role === "admin" && (
                <button onClick={() => setView("admin")} className="flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full border border-red-300/40 text-red-200 hover:bg-red-400/10">
                  <ShieldCheck size={14} /> แอดมิน
                </button>
              )}
              <button onClick={() => setView("orders")} className="flex items-center gap-1 text-amber-100/90 hover:text-amber-200 text-sm">
                <Package size={15} /> คำสั่งซื้อ
              </button>
              <button onClick={() => setView("profile")} className="flex items-center gap-1.5 text-amber-100 hover:text-amber-200 text-sm">
                <User size={16} /> {authUser.display_name}
              </button>
              <button onClick={logout} className="text-amber-100/70 hover:text-amber-200" title="ออกจากระบบ">
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setView("login")}
              className="text-sm px-3 py-1.5 rounded-full font-medium"
              style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)", color: "#fff" }}
            >
              เข้าสู่ระบบ
            </button>
          )}
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-2 flex gap-5 overflow-x-auto text-[13px] text-amber-100/80">
          <span
            onClick={() => openList(null)}
            className="whitespace-nowrap cursor-pointer"
            style={!activeCategory && view === "list" ? { color: "#f0d18a", fontWeight: 600 } : {}}
          >
            ทั้งหมด
          </span>
          {categories.map((c) => (
            <span
              key={c.slug}
              onClick={() => openList(c.slug)}
              className="whitespace-nowrap hover:text-amber-300 cursor-pointer"
              style={activeCategory === c.slug ? { color: "#f0d18a", fontWeight: 600 } : {}}
            >
              {c.name}
            </span>
          ))}
        </div>
      </header>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#0b1a3d] text-amber-200 px-5 py-2.5 rounded-full text-sm shadow-lg border border-amber-400/30">
          {toast}
        </div>
      )}

      {status === "loading" && view === "product" && (
        <div className="flex flex-col items-center justify-center py-32 text-gray-400 gap-3">
          <Loader2 className="animate-spin" size={28} />
          กำลังโหลดข้อมูลจาก Neon...
        </div>
      )}

      {status === "error" && view === "product" && (
        <div className="max-w-xl mx-auto mt-10 bg-white border border-red-200 rounded-xl p-6 text-sm text-gray-700">
          <p className="font-semibold text-red-500 mb-2">เชื่อมต่อ API ไม่สำเร็จ</p>
          <p>เช็คว่า backend รันอยู่ที่ <code className="bg-gray-100 px-1 rounded">{API}</code> แล้วหรือยัง (รัน <code className="bg-gray-100 px-1 rounded">npm run dev</code> ในโฟลเดอร์ server/) และรัน schema.sql + seed.sql บน Neon แล้วหรือยัง</p>
        </div>
      )}

      {status === "ok" && view === "product" && (
        <ProductView
          product={product} activeImg={activeImg} setActiveImg={setActiveImg}
          variantId={variantId} setVariantId={setVariantId}
          qty={qty} setQty={setQty} addToCart={addToCart}
          onHome={() => openList(null)}
          onOpenShop={openShop}
          authToken={authToken} isLoggedIn={!!authUser}
          onGoLogin={() => setView("login")}
        />
      )}
      {view === "list" && (
        <ProductListView
          products={listProducts} loading={listLoading}
          categories={categories} activeCategory={activeCategory}
          onSelectCategory={openList} onOpenProduct={openProduct}
        />
      )}
      {view === "cart" && (
        <CartView
          cart={cart} updateQty={updateQty} removeItem={removeItem} total={cartTotal}
          onBack={() => openList(null)}
          onCheckout={goToCheckout}
        />
      )}
      {view === "login" && (
        <LoginView
          onSuccess={handleAuthSuccess}
          onGoRegister={() => setView("register")}
        />
      )}
      {view === "register" && (
        <RegisterView
          onSuccess={handleAuthSuccess}
          onGoLogin={() => setView("login")}
        />
      )}
      {view === "checkout" && (
        <CheckoutView
          cart={cart} total={cartTotal} authToken={authToken}
          onBack={() => setView("cart")}
          onPaid={(order) => { setLastOrder(order); setCart([]); setView("success"); }}
        />
      )}
      {view === "success" && lastOrder && (
        <SuccessView order={lastOrder} onDone={() => openList(null)} />
      )}
      {view === "seller" && authUser && (authUser.role === "seller" || authUser.role === "admin") && (
        <SellerDashboard authToken={authToken} categories={categories} />
      )}
      {view === "orders" && authUser && (
        <OrderHistoryView authToken={authToken} onBrowse={() => openList(null)} />
      )}
      {view === "coupons" && (
        <CouponsView authToken={authToken} isLoggedIn={!!authUser} onGoLogin={() => setView("login")} />
      )}
      {view === "profile" && authUser && (
        <ProfileView
          authToken={authToken} authUser={authUser}
          onUserUpdated={(u) => { setAuthUser(u); }}
        />
      )}
      {view === "wishlist" && authUser && (
        <WishlistView authToken={authToken} onOpenProduct={openProduct} />
      )}
      {view === "shop" && shopSlug && (
        <ShopView slug={shopSlug} onOpenProduct={openProduct} />
      )}
      {view === "admin" && authUser?.role === "admin" && (
        <AdminDashboard authToken={authToken} />
      )}

      <footer className="bg-[#0b1a3d] text-amber-100/50 text-xs text-center py-6 mt-10">
        © 2026 LiFa Marketplace — ข้อมูลสินค้าดึงจาก Neon Postgres แบบเรียลไทม์
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProductView({
  product, activeImg, setActiveImg, variantId, setVariantId, qty, setQty, addToCart, onHome,
  onOpenShop, authToken, isLoggedIn, onGoLogin,
}) {
  const compareAt = Number(product.compare_at_price || 0);
  const price = Number(product.price);
  const discount = compareAt ? Math.round((1 - price / compareAt) * 100) : 0;

  const [inWishlist, setInWishlist] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  async function toggleWishlist() {
    if (!isLoggedIn) return onGoLogin();
    setWishlistBusy(true);
    try {
      if (inWishlist) {
        await fetch(`${API}/api/wishlist/${product.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
        setInWishlist(false);
      } else {
        await fetch(`${API}/api/wishlist/${product.id}`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
        setInWishlist(true);
      }
    } finally {
      setWishlistBusy(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-5">
      <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
        <span onClick={onHome} className="cursor-pointer hover:text-amber-600">หน้าแรก</span> <ChevronRight size={12} />
        <span className="text-gray-700">{product.name}</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5 grid md:grid-cols-2 gap-8">
        <div>
          <div className="rounded-xl overflow-hidden bg-gray-50 aspect-square">
            <img src={product.images[activeImg]} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2 mt-3">
            {product.images.map((img, i) => (
              <button key={i} onClick={() => setActiveImg(i)} className="w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0"
                style={{ borderColor: i === activeImg ? "#c9982f" : "transparent" }}>
                <img src={img} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-semibold text-gray-900 leading-snug">{product.name}</h1>
            <button onClick={toggleWishlist} disabled={wishlistBusy} className="shrink-0 p-2 rounded-full border hover:bg-gray-50">
              <Heart size={18} className={inWishlist ? "fill-red-500 text-red-500" : "text-gray-400"} />
            </button>
          </div>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <span className="font-medium text-amber-600">{product.rating_avg}</span>
              <StarRow rating={product.rating_avg} />
            </div>
            <span className="border-l pl-3">{THB(product.rating_count)} รีวิว</span>
            <span className="border-l pl-3">ขายแล้ว {THB(product.sold_count)} ชิ้น</span>
          </div>

          <div className="mt-4 bg-[#fff8ec] rounded-xl p-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold" style={{ color: "#b9791f" }}>฿{THB(price)}</span>
            {compareAt > 0 && <span className="text-gray-400 line-through text-sm">฿{THB(compareAt)}</span>}
            {discount > 0 && <span className="text-xs font-semibold text-white bg-red-500 rounded px-2 py-0.5">-{discount}%</span>}
          </div>

          {product.variants?.length > 0 && (
            <div className="mt-5">
              <div className="text-sm text-gray-500 mb-2">ตัวเลือกสินค้า</div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button key={v.id} onClick={() => setVariantId(v.id)} className="px-3 py-1.5 rounded-lg text-sm border"
                    style={variantId === v.id ? { borderColor: "#c9982f", background: "#fff8ec", color: "#8a6417" } : { borderColor: "#e5e7eb", color: "#374151" }}>
                    {v.name} {v.price_delta > 0 ? `(+฿${THB(v.price_delta)})` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="text-sm text-gray-500 mb-2">จำนวน</div>
            <div className="inline-flex items-center border rounded-lg">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2 text-gray-600 hover:bg-gray-50"><Minus size={14} /></button>
              <span className="w-10 text-center text-sm">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="p-2 text-gray-600 hover:bg-gray-50"><Plus size={14} /></button>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={() => addToCart(false)} className="flex-1 flex items-center justify-center gap-2 border-2 rounded-xl py-3 font-medium text-sm"
              style={{ borderColor: "#c9982f", color: "#8a6417" }}>
              <ShoppingCart size={18} /> เพิ่มลงตะกร้า
            </button>
            <button onClick={() => addToCart(true)} className="flex-1 rounded-xl py-3 font-medium text-sm text-white"
              style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
              ซื้อเลย
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-gray-500">
            <div className="flex flex-col items-center gap-1"><ShieldCheck size={18} className="text-amber-600" />รับประกันของแท้</div>
            <div className="flex flex-col items-center gap-1"><Truck size={18} className="text-amber-600" />จัดส่งฟรีทั่วไทย</div>
            <div className="flex flex-col items-center gap-1"><RotateCcw size={18} className="text-amber-600" />คืนสินค้าได้ 7 วัน</div>
          </div>
        </div>
      </div>

      {product.shop_name && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mt-4 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#0b1a3d" }}>
            <Store size={24} className="text-amber-300" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-800 flex items-center gap-2">
              {product.shop_name}
              {product.shop_verified && <ShieldCheck size={15} className="text-amber-500" />}
            </div>
            <div className="text-xs text-gray-500 mt-1">คะแนนร้าน {product.shop_rating}</div>
          </div>
          {product.shop_slug && (
            <button onClick={() => onOpenShop(product.shop_slug)} className="border rounded-lg px-4 py-2 text-sm font-medium" style={{ borderColor: "#c9982f", color: "#8a6417" }}>
              ดูร้านค้า
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-5 mt-4">
        <h2 className="font-semibold text-gray-800 mb-2">รายละเอียดสินค้า</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
      </div>

      <ProductReviews productId={product.id} authToken={authToken} isLoggedIn={isLoggedIn} onGoLogin={onGoLogin} />
    </main>
  );
}

// ---------------------------------------------------------------------------

function ProductReviews({ productId, authToken, isLoggedIn, onGoLogin }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function load() {
    setLoading(true);
    fetch(`${API}/api/reviews/product/${productId}`).then((r) => r.json()).then(setReviews)
      .catch((e) => console.error(e)).finally(() => setLoading(false));
    if (isLoggedIn) {
      fetch(`${API}/api/reviews/mine/${productId}`, { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => r.json()).then((d) => setAlreadyReviewed(d.reviewed)).catch((e) => console.error(e));
    }
  }
  useEffect(() => { load(); }, [productId]);

  async function submitReview(e) {
    e.preventDefault();
    if (!isLoggedIn) return onGoLogin();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ productId, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ส่งรีวิวไม่สำเร็จ");
      setShowForm(false);
      setComment("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800">รีวิวสินค้า ({reviews.length})</h2>
        {isLoggedIn && !alreadyReviewed && (
          <button onClick={() => setShowForm((s) => !s)} className="text-sm font-medium" style={{ color: "#b9791f" }}>
            {showForm ? "ยกเลิก" : "+ เขียนรีวิว"}
          </button>
        )}
      </div>

      {alreadyReviewed && <p className="text-xs text-gray-400 mb-3">คุณรีวิวสินค้านี้ไปแล้ว</p>}

      {showForm && (
        <form onSubmit={submitReview} className="border rounded-lg p-4 mb-4 space-y-3">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}>
                <Star size={22} className={n <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"} />
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3}
            placeholder="เล่าประสบการณ์การใช้งานสินค้านี้..."
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
          {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          <button type="submit" disabled={submitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
            {submitting ? "กำลังส่ง..." : "ส่งรีวิว"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8 text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center">ยังไม่มีรีวิว เป็นคนแรกที่รีวิวสินค้านี้!</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="border-t pt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800">{r.buyer_name}</span>
                <StarRow rating={r.rating} size={12} />
              </div>
              {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function CartView({ cart, updateQty, removeItem, total, onBack, onCheckout }) {
  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700">
        <ChevronLeft size={16} /> กลับไปหน้าสินค้า
      </button>
      <h1 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <ShoppingCart size={20} style={{ color: "#c9982f" }} /> ตะกร้าสินค้า ({cart.length})
      </h1>

      {cart.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-400">
          <ShoppingCart size={40} className="mx-auto mb-3 text-gray-300" />
          ตะกร้าของคุณว่างเปล่า
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-5">
          <div className="md:col-span-2 space-y-3">
            {cart.map((item) => (
              <div key={item.key} className="bg-white rounded-xl shadow-sm p-4 flex gap-4 items-center">
                <img src={item.img} className="w-20 h-20 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 line-clamp-2">{item.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{item.variantName}</div>
                  <div className="text-sm font-semibold mt-1" style={{ color: "#b9791f" }}>฿{THB(item.price)}</div>
                </div>
                <div className="flex items-center border rounded-lg">
                  <button onClick={() => updateQty(item.key, -1)} className="p-1.5 text-gray-600 hover:bg-gray-50"><Minus size={13} /></button>
                  <span className="w-8 text-center text-sm">{item.qty}</span>
                  <button onClick={() => updateQty(item.key, 1)} className="p-1.5 text-gray-600 hover:bg-gray-50"><Plus size={13} /></button>
                </div>
                <button onClick={() => removeItem(item.key)} className="text-gray-300 hover:text-red-400"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 h-fit">
            <h2 className="font-semibold text-gray-800 mb-3 text-sm">สรุปคำสั่งซื้อ</h2>
            <div className="flex justify-between text-sm text-gray-500 mb-2"><span>ยอดรวมสินค้า</span><span>฿{THB(total)}</span></div>
            <div className="flex justify-between text-sm text-gray-500 mb-3"><span>ค่าจัดส่ง</span><span className="text-green-600">ฟรี</span></div>
            <div className="border-t pt-3 flex justify-between font-semibold text-gray-800">
              <span>ยอดชำระทั้งหมด</span><span style={{ color: "#b9791f" }}>฿{THB(total)}</span>
            </div>
            <button
              onClick={onCheckout}
              className="mt-4 w-full rounded-xl py-3 font-medium text-sm text-white"
              style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}
            >
              ดำเนินการชำระเงิน
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Auth — login / register. Talks to /api/auth/*, stores the JWT via the
// parent App component (localStorage). No password strength meter, kept
// simple: server enforces a 6-char minimum.
// ---------------------------------------------------------------------------

function AuthShell({ title, subtitle, children }) {
  return (
    <main className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white rounded-2xl shadow-sm p-7">
        <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">{subtitle}</p>
        {children}
      </div>
    </main>
  );
}

function LoginView({ onSuccess, onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      onSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="เข้าสู่ระบบ" subtitle="เข้าสู่ระบบเพื่อดำเนินการชำระเงินและดูประวัติคำสั่งซื้อ">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center border rounded-lg px-3">
          <Mail size={16} className="text-gray-400" />
          <input required type="email" placeholder="อีเมล" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-2 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex items-center border rounded-lg px-3">
          <Lock size={16} className="text-gray-400" />
          <input required type="password" placeholder="รหัสผ่าน" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 px-2 py-2.5 text-sm outline-none" />
        </div>
        {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl py-2.5 font-medium text-sm text-white disabled:opacity-70"
          style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
          {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4 text-center">
        ยังไม่มีบัญชี?{" "}
        <button onClick={onGoRegister} className="font-medium" style={{ color: "#b9791f" }}>สมัครสมาชิก</button>
      </p>
    </AuthShell>
  );
}

function RegisterView({ onSuccess, onGoLogin }) {
  const [form, setForm] = useState({ displayName: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สมัครสมาชิกไม่สำเร็จ");
      onSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="สมัครสมาชิก" subtitle="สร้างบัญชี ใช้เวลาไม่ถึงนาที — เปิดร้านขายของทีหลังได้ทุกเมื่อจากบัญชีเดียวกัน">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center border rounded-lg px-3">
          <User size={16} className="text-gray-400" />
          <input required placeholder="ชื่อที่ใช้แสดง" value={form.displayName}
            onChange={set("displayName")} className="flex-1 px-2 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex items-center border rounded-lg px-3">
          <Mail size={16} className="text-gray-400" />
          <input required type="email" placeholder="อีเมล" value={form.email}
            onChange={set("email")} className="flex-1 px-2 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex items-center border rounded-lg px-3">
          <Phone size={16} className="text-gray-400" />
          <input placeholder="เบอร์โทรศัพท์ (ไม่บังคับ)" value={form.phone}
            onChange={set("phone")} className="flex-1 px-2 py-2.5 text-sm outline-none" />
        </div>
        <div className="flex items-center border rounded-lg px-3">
          <Lock size={16} className="text-gray-400" />
          <input required type="password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)" value={form.password}
            onChange={set("password")} className="flex-1 px-2 py-2.5 text-sm outline-none" />
        </div>
        {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
        <button type="submit" disabled={loading}
          className="w-full rounded-xl py-2.5 font-medium text-sm text-white disabled:opacity-70"
          style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
          {loading ? "กำลังสมัคร..." : "สมัครสมาชิก"}
        </button>
      </form>
      <p className="text-sm text-gray-500 mt-4 text-center">
        มีบัญชีอยู่แล้ว?{" "}
        <button onClick={onGoLogin} className="font-medium" style={{ color: "#b9791f" }}>เข้าสู่ระบบ</button>
      </p>
    </AuthShell>
  );
}

// ---------------------------------------------------------------------------
// Product listing — grid of products, filterable by category chips.
// ---------------------------------------------------------------------------

function ProductListView({ products, loading, categories, activeCategory, onSelectCategory, onOpenProduct }) {
  const activeCategoryName = categories.find((c) => c.slug === activeCategory)?.name;

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-gray-800 mb-1">
        {activeCategoryName ? activeCategoryName : "สินค้าทั้งหมด"}
      </h1>
      <p className="text-sm text-gray-500 mb-4">{loading ? "กำลังโหลด..." : `พบ ${products.length} รายการ`}</p>

      {/* category chips (repeats the header nav, handy on mobile) */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-5">
        <button
          onClick={() => onSelectCategory(null)}
          className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs border"
          style={!activeCategory ? { borderColor: "#c9982f", background: "#fff8ec", color: "#8a6417" } : { borderColor: "#e5e7eb", color: "#374151" }}
        >
          ทั้งหมด
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            onClick={() => onSelectCategory(c.slug)}
            className="whitespace-nowrap px-3 py-1.5 rounded-full text-xs border"
            style={activeCategory === c.slug ? { borderColor: "#c9982f", background: "#fff8ec", color: "#8a6417" } : { borderColor: "#e5e7eb", color: "#374151" }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
          <Loader2 className="animate-spin" size={26} />
          กำลังโหลดสินค้า...
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-400">
          ไม่พบสินค้าในหมวดหมู่นี้
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {products.map((p) => {
            const compareAt = Number(p.compare_at_price || 0);
            const price = Number(p.price);
            const discount = compareAt ? Math.round((1 - price / compareAt) * 100) : 0;
            return (
              <div
                key={p.id}
                onClick={() => onOpenProduct(p.slug)}
                className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition"
              >
                <div className="relative aspect-square bg-gray-50">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  {discount > 0 && (
                    <span className="absolute top-2 left-2 text-[10px] font-semibold text-white bg-red-500 rounded px-1.5 py-0.5">
                      -{discount}%
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-xs text-gray-700 line-clamp-2 h-8">{p.name}</div>
                  <div className="text-sm font-semibold mt-1" style={{ color: "#b9791f" }}>฿{THB(price)}</div>
                  <div className="flex items-center gap-1 mt-1 text-[11px] text-gray-400">
                    <Star size={11} className="fill-amber-400 text-amber-400" />
                    {p.rating_avg} · ขายแล้ว {THB(p.sold_count)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Checkout — address + payment method + mock card entry.
// TEST MODE: no real payment gateway is called. This simulates a delay then
// "succeeds", so you can validate the full UX before wiring a real processor
// (e.g. Omise / 2C2P / Stripe) behind the "จ่าย" button.
// ---------------------------------------------------------------------------

function CheckoutView({ cart, total, authToken, onBack, onPaid }) {
  const [address, setAddress] = useState({
    name: "", phone: "", line1: "", district: "", province: "", postalCode: "",
  });
  const [method, setMethod] = useState("credit_card");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  // --- Saved addresses & cards (from the profile) ---------------------
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [savedCards, setSavedCards] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [showNewCardForm, setShowNewCardForm] = useState(false);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${authToken}` };
    fetch(`${API}/api/profile/addresses`, { headers }).then((r) => r.json()).then((rows) => {
      setSavedAddresses(rows);
      const def = rows.find((a) => a.is_default) || rows[0];
      if (def) {
        setSelectedAddressId(def.id);
        setAddress({
          name: def.recipient_name, phone: def.phone, line1: def.line1,
          district: [def.subdistrict, def.district].filter(Boolean).join(" "),
          province: def.province, postalCode: def.postal_code || "",
        });
      } else {
        setShowNewAddressForm(true);
      }
    }).catch((e) => console.error(e));

    fetch(`${API}/api/profile/cards`, { headers }).then((r) => r.json()).then((rows) => {
      setSavedCards(rows);
      const def = rows.find((c) => c.is_default) || rows[0];
      if (def) setSelectedCardId(def.id);
      else setShowNewCardForm(true);
    }).catch((e) => console.error(e));
  }, [authToken]);

  function pickAddress(a) {
    setSelectedAddressId(a.id);
    setShowNewAddressForm(false);
    setAddress({
      name: a.recipient_name, phone: a.phone, line1: a.line1,
      district: [a.subdistrict, a.district].filter(Boolean).join(" "),
      province: a.province, postalCode: a.postal_code || "",
    });
  }

  function pickCard(c) {
    setSelectedCardId(c.id);
    setShowNewCardForm(false);
    setCard({ number: `•••• •••• •••• ${c.last4}`, name: c.cardholder_name, expiry: c.expiry, cvv: "123" });
  }

  // --- Coupon (picked from the user's collected wallet, Shopee-style) ------
  const [myCoupons, setMyCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(true);
  const [showCouponPicker, setShowCouponPicker] = useState(false);
  const [coupon, setCoupon] = useState(null); // { code, description, discountAmount }
  const [couponChecking, setCouponChecking] = useState(false);
  const [couponError, setCouponError] = useState("");

  const discount = coupon?.discountAmount || 0;
  const grandTotal = Math.max(0, total - discount);

  useEffect(() => {
    fetch(`${API}/api/coupons/mine`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then(setMyCoupons)
      .catch((err) => console.error(err))
      .finally(() => setCouponsLoading(false));
  }, [authToken]);

  const usableCoupons = myCoupons.filter(
    (uc) => !uc.used_at && Number(total) >= Number(uc.min_order_amount)
  );

  async function applyCoupon(code) {
    setCouponChecking(true);
    setCouponError("");
    try {
      const res = await fetch(`${API}/api/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ code, subtotal: total }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ใช้คูปองไม่สำเร็จ");
      setCoupon(data);
      setShowCouponPicker(false);
    } catch (err) {
      setCouponError(err.message);
    } finally {
      setCouponChecking(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponError("");
  }

  const addressValid = address.name && address.phone && address.line1 && address.province;
  const cardValid =
    method !== "credit_card" ||
    (card.number.replace(/\s/g, "").length >= 12 && card.name && card.expiry && card.cvv.length >= 3);

  function formatCardNumber(v) {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }

  async function handlePay() {
    setError("");
    if (!addressValid) return setError("กรุณากรอกที่อยู่จัดส่งให้ครบ");
    if (!cardValid) return setError("กรุณากรอกข้อมูลบัตรให้ครบ (โหมดทดสอบ ใช้เลขอะไรก็ได้)");

    setPaying(true);
    try {
      // TEST MODE — no real card charge — but this creates a real order,
      // real order_items, and decrements real stock in the database.
      await new Promise((r) => setTimeout(r, 1000)); // simulate gateway delay

      const res = await fetch(`${API}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          items: cart.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
          address, method, couponCode: coupon?.code || null,
          discount, subtotal: total, total: grandTotal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "สร้างคำสั่งซื้อไม่สำเร็จ");

      onPaid({
        orderNo: data.orderNo,
        items: cart,
        subtotal: total,
        discount,
        couponCode: coupon?.code || null,
        total: grandTotal,
        method,
        address,
        paidAt: data.createdAt,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPaying(false);
    }
  }

  const methods = [
    { id: "credit_card", label: "บัตรเครดิต/เดบิต", icon: CreditCard },
    { id: "promptpay", label: "พร้อมเพย์ (QR)", icon: Wallet },
    { id: "bank_transfer", label: "โอนผ่านธนาคาร", icon: Landmark },
  ];

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700">
        <ChevronLeft size={16} /> กลับไปตะกร้า
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-800">ชำระเงิน</h1>
        <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 rounded-full px-3 py-1">
          โหมดทดสอบ — ยังไม่มีการตัดเงินจริง
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-4">
          {/* Address */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <MapPin size={16} style={{ color: "#c9982f" }} /> ที่อยู่จัดส่ง
              </h2>
              {savedAddresses.length > 0 && (
                <button onClick={() => setShowNewAddressForm((s) => !s)} className="text-xs font-medium" style={{ color: "#b9791f" }}>
                  {showNewAddressForm ? "ใช้ที่อยู่ที่บันทึกไว้" : "+ ที่อยู่ใหม่"}
                </button>
              )}
            </div>

            {savedAddresses.length > 0 && !showNewAddressForm ? (
              <div className="space-y-2">
                {savedAddresses.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => pickAddress(a)}
                    className="w-full text-left border rounded-lg px-3 py-2.5 text-sm"
                    style={selectedAddressId === a.id ? { borderColor: "#c9982f", background: "#fff8ec" } : { borderColor: "#e5e7eb" }}
                  >
                    <div className="font-medium text-gray-800">{a.recipient_name} <span className="text-gray-400 font-normal">· {a.phone}</span></div>
                    <div className="text-xs text-gray-500 mt-0.5">{a.line1} {a.subdistrict} {a.district} {a.province} {a.postal_code}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <input placeholder="ชื่อผู้รับ" value={address.name}
                  onChange={(e) => setAddress({ ...address, name: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
                <input placeholder="เบอร์โทรศัพท์" value={address.phone}
                  onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
                <input placeholder="ที่อยู่ (บ้านเลขที่, ถนน)" value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2" />
                <input placeholder="เขต/อำเภอ" value={address.district}
                  onChange={(e) => setAddress({ ...address, district: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
                <input placeholder="จังหวัด" value={address.province}
                  onChange={(e) => setAddress({ ...address, province: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
                <input placeholder="รหัสไปรษณีย์" value={address.postalCode}
                  onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-2">
              จัดการที่อยู่ทั้งหมดได้ที่หน้าโปรไฟล์ → ที่อยู่จัดส่ง
            </p>
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 text-sm mb-3">วิธีชำระเงิน</h2>
            <div className="grid sm:grid-cols-3 gap-2">
              {methods.map((m) => {
                const Icon = m.icon;
                return (
                  <button key={m.id} onClick={() => setMethod(m.id)}
                    className="flex flex-col items-center gap-1.5 rounded-lg border py-3 text-xs"
                    style={method === m.id ? { borderColor: "#c9982f", background: "#fff8ec", color: "#8a6417" } : { borderColor: "#e5e7eb", color: "#374151" }}>
                    <Icon size={18} />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {method === "credit_card" && (
              <div className="mt-4">
                {savedCards.length > 0 && !showNewCardForm ? (
                  <div className="space-y-2">
                    {savedCards.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => pickCard(c)}
                        className="w-full flex items-center gap-2 text-left border rounded-lg px-3 py-2.5 text-sm"
                        style={selectedCardId === c.id ? { borderColor: "#c9982f", background: "#fff8ec" } : { borderColor: "#e5e7eb" }}
                      >
                        <CreditCard size={16} className="text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-800">{c.brand} •••• {c.last4}</span>
                        <span className="text-xs text-gray-400">{c.cardholder_name} · {c.expiry}</span>
                      </button>
                    ))}
                    <button onClick={() => setShowNewCardForm(true)} className="text-xs font-medium" style={{ color: "#b9791f" }}>
                      + ใช้บัตรอื่น
                    </button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {savedCards.length > 0 && (
                      <button onClick={() => setShowNewCardForm(false)} className="text-xs font-medium sm:col-span-2 text-left" style={{ color: "#b9791f" }}>
                        ← ใช้บัตรที่บันทึกไว้
                      </button>
                    )}
                    <input placeholder="หมายเลขบัตร (ทดสอบ: 4242 4242 4242 4242)" value={card.number}
                      onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                      className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2" />
                    <input placeholder="ชื่อบนบัตร" value={card.name}
                      onChange={(e) => setCard({ ...card, name: e.target.value })}
                      className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2" />
                    <input placeholder="MM/YY" value={card.expiry}
                      onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                      className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
                    <input placeholder="CVV" value={card.cvv} maxLength={4}
                      onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "") })}
                      className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
                  </div>
                )}
              </div>
            )}
            {method === "promptpay" && (
              <div className="mt-4 flex flex-col items-center gap-2 py-6 bg-gray-50 rounded-lg">
                <div className="w-36 h-36 bg-white border rounded-lg flex items-center justify-center text-[11px] text-gray-400">
                  QR โค้ดทดสอบ
                </div>
                <p className="text-xs text-gray-500">สแกนเพื่อชำระ (โหมดทดสอบ กด "จ่ายเงิน" ด้านล่างเพื่อจำลองการชำระสำเร็จ)</p>
              </div>
            )}
            {method === "bank_transfer" && (
              <div className="mt-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-4">
                โอนเข้าบัญชี LiFa Marketplace (เลขบัญชีทดสอบ 123-4-56789-0) แล้วกด "จ่ายเงิน" เพื่อจำลองการยืนยันสลิป
              </div>
            )}
          </div>

          {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{error}</div>}
        </div>

        {/* summary */}
        <div className="bg-white rounded-xl shadow-sm p-5 h-fit">
          <h2 className="font-semibold text-gray-800 mb-3 text-sm">สรุปคำสั่งซื้อ</h2>
          {cart.map((item) => (
            <div key={item.key} className="flex justify-between text-xs text-gray-500 mb-2">
              <span className="line-clamp-1 pr-2">{item.name} × {item.qty}</span>
              <span className="shrink-0">฿{THB(item.price * item.qty)}</span>
            </div>
          ))}

          {/* coupon — picked from the user's collected wallet */}
          <div className="border-t mt-3 pt-3">
            {coupon ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-green-700">
                  <Tag size={13} />
                  <span className="font-semibold">{coupon.code}</span>
                  <span className="text-green-600">— {coupon.description}</span>
                </div>
                <button onClick={removeCoupon} className="text-green-600 hover:text-green-800">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCouponPicker((s) => !s)}
                className="w-full flex items-center justify-between border rounded-lg px-3 py-2.5 text-sm"
                style={{ borderColor: "#c9982f", color: "#8a6417" }}
              >
                <span className="flex items-center gap-1.5"><Tag size={14} /> เลือกคูปองส่วนลด</span>
                {!couponsLoading && (
                  <span className="text-xs text-gray-400">{usableCoupons.length} ใบใช้ได้</span>
                )}
              </button>
            )}

            {showCouponPicker && !coupon && (
              <div className="mt-2 border rounded-lg divide-y max-h-52 overflow-y-auto">
                {couponsLoading ? (
                  <div className="p-3 text-center text-xs text-gray-400">กำลังโหลด...</div>
                ) : usableCoupons.length === 0 ? (
                  <div className="p-3 text-center text-xs text-gray-400">
                    ยังไม่มีคูปองที่ใช้ได้กับยอดนี้ — ไปเก็บคูปองเพิ่มที่หน้า "คูปอง"
                  </div>
                ) : (
                  usableCoupons.map((uc) => (
                    <button
                      key={uc.user_coupon_id}
                      onClick={() => applyCoupon(uc.code)}
                      disabled={couponChecking}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-amber-50 disabled:opacity-60"
                    >
                      <div>
                        <div className="font-mono text-xs font-semibold text-gray-800">{uc.code}</div>
                        <div className="text-[11px] text-gray-500">{uc.description}</div>
                      </div>
                      <ChevronRight size={14} className="text-gray-400" />
                    </button>
                  ))
                )}
              </div>
            )}
            {couponError && <p className="text-xs text-red-500 mt-1.5">{couponError}</p>}
          </div>

          <div className="border-t mt-3 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>ยอดรวมสินค้า</span><span>฿{THB(total)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>ส่วนลดคูปอง</span><span>-฿{THB(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-800 pt-1.5 border-t">
              <span>ยอดชำระทั้งหมด</span><span style={{ color: "#b9791f" }}>฿{THB(grandTotal)}</span>
            </div>
          </div>

          <button
            onClick={handlePay}
            disabled={paying}
            className="mt-4 w-full rounded-xl py-3 font-medium text-sm text-white flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}
          >
            {paying ? (<><Loader2 size={16} className="animate-spin" /> กำลังประมวลผล...</>) : `จ่ายเงิน ฿${THB(grandTotal)}`}
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

function SuccessView({ order, onDone }) {
  const [copied, setCopied] = useState(false);
  function copyOrderNo() {
    navigator.clipboard?.writeText(order.orderNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <main className="max-w-lg mx-auto px-4 py-14 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={34} className="text-green-500" />
      </div>
      <h1 className="text-xl font-semibold text-gray-800">ชำระเงินสำเร็จ! (ทดสอบ)</h1>
      <p className="text-sm text-gray-500 mt-1">ขอบคุณสำหรับคำสั่งซื้อ นี่คือการจำลองในโหมดทดสอบ ยังไม่มีการตัดเงินจริง</p>

      <div className="bg-white rounded-xl shadow-sm p-5 mt-6 text-left">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">หมายเลขคำสั่งซื้อ</span>
          <button onClick={copyOrderNo} className="text-xs flex items-center gap-1 text-amber-600 hover:text-amber-700">
            <Copy size={12} /> {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </button>
        </div>
        <div className="font-mono font-semibold text-gray-800 mt-1">{order.orderNo}</div>

        <div className="border-t my-3" />
        {order.items.map((item) => (
          <div key={item.key} className="flex justify-between text-sm text-gray-600 mb-1.5">
            <span className="line-clamp-1 pr-2">{item.name} × {item.qty}</span>
            <span className="shrink-0">฿{THB(item.price * item.qty)}</span>
          </div>
        ))}
        <div className="border-t mt-2 pt-3 space-y-1.5">
          {order.discount > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-500">
                <span>ยอดรวมสินค้า</span><span>฿{THB(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>ส่วนลดคูปอง {order.couponCode ? `(${order.couponCode})` : ""}</span>
                <span>-฿{THB(order.discount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-semibold text-gray-800 pt-1.5 border-t">
            <span>ยอดชำระทั้งหมด</span><span style={{ color: "#b9791f" }}>฿{THB(order.total)}</span>
          </div>
        </div>

        <div className="border-t my-3" />
        <div className="text-xs text-gray-500">จัดส่งไปที่</div>
        <div className="text-sm text-gray-700 mt-0.5">
          {order.address.name} · {order.address.phone}<br />
          {order.address.line1} {order.address.district} {order.address.province} {order.address.postalCode}
        </div>
      </div>

      <button
        onClick={onDone}
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium text-sm text-white"
        style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}
      >
        <Home size={16} /> กลับไปหน้าหลัก
      </button>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Seller dashboard — list own products, add a new one. Only reachable for
// role "seller" or "admin" (also enforced server-side in server/routes/seller.js).
// ---------------------------------------------------------------------------

function SellerDashboard({ authToken, categories }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState("products"); // products | orders

  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };
  }

  function loadProducts() {
    setLoading(true);
    fetch(`${API}/api/seller/products`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setProducts)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadProducts(); }, []);

  useEffect(() => {
    if (tab !== "orders") return;
    fetch(`${API}/api/seller/orders`, { headers: authHeaders() })
      .then((r) => r.json())
      .then(setOrders)
      .catch((err) => console.error(err));
  }, [tab]);

  async function toggleStatus(product) {
    const newStatus = product.status === "active" ? "draft" : "active";
    await fetch(`${API}/api/seller/products/${product.id}`, {
      method: "PUT", headers: authHeaders(), body: JSON.stringify({ status: newStatus }),
    });
    loadProducts();
  }

  async function deleteProduct(product) {
    if (!confirm(`ลบสินค้า "${product.name}"?`)) return;
    await fetch(`${API}/api/seller/products/${product.id}`, { method: "DELETE", headers: authHeaders() });
    loadProducts();
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Store size={20} style={{ color: "#c9982f" }} /> ร้านของฉัน
        </h1>
        {tab === "products" && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 text-white"
            style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}
          >
            <PlusCircle size={16} /> {showForm ? "ปิดฟอร์ม" : "ลงสินค้าใหม่"}
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("products")}
          className="px-3 py-1.5 rounded-full text-xs border"
          style={tab === "products" ? { borderColor: "#c9982f", background: "#fff8ec", color: "#8a6417" } : { borderColor: "#e5e7eb", color: "#374151" }}>
          สินค้าของฉัน
        </button>
        <button onClick={() => setTab("orders")}
          className="px-3 py-1.5 rounded-full text-xs border"
          style={tab === "orders" ? { borderColor: "#c9982f", background: "#fff8ec", color: "#8a6417" } : { borderColor: "#e5e7eb", color: "#374151" }}>
          คำสั่งซื้อที่ได้รับ
        </button>
      </div>

      {tab === "products" && showForm && (
        <NewProductForm
          categories={categories}
          authHeaders={authHeaders}
          onCreated={() => { setShowForm(false); loadProducts(); }}
        />
      )}

      {tab === "products" && (
        loading ? (
          <div className="flex justify-center py-16 text-gray-400"><Loader2 className="animate-spin" size={24} /></div>
        ) : products.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">
            ยังไม่มีสินค้า — กด "ลงสินค้าใหม่" เพื่อเริ่มขาย
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm divide-y">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <img src={p.image} className="w-14 h-14 rounded-lg object-cover bg-gray-50" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 line-clamp-1">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.category_name || "ไม่มีหมวดหมู่"} · สต็อก {p.stock} · ขายแล้ว {p.sold_count}
                  </div>
                </div>
                <div className="text-sm font-semibold" style={{ color: "#b9791f" }}>฿{THB(p.price)}</div>
                <span
                  className="text-[11px] px-2 py-1 rounded-full font-medium"
                  style={p.status === "active" ? { background: "#ecfdf5", color: "#059669" } : { background: "#f3f4f6", color: "#6b7280" }}
                >
                  {p.status === "active" ? "กำลังขาย" : "ปิดการขาย"}
                </span>
                <button onClick={() => toggleStatus(p)} className="text-gray-400 hover:text-amber-600" title="เปิด/ปิดการขาย">
                  <Edit3 size={16} />
                </button>
                <button onClick={() => deleteProduct(p)} className="text-gray-400 hover:text-red-500" title="ลบสินค้า">
                  <Trash size={16} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "orders" && (
        orders.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-400 text-sm">
            ยังไม่มีคำสั่งซื้อเข้ามา
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm divide-y">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="text-gray-800">{o.product_name} × {o.quantity}</div>
                  <div className="text-xs text-gray-400 mt-0.5 font-mono">{o.order_no}</div>
                </div>
                <div className="font-semibold" style={{ color: "#b9791f" }}>฿{THB(o.line_total)}</div>
              </div>
            ))}
          </div>
        )
      )}
    </main>
  );
}

function NewProductForm({ categories, authHeaders, onCreated }) {
  const [form, setForm] = useState({ name: "", description: "", price: "", stock: "", categoryId: "" });
  const [imageFiles, setImageFiles] = useState([]); // [{file, preview}]
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = React.useRef(null);
  const MAX_IMAGES = 5;

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  function handleFilePick(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (imageFiles.length + files.length > MAX_IMAGES) {
      setError(`อัปโหลดได้สูงสุด ${MAX_IMAGES} รูป`);
      return;
    }
    for (const file of files) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        setError("รองรับเฉพาะไฟล์รูปภาพ (jpg, png, webp, gif)");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("แต่ละไฟล์รูปต้องไม่เกิน 5MB");
        return;
      }
    }
    setError("");
    setImageFiles((prev) => [...prev, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(idx) {
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.price || !form.stock) {
      return setError("กรุณากรอกชื่อสินค้า ราคา และจำนวนสต็อก");
    }
    setSubmitting(true);
    try {
      let imageUrls = [];
      if (imageFiles.length > 0) {
        setUploading(true);
        const fd = new FormData();
        imageFiles.forEach(({ file }) => fd.append("images", file));
        const authHeader = authHeaders();
        const uploadRes = await fetch(`${API}/api/seller/upload-images`, {
          method: "POST",
          headers: { Authorization: authHeader.Authorization }, // no Content-Type — browser sets multipart boundary
          body: fd,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "อัปโหลดรูปไม่สำเร็จ");
        imageUrls = uploadData.urls;
        setUploading(false);
      }

      const res = await fetch(`${API}/api/seller/products`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          price: Number(form.price),
          stock: Number(form.stock),
          categoryId: form.categoryId || null,
          images: imageUrls,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "เพิ่มสินค้าไม่สำเร็จ");
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 mb-4 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input required placeholder="ชื่อสินค้า" value={form.name} onChange={set("name")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2" />
        <textarea placeholder="รายละเอียดสินค้า" value={form.description} onChange={set("description")} rows={3}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2" />
        <input required type="number" min="0" placeholder="ราคา (บาท)" value={form.price} onChange={set("price")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
        <input required type="number" min="0" placeholder="จำนวนสต็อก" value={form.stock} onChange={set("stock")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
        <select value={form.categoryId} onChange={set("categoryId")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2">
          <option value="">เลือกหมวดหมู่ (ไม่บังคับ)</option>
          {categories.map((c) => <option key={c.slug} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* image upload — multiple */}
      <div>
        <label className="text-xs text-gray-500 mb-1.5 block">รูปภาพสินค้า (สูงสุด {MAX_IMAGES} รูป — รูปแรกเป็นรูปปก)</label>
        <div className="flex flex-wrap gap-2">
          {imageFiles.map((img, idx) => (
            <div key={idx} className="relative w-24 h-24">
              <img src={img.preview} className="w-24 h-24 rounded-lg object-cover border" />
              {idx === 0 && (
                <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">ปก</span>
              )}
              <button type="button" onClick={() => removeImage(idx)}
                className="absolute -top-2 -right-2 bg-white border rounded-full p-1 shadow-sm text-gray-500 hover:text-red-500">
                <X size={12} />
              </button>
            </div>
          ))}
          {imageFiles.length < MAX_IMAGES && (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-amber-400 hover:text-amber-500"
              style={{ borderColor: "#e5e7eb" }}>
              <ImagePlus size={20} />
              <span className="text-[10px]">เพิ่มรูป</span>
            </button>
          )}
        </div>
        <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFilePick} className="hidden" />
        <p className="text-[11px] text-gray-400 mt-1.5">JPG, PNG, WEBP หรือ GIF แต่ละไฟล์ไม่เกิน 5MB</p>
      </div>

      {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      <button type="submit" disabled={submitting}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
        style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
        {uploading ? "กำลังอัปโหลดรูป..." : submitting ? "กำลังบันทึก..." : "บันทึกสินค้า"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Order history — the logged-in buyer's past orders.
// ---------------------------------------------------------------------------

function OrderHistoryView({ authToken, onBrowse }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/orders/mine`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then(setOrders)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Package size={20} style={{ color: "#c9982f" }} /> ประวัติคำสั่งซื้อ
      </h1>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="animate-spin" size={24} /></div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-400">
          <Package size={36} className="mx-auto mb-3 text-gray-300" />
          ยังไม่มีประวัติการสั่งซื้อ
          <div className="mt-4">
            <button onClick={onBrowse} className="text-sm font-medium" style={{ color: "#b9791f" }}>เลือกซื้อสินค้า →</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-gray-700">{o.order_no}</span>
                <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={{ background: "#ecfdf5", color: "#059669" }}>
                  {o.status === "paid" ? "ชำระเงินแล้ว" : o.status}
                </span>
              </div>
              {o.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-sm text-gray-600 mb-1">
                  <span className="line-clamp-1 pr-2">{it.product_name} × {it.quantity}</span>
                  <span className="shrink-0">฿{THB(it.line_total)}</span>
                </div>
              ))}
              <div className="border-t mt-2 pt-2 flex justify-between text-sm font-semibold text-gray-800">
                <span>ยอดรวม</span><span style={{ color: "#b9791f" }}>฿{THB(o.grand_total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Coupons — browse all active coupons, collect them into your account
// (Shopee-style "เก็บคูปอง"). Collected coupons then show up as pickable
// options in CheckoutView instead of typing a code manually.
// ---------------------------------------------------------------------------

function CouponsView({ authToken, isLoggedIn, onGoLogin }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collectingId, setCollectingId] = useState(null);

  function load() {
    setLoading(true);
    fetch(`${API}/api/coupons`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    })
      .then((r) => r.json())
      .then(setCoupons)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [authToken]);

  async function collect(coupon) {
    if (!isLoggedIn) return onGoLogin();
    setCollectingId(coupon.id);
    try {
      await fetch(`${API}/api/coupons/${coupon.id}/collect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      load();
    } finally {
      setCollectingId(null);
    }
  }

  function describeValue(c) {
    return c.discount_type === "percent"
      ? `ลด ${Number(c.discount_value)}%${c.max_discount ? ` สูงสุด ฿${THB(c.max_discount)}` : ""}`
      : `ลด ฿${THB(c.discount_value)}`;
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <Tag size={20} style={{ color: "#c9982f" }} /> คูปองส่วนลด
      </h1>
      <p className="text-sm text-gray-500 mb-4">เก็บคูปองไว้ในบัญชีของคุณ แล้วเลือกใช้ตอนชำระเงิน</p>

      {loading ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 className="animate-spin" size={24} /></div>
      ) : coupons.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-gray-400">ยังไม่มีคูปองในตอนนี้</div>
      ) : (
        <div className="space-y-3">
          {coupons.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-4 overflow-hidden relative">
              <div
                className="shrink-0 w-20 h-20 rounded-lg flex flex-col items-center justify-center text-white text-center px-1"
                style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}
              >
                <Tag size={16} />
                <span className="text-[11px] font-semibold mt-1 leading-tight">{describeValue(c)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-semibold text-gray-800">{c.code}</div>
                <div className="text-xs text-gray-500 mt-0.5">{c.description}</div>
                {Number(c.min_order_amount) > 0 && (
                  <div className="text-[11px] text-gray-400 mt-1">ซื้อขั้นต่ำ ฿{THB(c.min_order_amount)}</div>
                )}
              </div>
              {c.collected ? (
                <span className="text-xs font-medium px-3 py-1.5 rounded-full shrink-0" style={{ background: "#ecfdf5", color: "#059669" }}>
                  เก็บแล้ว ✓
                </span>
              ) : (
                <button
                  onClick={() => collect(c)}
                  disabled={collectingId === c.id}
                  className="text-xs font-medium px-3 py-1.5 rounded-full shrink-0 border disabled:opacity-60"
                  style={{ borderColor: "#c9982f", color: "#8a6417" }}
                >
                  {collectingId === c.id ? "กำลังเก็บ..." : "เก็บคูปอง"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Profile — account info, saved addresses, saved cards.
// ---------------------------------------------------------------------------

function ProfileView({ authToken, authUser, onUserUpdated }) {
  const [tab, setTab] = useState("info"); // info | addresses | cards

  function authHeaders() {
    return { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` };
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <User size={20} style={{ color: "#c9982f" }} /> โปรไฟล์ของฉัน
      </h1>

      <div className="flex gap-2 mb-4">
        {[
          { id: "info", label: "ข้อมูลส่วนตัว" },
          { id: "addresses", label: "ที่อยู่จัดส่ง" },
          { id: "cards", label: "บัตรของฉัน" },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-3 py-1.5 rounded-full text-xs border"
            style={tab === t.id ? { borderColor: "#c9982f", background: "#fff8ec", color: "#8a6417" } : { borderColor: "#e5e7eb", color: "#374151" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && <ProfileInfoTab authUser={authUser} authHeaders={authHeaders} onUserUpdated={onUserUpdated} />}
      {tab === "addresses" && <ProfileAddressesTab authHeaders={authHeaders} />}
      {tab === "cards" && <ProfileCardsTab authHeaders={authHeaders} />}
    </main>
  );
}

function ProfileInfoTab({ authUser, authHeaders, onUserUpdated }) {
  const [form, setForm] = useState({ displayName: authUser.display_name || "", phone: authUser.phone || "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${API}/api/profile`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(form) });
      const data = await res.json();
      if (res.ok) { onUserUpdated(data); setSaved(true); setTimeout(() => setSaved(false), 1800); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 space-y-3 max-w-md">
      <div>
        <label className="text-xs text-gray-500 mb-1 block">อีเมล</label>
        <div className="border rounded-lg px-3 py-2 text-sm text-gray-400 bg-gray-50">{authUser.email}</div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">ชื่อที่ใช้แสดง</label>
        <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-amber-400" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">เบอร์โทรศัพท์</label>
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm w-full outline-none focus:border-amber-400" />
      </div>
      <button type="submit" disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
        style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
        {saving ? "กำลังบันทึก..." : saved ? "บันทึกแล้ว ✓" : "บันทึกการเปลี่ยนแปลง"}
      </button>
    </form>
  );
}

function ProfileAddressesTab({ authHeaders }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    fetch(`${API}/api/profile/addresses`, { headers: authHeaders() })
      .then((r) => r.json()).then(setAddresses).catch((e) => console.error(e)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function remove(id) {
    if (!confirm("ลบที่อยู่นี้?")) return;
    await fetch(`${API}/api/profile/addresses/${id}`, { method: "DELETE", headers: authHeaders() });
    load();
  }
  async function setDefault(addr) {
    await fetch(`${API}/api/profile/addresses/${addr.id}`, {
      method: "PUT", headers: authHeaders(), body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 text-white"
          style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
          <PlusCircle size={16} /> {showForm ? "ปิดฟอร์ม" : "เพิ่มที่อยู่ใหม่"}
        </button>
      </div>

      {showForm && <AddressForm authHeaders={authHeaders} onSaved={() => { setShowForm(false); load(); }} />}

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
      ) : addresses.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400 text-sm">ยังไม่มีที่อยู่จัดส่ง</div>
      ) : (
        <div className="space-y-2">
          {addresses.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm p-4 flex items-start gap-3">
              <MapPin size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-800">{a.recipient_name}</span>
                  <span className="text-xs text-gray-400">{a.phone}</span>
                  {a.is_default && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "#fff8ec", color: "#8a6417" }}>
                      ค่าเริ่มต้น
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {a.line1} {a.subdistrict} {a.district} {a.province} {a.postal_code}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {!a.is_default && (
                  <button onClick={() => setDefault(a)} className="text-xs" style={{ color: "#b9791f" }}>ตั้งเป็นค่าเริ่มต้น</button>
                )}
                <button onClick={() => remove(a.id)} className="text-gray-400 hover:text-red-500"><Trash size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddressForm({ authHeaders, onSaved }) {
  const [form, setForm] = useState({
    label: "", recipientName: "", phone: "", line1: "", subdistrict: "", district: "", province: "", postalCode: "", isDefault: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.recipientName || !form.phone || !form.line1 || !form.province) {
      return setError("กรุณากรอกชื่อผู้รับ เบอร์โทร ที่อยู่ และจังหวัด");
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/profile/addresses`, { method: "POST", headers: authHeaders(), body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกที่อยู่ไม่สำเร็จ");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 mb-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input placeholder="ป้ายกำกับ เช่น บ้าน, ที่ทำงาน (ไม่บังคับ)" value={form.label} onChange={set("label")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2" />
        <input required placeholder="ชื่อผู้รับ" value={form.recipientName} onChange={set("recipientName")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
        <input required placeholder="เบอร์โทรศัพท์" value={form.phone} onChange={set("phone")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
        <input required placeholder="ที่อยู่ (บ้านเลขที่, ถนน)" value={form.line1} onChange={set("line1")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2" />
        <input placeholder="ตำบล/แขวง" value={form.subdistrict} onChange={set("subdistrict")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
        <input placeholder="เขต/อำเภอ" value={form.district} onChange={set("district")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
        <input required placeholder="จังหวัด" value={form.province} onChange={set("province")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
        <input placeholder="รหัสไปรษณีย์" value={form.postalCode} onChange={set("postalCode")}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
        ตั้งเป็นที่อยู่เริ่มต้น
      </label>
      {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      <button type="submit" disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
        style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
        {saving ? "กำลังบันทึก..." : "บันทึกที่อยู่"}
      </button>
    </form>
  );
}

function ProfileCardsTab({ authHeaders }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    fetch(`${API}/api/profile/cards`, { headers: authHeaders() })
      .then((r) => r.json()).then(setCards).catch((e) => console.error(e)).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function remove(id) {
    if (!confirm("ลบบัตรนี้?")) return;
    await fetch(`${API}/api/profile/cards/${id}`, { method: "DELETE", headers: authHeaders() });
    load();
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 text-sm font-medium rounded-lg px-3 py-2 text-white"
          style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
          <PlusCircle size={16} /> {showForm ? "ปิดฟอร์ม" : "เพิ่มบัตรใหม่"}
        </button>
      </div>

      {showForm && <CardForm authHeaders={authHeaders} onSaved={() => { setShowForm(false); load(); }} />}

      <p className="text-xs text-gray-400 mb-3">
        โหมดทดสอบ — ระบบเก็บแค่ยี่ห้อบัตรและเลข 4 ตัวท้ายไว้แสดงผลเท่านั้น ไม่เก็บเลขบัตรเต็มหรือ CVV
      </p>

      {loading ? (
        <div className="flex justify-center py-12 text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-400 text-sm">ยังไม่มีบัตรที่บันทึกไว้</div>
      ) : (
        <div className="space-y-2">
          {cards.map((c) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
              <CreditCard size={20} className="text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{c.brand} •••• {c.last4}</div>
                <div className="text-xs text-gray-400 mt-0.5">{c.cardholder_name} · หมดอายุ {c.expiry}</div>
              </div>
              {c.is_default && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: "#fff8ec", color: "#8a6417" }}>
                  ค่าเริ่มต้น
                </span>
              )}
              <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-500 shrink-0"><Trash size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardForm({ authHeaders, onSaved }) {
  const [form, setForm] = useState({ cardNumber: "", cardholderName: "", expiry: "", isDefault: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function formatCardNumber(v) {
    return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.cardNumber.replace(/\s/g, "").length < 12 || !form.cardholderName || !form.expiry) {
      return setError("กรุณากรอกข้อมูลบัตรให้ครบ");
    }
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/profile/cards`, { method: "POST", headers: authHeaders(), body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกบัตรไม่สำเร็จ");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-5 mb-3 space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <input placeholder="หมายเลขบัตร (ทดสอบ: 4242 4242 4242 4242)" value={form.cardNumber}
          onChange={(e) => setForm({ ...form, cardNumber: formatCardNumber(e.target.value) })}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2" />
        <input placeholder="ชื่อบนบัตร" value={form.cardholderName}
          onChange={(e) => setForm({ ...form, cardholderName: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400 sm:col-span-2" />
        <input placeholder="MM/YY" value={form.expiry}
          onChange={(e) => setForm({ ...form, expiry: e.target.value })}
          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
        ตั้งเป็นบัตรเริ่มต้น
      </label>
      {error && <div className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
      <button type="submit" disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-70"
        style={{ background: "linear-gradient(135deg,#e0b45a,#b9791f)" }}>
        {saving ? "กำลังบันทึก..." : "บันทึกบัตร"}
      </button>
    </form>
  );
}
