# CloudCrackers — Changelog

## This pass: Orders module completion + a critical, previously-undiscovered bug fix

### Critical bug fixed: every order was created with ₹0 total and zero line items

**Root cause:** `Product`, `User`, and `Category` models had already been migrated to plain `String(36)` ID columns (a prior fix), but `Cart`, `Order`, `OrderItem`, `Payment`, and `Wishlist` still used `sqlalchemy.dialects.postgresql.UUID(as_uuid=True)`, kept alive under MySQL via a bind/result-processor monkeypatch in `database.py`. That patch made cross-model queries silently fail: `Cart.product_id` came back as a Python `uuid.UUID` object, and comparing it against `Product.id` (a plain string column) never matched. `order_service.py`'s `create_order` looked up each cart item's product, silently hit `if not product: continue` for every single item, and created an order with `total_amount = 0.00` and no order_items — with no error, no exception, nothing in the logs. This was live-verified: confirmed a real cart row existed, confirmed the product existed with a matching ID, and confirmed the ORM comparison still returned no match, before fixing it.

**Fix:** standardized `Cart`, `Order`, `OrderItem`, `Payment`, `Wishlist` to the same `String(36)` pattern already used by `Product`/`User`/`Category`. Removed the now-unnecessary UUID dialect monkeypatch from `database.py` entirely (about 60 lines) — it's no longer needed since nothing uses the Postgres UUID type anymore, and this removes a fragile hack in favor of consistent plain strings everywhere.

**Verified live**, not just read: registered a user, created a category and a ₹499 product, added 2 to cart, created an order — `total_amount` is now correctly `998.0`, `GET /api/orders/{id}/items` returns the correct line item, and the cart is correctly emptied afterward.

### Orders module: missing endpoint added

- `GET /api/orders/{order_id}/items` didn't exist at all — the frontend's order-detail modal called it and always failed. Added `OrderItemResponse` schema, the route, and `OrderService.get_order_items()`. Verified live end-to-end.

### Dependency bug: Razorpay payment creation

- `requirements.txt` had no version ceiling on `setuptools`. `razorpay==1.4.2` imports `pkg_resources` internally, which `setuptools` 81+ removed entirely — a fresh install (this exact environment, freshly set up) failed with `ModuleNotFoundError: No module named 'pkg_resources'` even though `razorpay` itself was installed correctly. Added `setuptools<81` to `requirements.txt`. Verified: payment creation now gets past dependency loading and correctly attempts the real Razorpay API call (fails only because this sandbox has no real Razorpay credentials/network access — not a code issue).

## Files modified
- `backend/app/models/cart.py`, `order.py`, `order_item.py`, `payment.py`, `wishlist.py` — `UUID(as_uuid=True)` → `String(36)`, matching `Product`/`User`/`Category`
- `backend/app/database/database.py` — removed the UUID dialect monkeypatch (no longer needed)
- `backend/app/schemas/order.py` — added `OrderItemResponse`
- `backend/app/api/orders.py` — added `GET /{order_id}/items`
- `backend/app/services/order_service.py` — added `get_order_items()`
- `backend/requirements.txt` — pinned `setuptools<81`

## Database changes required
**None.** Every affected column was already physically `VARCHAR(36)` in MySQL (the Postgres UUID type was only ever rendered as `VARCHAR(36)` via the DDL compile shim). This was a Python/SQLAlchemy-side type mapping fix only — no `ALTER TABLE` needed. `database_changes.sql` is intentionally not included since nothing in the schema itself changes.

## Manual steps after extracting
1. `pip install -r requirements.txt` (picks up the `setuptools<81` pin).
2. No database migration needed.

## Explicitly NOT done in this pass — do not assume these work
- **Profile page** — backend (`GET`/`PUT /api/users/me`) works and is verified; `profile.html` still has zero matching IDs and no script includes. Not touched this pass.
- **Admin pages** (dashboard, products, orders, users) — `admin.js` is still 100% dummy-data scaffolding using an outdated API pattern; none of the 4 admin HTML pages have IDs or script includes. Not touched this pass. Also needs new backend endpoints (dashboard stats, user list) that don't exist yet.
- **Image upload** — no upload endpoint or static file serving exists. Not touched this pass.
- Duplicate JS utility functions across modules — not touched this pass.

These are exactly the items flagged in the last full audit as genuinely unbuilt (not bugs — features never started). I'd rather hand you a verified Orders fix now than a larger zip with unverified claims about these.
