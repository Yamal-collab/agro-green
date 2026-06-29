from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os, uuid, logging, bcrypt, jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
TTL_MIN = 60 * 24

app = FastAPI(title="AgriBiz ERP")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

def now_iso(): return datetime.now(timezone.utc).isoformat()
def new_id(): return str(uuid.uuid4())
def hp(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def vp(p, h):
    try: return bcrypt.checkpw(p.encode(), h.encode())
    except: return False

def mk_token(uid, email):
    return jwt.encode({"sub": uid, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=TTL_MIN)}, JWT_SECRET, algorithm=JWT_ALGO)

async def get_user(request: Request, creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    token = creds.credentials if creds else request.cookies.get("access_token")
    if not token: raise HTTPException(401, "Not authenticated")
    try: payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except: raise HTTPException(401, "Invalid token")
    u = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not u: raise HTTPException(401, "User not found")
    return u

async def next_seq(key: str) -> int:
    doc = await db.counters.find_one_and_update({"_id": key}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    return doc["seq"]

async def gen_invoice(prefix: str) -> str:
    n = await next_seq(prefix)
    return f"{prefix}-{datetime.now().year}-{n:05d}"

async def fin_write(bu: int, type_: str, category: str, amount: float, date: str, ref_id: str = "", notes: str = "", source: str = ""):
    await db.finance_transactions.insert_one({
        "id": new_id(), "business_unit": bu, "type": type_, "category": category,
        "amount": round(amount, 2), "date": date, "source": source, "ref_id": ref_id,
        "notes": notes, "created_at": now_iso(),
    })

# ============ Models ============
class LoginIn(BaseModel):
    email: EmailStr; password: str

class CustomerIn(BaseModel):
    name: str; phone: str = ""; farm_name: str = ""; address: str = ""; gst: str = ""; business_units: List[int] = []

class SupplierIn(BaseModel):
    name: str; phone: str = ""; address: str = ""; gst: str = ""; business_unit: int = 1

class FeedItemIn(BaseModel):
    name: str; brand: str = ""; category: str = ""; unit: str = "kg"

class FeedPurchaseIn(BaseModel):
    supplier_id: str; feed_item_id: str; date: str; quantity: float; purchase_rate: float
    transport: float = 0.0; other: float = 0.0; payment_status: str = "pending"

class FeedSaleIn(BaseModel):
    customer_id: str; feed_item_id: str; date: str; quantity: float; unit_price: float
    transport: float = 0.0; discount: float = 0.0; payment_status: str = "pending"

class FeedTransferIn(BaseModel):
    feed_item_id: str; date: str; quantity: float; notes: str = ""

class EggPurchaseIn(BaseModel):
    supplier_id: str; date: str; quantity: int; rate: float; transport: float = 0.0
    incubation_start: str

class BatchUpdateIn(BaseModel):
    hatch_date: Optional[str] = None; hatched_chicks: Optional[int] = None
    dead_eggs: Optional[int] = None; status: Optional[str] = None; notes: Optional[str] = None

class BatchExpenseIn(BaseModel):
    batch_id: str; category: str; amount: float; date: str; notes: str = ""

class ChickSaleIn(BaseModel):
    batch_id: str; customer_id: str; date: str; quantity: int; unit_price: float
    transport: float = 0.0; discount: float = 0.0; payment_status: str = "pending"

class ChickTransferIn(BaseModel):
    batch_id: str; date: str; quantity: int; notes: str = ""

class FarmSaleIn(BaseModel):
    customer_id: str; date: str; quantity: int; unit_price: float
    transport: float = 0.0; discount: float = 0.0; payment_status: str = "pending"

class FarmExpenseIn(BaseModel):
    category: str; amount: float; date: str; notes: str = ""

class TankIn(BaseModel):
    name: str; capacity: float; current_liters: float = 0.0

class TankAddIn(BaseModel):
    tank_id: str; date: str; liters: float; source: str = ""; loading_charge: float = 0.0

class WaterSaleIn(BaseModel):
    customer_id: str; date: str; liters: float; rate: float; received: float = 0.0; notes: str = ""

class WaterExpenseIn(BaseModel):
    category: str; amount: float; date: str; notes: str = ""

class PaymentIn(BaseModel):
    party_id: str; party_type: str  # "customer" | "supplier"
    amount: float; date: str; method: str = "cash"; notes: str = ""; business_unit: int = 1

# ============ Auth ============
@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    u = await db.users.find_one({"email": payload.email.lower()})
    if not u or not vp(payload.password, u["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    tok = mk_token(u["id"], u["email"])
    response.set_cookie("access_token", tok, httponly=True, secure=True, samesite="lax", max_age=TTL_MIN*60, path="/")
    return {"access_token": tok, "user": {"id": u["id"], "email": u["email"], "name": u["name"], "role": "admin"}}

@api.post("/auth/logout")
async def logout(response: Response, user=Depends(get_user)):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user=Depends(get_user)): return user

# ============ Generic helpers ============
async def list_col(coll, q=None, limit=2000):
    return await coll.find(q or {}, {"_id": 0}).sort("created_at", -1).to_list(limit)

# ============ Customers (shared across BUs) ============
@api.get("/customers")
async def list_customers(user=Depends(get_user)): return await list_col(db.customers)

@api.post("/customers")
async def create_customer(p: CustomerIn, user=Depends(get_user)):
    d = {"id": new_id(), **p.model_dump(), "outstanding": 0.0, "status": "active", "created_at": now_iso()}
    await db.customers.insert_one(d); d.pop('_id', None); d.pop("_id", None); return d

# ============ Suppliers ============
@api.get("/suppliers")
async def list_suppliers(user=Depends(get_user)): return await list_col(db.suppliers)

@api.post("/suppliers")
async def create_supplier(p: SupplierIn, user=Depends(get_user)):
    d = {"id": new_id(), **p.model_dump(), "outstanding": 0.0, "created_at": now_iso()}
    await db.suppliers.insert_one(d); d.pop('_id', None); d.pop("_id", None); return d

# ============ BU1: Feed Items + Purchases + Sales + Transfer ============
@api.get("/feed/items")
async def feed_items(user=Depends(get_user)): return await list_col(db.feed_items)

@api.post("/feed/items")
async def feed_item_create(p: FeedItemIn, user=Depends(get_user)):
    d = {"id": new_id(), **p.model_dump(), "current_stock": 0.0, "weighted_avg_cost": 0.0, "created_at": now_iso()}
    await db.feed_items.insert_one(d); d.pop('_id', None); d.pop("_id", None); return d

@api.get("/feed/purchases")
async def feed_purchases(user=Depends(get_user)): return await list_col(db.feed_purchases)

@api.post("/feed/purchases")
async def feed_purchase(p: FeedPurchaseIn, user=Depends(get_user)):
    item = await db.feed_items.find_one({"id": p.feed_item_id})
    if not item: raise HTTPException(404, "Feed item not found")
    total = p.quantity * p.purchase_rate + p.transport + p.other
    eff_rate = total / p.quantity if p.quantity else 0
    cur_stock = item["current_stock"]; cur_avg = item["weighted_avg_cost"]
    new_stock = cur_stock + p.quantity
    new_avg = ((cur_stock * cur_avg) + (p.quantity * eff_rate)) / new_stock if new_stock else 0
    await db.feed_items.update_one({"id": p.feed_item_id}, {"$set": {"current_stock": new_stock, "weighted_avg_cost": round(new_avg, 4)}})
    d = {"id": new_id(), **p.model_dump(), "total_cost": round(total, 2), "created_at": now_iso()}
    await db.feed_purchases.insert_one(d); d.pop('_id', None)
    if p.payment_status != "paid":
        await db.suppliers.update_one({"id": p.supplier_id}, {"$inc": {"outstanding": total}})
    await fin_write(1, "expense", "Feed Purchase", total, p.date, d["id"], item["name"], "feed_purchase")
    return d

@api.get("/feed/sales")
async def feed_sales(user=Depends(get_user)): return await list_col(db.feed_sales)

@api.post("/feed/sales")
async def feed_sale(p: FeedSaleIn, user=Depends(get_user)):
    item = await db.feed_items.find_one({"id": p.feed_item_id})
    if not item or item["current_stock"] < p.quantity:
        raise HTTPException(400, "Insufficient stock")
    cust = await db.customers.find_one({"id": p.customer_id})
    if not cust: raise HTTPException(404, "Customer not found")
    total = p.quantity * p.unit_price + p.transport - p.discount
    cost = p.quantity * item["weighted_avg_cost"]
    inv = await gen_invoice("FE")
    d = {"id": new_id(), "invoice_no": inv, **p.model_dump(),
         "customer_name": cust["name"], "feed_name": item["name"],
         "total": round(total, 2), "cost_basis": round(cost, 2), "created_at": now_iso()}
    await db.feed_sales.insert_one(d); d.pop('_id', None)
    await db.feed_items.update_one({"id": p.feed_item_id}, {"$inc": {"current_stock": -p.quantity}})
    if p.payment_status != "paid":
        await db.customers.update_one({"id": p.customer_id}, {"$inc": {"outstanding": total}})
    await fin_write(1, "income", "Feed Sale", total, p.date, d["id"], inv, "feed_sale")
    return d

@api.post("/feed/transfer")
async def feed_transfer(p: FeedTransferIn, user=Depends(get_user)):
    item = await db.feed_items.find_one({"id": p.feed_item_id})
    if not item or item["current_stock"] < p.quantity:
        raise HTTPException(400, "Insufficient stock")
    val = p.quantity * item["weighted_avg_cost"]
    await db.feed_items.update_one({"id": p.feed_item_id}, {"$inc": {"current_stock": -p.quantity}})
    d = {"id": new_id(), "type": "feed", "from_unit": 1, "to_unit": 3,
         "ref_item_id": p.feed_item_id, "item_name": item["name"],
         "quantity": p.quantity, "unit_cost": item["weighted_avg_cost"],
         "total_value": round(val, 2), "date": p.date, "notes": p.notes, "created_at": now_iso()}
    await db.internal_transfers.insert_one(d); d.pop('_id', None)
    await fin_write(1, "income", "Internal Transfer (Feed→Farm)", val, p.date, d["id"], "", "internal_transfer")
    await fin_write(3, "expense", "Feed Consumption", val, p.date, d["id"], item["name"], "internal_transfer")
    return d

# ============ BU2: Egg Purchases → Batches → Expenses → Chick Sales → Transfer ============
@api.get("/egg/purchases")
async def egg_purchases(user=Depends(get_user)): return await list_col(db.egg_purchases)

@api.post("/egg/purchases")
async def egg_purchase(p: EggPurchaseIn, user=Depends(get_user)):
    total = p.quantity * p.rate + p.transport
    batch_no = f"BATCH-{datetime.now().year}-{await next_seq('BATCH'):04d}"
    batch = {"id": new_id(), "batch_no": batch_no, "egg_qty": p.quantity,
             "incubation_start": p.incubation_start, "hatch_date": None,
             "hatched_chicks": 0, "dead_eggs": 0, "transferred": 0, "sold": 0,
             "status": "incubating", "notes": "", "created_at": now_iso()}
    await db.poultry_batches.insert_one(batch); batch.pop('_id', None)
    d = {"id": new_id(), "batch_id": batch["id"], **p.model_dump(),
         "total_cost": round(total, 2), "created_at": now_iso()}
    await db.egg_purchases.insert_one(d); d.pop('_id', None)
    if True:  # always log to supplier outstanding & finance
        await db.suppliers.update_one({"id": p.supplier_id}, {"$inc": {"outstanding": total}})
    await fin_write(2, "expense", "Egg Purchase", total, p.date, d["id"], batch_no, "egg_purchase")
    return {"purchase": d, "batch": batch}

@api.get("/hatchery/batches")
async def list_batches(user=Depends(get_user)): return await list_col(db.poultry_batches)

@api.patch("/hatchery/batches/{bid}")
async def update_batch(bid: str, p: BatchUpdateIn, user=Depends(get_user)):
    upd = {k: v for k, v in p.model_dump().items() if v is not None}
    if not upd: raise HTTPException(400, "No fields")
    await db.poultry_batches.update_one({"id": bid}, {"$set": upd})
    return await db.poultry_batches.find_one({"id": bid}, {"_id": 0})

@api.get("/hatchery/expenses")
async def batch_expenses(user=Depends(get_user)): return await list_col(db.batch_expenses)

@api.post("/hatchery/expenses")
async def add_batch_expense(p: BatchExpenseIn, user=Depends(get_user)):
    d = {"id": new_id(), **p.model_dump(), "created_at": now_iso()}
    await db.batch_expenses.insert_one(d); d.pop('_id', None)
    await fin_write(2, "expense", p.category, p.amount, p.date, d["id"], "", "batch_expense")
    return d

@api.get("/hatchery/sales")
async def chick_sales(user=Depends(get_user)): return await list_col(db.chick_sales)

@api.post("/hatchery/sales")
async def chick_sale(p: ChickSaleIn, user=Depends(get_user)):
    batch = await db.poultry_batches.find_one({"id": p.batch_id})
    cust = await db.customers.find_one({"id": p.customer_id})
    if not batch or not cust: raise HTTPException(404, "Batch/customer not found")
    avail = batch["hatched_chicks"] - batch.get("sold", 0) - batch.get("transferred", 0)
    if avail < p.quantity: raise HTTPException(400, f"Only {avail} chicks available")
    total = p.quantity * p.unit_price + p.transport - p.discount
    inv = await gen_invoice("CH")
    d = {"id": new_id(), "invoice_no": inv, **p.model_dump(),
         "customer_name": cust["name"], "batch_no": batch["batch_no"],
         "total": round(total, 2), "created_at": now_iso()}
    await db.chick_sales.insert_one(d); d.pop('_id', None)
    await db.poultry_batches.update_one({"id": p.batch_id}, {"$inc": {"sold": p.quantity}})
    if p.payment_status != "paid":
        await db.customers.update_one({"id": p.customer_id}, {"$inc": {"outstanding": total}})
    await fin_write(2, "income", "Chick Sale", total, p.date, d["id"], inv, "chick_sale")
    return d

async def compute_batch_transfer_cost(batch_id: str) -> float:
    batch = await db.poultry_batches.find_one({"id": batch_id})
    egg = await db.egg_purchases.find_one({"batch_id": batch_id})
    exps = await db.batch_expenses.find({"batch_id": batch_id}).to_list(1000)
    inv = (egg["total_cost"] if egg else 0) + sum(e["amount"] for e in exps)
    n = max(batch.get("hatched_chicks", 0) or 1, 1)
    return round(inv / n, 4)

@api.post("/hatchery/transfer")
async def chick_transfer(p: ChickTransferIn, user=Depends(get_user)):
    batch = await db.poultry_batches.find_one({"id": p.batch_id})
    if not batch: raise HTTPException(404, "Batch not found")
    avail = batch["hatched_chicks"] - batch.get("sold", 0) - batch.get("transferred", 0)
    if avail < p.quantity: raise HTTPException(400, f"Only {avail} chicks available")
    unit_cost = await compute_batch_transfer_cost(p.batch_id)
    val = p.quantity * unit_cost
    await db.poultry_batches.update_one({"id": p.batch_id}, {"$inc": {"transferred": p.quantity}})
    d = {"id": new_id(), "type": "chicks", "from_unit": 2, "to_unit": 3,
         "ref_item_id": p.batch_id, "item_name": batch["batch_no"],
         "quantity": p.quantity, "unit_cost": unit_cost, "total_value": round(val, 2),
         "date": p.date, "notes": p.notes, "created_at": now_iso()}
    await db.internal_transfers.insert_one(d); d.pop('_id', None)
    await db.farm_stock.insert_one({"id": new_id(), "source_batch_id": p.batch_id,
         "batch_no": batch["batch_no"], "qty_received": p.quantity, "transfer_cost_per_bird": unit_cost,
         "current_count": p.quantity, "date": p.date, "created_at": now_iso()})
    await fin_write(2, "income", "Internal Transfer (Chicks→Farm)", val, p.date, d["id"], "", "internal_transfer")
    await fin_write(3, "expense", "Chick Purchase (internal)", val, p.date, d["id"], batch["batch_no"], "internal_transfer")
    return d

@api.get("/hatchery/batches/{bid}/pnl")
async def batch_pnl(bid: str, user=Depends(get_user)):
    batch = await db.poultry_batches.find_one({"id": bid}, {"_id": 0})
    if not batch: raise HTTPException(404, "Batch not found")
    egg = await db.egg_purchases.find_one({"batch_id": bid}, {"_id": 0})
    exps = await db.batch_expenses.find({"batch_id": bid}, {"_id": 0}).to_list(1000)
    sales = await db.chick_sales.find({"batch_id": bid}, {"_id": 0}).to_list(1000)
    transfers = await db.internal_transfers.find({"ref_item_id": bid, "type": "chicks"}, {"_id": 0}).to_list(1000)
    egg_cost = egg["total_cost"] if egg else 0
    exp_total = sum(e["amount"] for e in exps)
    investment = egg_cost + exp_total
    revenue = sum(s["total"] for s in sales)
    transfer_revenue = sum(t["total_value"] for t in transfers)
    return {"batch": batch, "egg_cost": egg_cost, "expenses_total": exp_total,
            "total_investment": investment, "sales_revenue": revenue,
            "transfer_revenue": transfer_revenue, "profit": round(revenue + transfer_revenue - investment, 2)}

# ============ BU3: Farm ============
@api.get("/farm/stock")
async def farm_stock(user=Depends(get_user)): return await list_col(db.farm_stock)

@api.get("/farm/sales")
async def farm_sales(user=Depends(get_user)): return await list_col(db.farm_sales)

@api.post("/farm/sales")
async def farm_sale(p: FarmSaleIn, user=Depends(get_user)):
    cust = await db.customers.find_one({"id": p.customer_id})
    if not cust: raise HTTPException(404, "Customer not found")
    total = p.quantity * p.unit_price + p.transport - p.discount
    inv = await gen_invoice("FA")
    d = {"id": new_id(), "invoice_no": inv, **p.model_dump(),
         "customer_name": cust["name"], "total": round(total, 2), "created_at": now_iso()}
    await db.farm_sales.insert_one(d); d.pop('_id', None)
    # Decrement farm stock FIFO
    rem = p.quantity
    stocks = await db.farm_stock.find({"current_count": {"$gt": 0}}).sort("created_at", 1).to_list(1000)
    for s in stocks:
        if rem <= 0: break
        take = min(rem, s["current_count"])
        await db.farm_stock.update_one({"id": s["id"]}, {"$inc": {"current_count": -take}})
        rem -= take
    if p.payment_status != "paid":
        await db.customers.update_one({"id": p.customer_id}, {"$inc": {"outstanding": total}})
    await fin_write(3, "income", "Farm Sale", total, p.date, d["id"], inv, "farm_sale")
    return d

@api.get("/farm/expenses")
async def farm_expenses(user=Depends(get_user)): return await list_col(db.farm_expenses)

@api.post("/farm/expenses")
async def add_farm_expense(p: FarmExpenseIn, user=Depends(get_user)):
    d = {"id": new_id(), **p.model_dump(), "created_at": now_iso()}
    await db.farm_expenses.insert_one(d); d.pop('_id', None)
    await fin_write(3, "expense", p.category, p.amount, p.date, d["id"], "", "farm_expense")
    return d

# ============ BU4: Water ============
@api.get("/water/tanks")
async def tanks(user=Depends(get_user)): return await list_col(db.water_tanks)

@api.post("/water/tanks")
async def create_tank(p: TankIn, user=Depends(get_user)):
    d = {"id": new_id(), **p.model_dump(), "created_at": now_iso()}
    await db.water_tanks.insert_one(d); d.pop('_id', None); d.pop("_id", None); return d

@api.get("/water/tank-additions")
async def tank_additions(user=Depends(get_user)): return await list_col(db.water_tank_additions)

@api.post("/water/tank-additions")
async def add_to_tank(p: TankAddIn, user=Depends(get_user)):
    tank = await db.water_tanks.find_one({"id": p.tank_id})
    if not tank: raise HTTPException(404, "Tank not found")
    await db.water_tanks.update_one({"id": p.tank_id}, {"$inc": {"current_liters": p.liters}})
    d = {"id": new_id(), **p.model_dump(), "created_at": now_iso()}
    await db.water_tank_additions.insert_one(d); d.pop('_id', None)
    if p.loading_charge > 0:
        await fin_write(4, "expense", "Loading Charge", p.loading_charge, p.date, d["id"], p.source, "tank_addition")
    return d

@api.get("/water/sales")
async def water_sales(user=Depends(get_user)): return await list_col(db.water_sales)

@api.post("/water/sales")
async def water_sale(p: WaterSaleIn, user=Depends(get_user)):
    cust = await db.customers.find_one({"id": p.customer_id})
    if not cust: raise HTTPException(404, "Customer not found")
    total = p.liters * p.rate
    pending = max(0, total - p.received)
    d = {"id": new_id(), **p.model_dump(),
         "customer_name": cust["name"], "total": round(total, 2),
         "pending": round(pending, 2), "created_at": now_iso()}
    await db.water_sales.insert_one(d); d.pop('_id', None)
    # Decrement first tank with stock
    tanks_ = await db.water_tanks.find({"current_liters": {"$gt": 0}}).sort("created_at", 1).to_list(50)
    rem = p.liters
    for t in tanks_:
        if rem <= 0: break
        take = min(rem, t["current_liters"])
        await db.water_tanks.update_one({"id": t["id"]}, {"$inc": {"current_liters": -take}})
        rem -= take
    if pending > 0:
        await db.customers.update_one({"id": p.customer_id}, {"$inc": {"outstanding": pending}})
    await fin_write(4, "income", "Water Sale", total, p.date, d["id"], cust["name"], "water_sale")
    return d

@api.get("/water/expenses")
async def water_expenses(user=Depends(get_user)): return await list_col(db.water_expenses)

@api.post("/water/expenses")
async def add_water_expense(p: WaterExpenseIn, user=Depends(get_user)):
    d = {"id": new_id(), **p.model_dump(), "created_at": now_iso()}
    await db.water_expenses.insert_one(d); d.pop('_id', None)
    await fin_write(4, "expense", p.category, p.amount, p.date, d["id"], "", "water_expense")
    return d

# ============ Payments ============
@api.get("/payments")
async def payments(user=Depends(get_user)): return await list_col(db.payments)

@api.post("/payments")
async def record_payment(p: PaymentIn, user=Depends(get_user)):
    coll = db.customers if p.party_type == "customer" else db.suppliers
    party = await coll.find_one({"id": p.party_id})
    if not party: raise HTTPException(404, "Party not found")
    d = {"id": new_id(), **p.model_dump(), "party_name": party["name"], "created_at": now_iso()}
    await db.payments.insert_one(d); d.pop('_id', None)
    await coll.update_one({"id": p.party_id}, {"$inc": {"outstanding": -p.amount}})
    if p.party_type == "customer":
        await fin_write(p.business_unit, "income", "Payment Received", p.amount, p.date, d["id"], party["name"], "payment")
    else:
        await fin_write(p.business_unit, "expense", "Supplier Payment (paid)", 0, p.date, d["id"], party["name"], "supplier_payment")
        # Note: supplier payment reduces outstanding only; original expense was already booked at purchase
    return d

# ============ Internal Transfers list ============
@api.get("/transfers")
async def transfers(user=Depends(get_user)): return await list_col(db.internal_transfers)

# ============ Finance / Reports ============
@api.get("/finance/transactions")
async def fin_tx(user=Depends(get_user), bu: Optional[int] = None, month: Optional[str] = None):
    q = {}
    if bu: q["business_unit"] = bu
    if month: q["date"] = {"$regex": f"^{month}"}
    return await list_col(db.finance_transactions, q, limit=5000)

@api.get("/finance/pnl")
async def pnl(user=Depends(get_user), bu: Optional[int] = None, month: Optional[str] = None):
    q = {}
    if bu: q["business_unit"] = bu
    if month: q["date"] = {"$regex": f"^{month}"}
    txs = await db.finance_transactions.find(q, {"_id": 0}).to_list(10000)
    income = sum(t["amount"] for t in txs if t["type"] == "income")
    expense = sum(t["amount"] for t in txs if t["type"] == "expense")
    by_cat: Dict[str, float] = {}
    for t in txs:
        if t["type"] == "expense":
            by_cat[t["category"]] = by_cat.get(t["category"], 0) + t["amount"]
    return {"income": round(income, 2), "expense": round(expense, 2),
            "profit": round(income - expense, 2), "expense_by_category": by_cat}

# ============ Reports (per-BU) ============
@api.get("/reports/outstanding")
async def reports_outstanding(user=Depends(get_user)):
    custs = await db.customers.find({"outstanding": {"$gt": 0}}, {"_id": 0}).to_list(5000)
    sups = await db.suppliers.find({"outstanding": {"$gt": 0}}, {"_id": 0}).to_list(5000)
    custs.sort(key=lambda c: c.get("outstanding", 0), reverse=True)
    sups.sort(key=lambda s: s.get("outstanding", 0), reverse=True)
    return {"customers": custs, "suppliers": sups}

@api.get("/reports/low-stock")
async def reports_low_stock(user=Depends(get_user)):
    items = await db.feed_items.find({"current_stock": {"$lt": 100}}, {"_id": 0}).to_list(2000)
    items.sort(key=lambda f: f.get("current_stock", 0))
    return items

# ============ Dashboard ============
@api.get("/dashboard/summary")
async def dashboard(user=Depends(get_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month = datetime.now(timezone.utc).strftime("%Y-%m")
    txs = await db.finance_transactions.find({}, {"_id": 0}).to_list(20000)

    def agg(bu_filter=None):
        rev = sum(t["amount"] for t in txs if t["type"] == "income" and (bu_filter is None or t["business_unit"] == bu_filter) and t["date"].startswith(month))
        exp = sum(t["amount"] for t in txs if t["type"] == "expense" and (bu_filter is None or t["business_unit"] == bu_filter) and t["date"].startswith(month))
        return {"revenue": round(rev, 2), "expense": round(exp, 2), "profit": round(rev - exp, 2)}

    today_total = sum(t["amount"] for t in txs if t["type"] == "income" and t["date"].startswith(today))

    feed_items_data = await db.feed_items.find({}, {"_id": 0}).to_list(500)
    feed_stock_value = sum(f["current_stock"] * f["weighted_avg_cost"] for f in feed_items_data)
    low_stock = [f for f in feed_items_data if f["current_stock"] < 100]

    customers = await db.customers.find({}, {"_id": 0}).to_list(2000)
    outstanding = sum(c.get("outstanding", 0) for c in customers)
    top_customers = sorted(customers, key=lambda c: c.get("outstanding", 0), reverse=True)[:5]

    active_batches = await db.poultry_batches.count_documents({"status": {"$ne": "closed"}})
    farm_birds = sum(s["current_count"] for s in await db.farm_stock.find({}, {"_id": 0}).to_list(500))
    water_stock = sum(t["current_liters"] for t in await db.water_tanks.find({}, {"_id": 0}).to_list(50))

    # 6-month trend per BU
    trend = []
    for i in range(5, -1, -1):
        dt = datetime.now(timezone.utc).replace(day=1) - timedelta(days=i*30)
        mkey = dt.strftime("%Y-%m")
        row = {"month": mkey[5:]}
        for bu in [1, 2, 3, 4]:
            row[f"bu{bu}"] = round(sum(t["amount"] for t in txs if t["type"] == "income" and t["business_unit"] == bu and t["date"].startswith(mkey)), 2)
        trend.append(row)

    recent_tx = sorted(txs, key=lambda t: t["created_at"], reverse=True)[:10]

    return {
        "today_total_sales": round(today_total, 2),
        "combined": agg(),
        "outstanding": round(outstanding, 2),
        "bu1": {**agg(1), "feed_items": len(feed_items_data), "stock_value": round(feed_stock_value, 2), "low_stock_count": len(low_stock)},
        "bu2": {**agg(2), "active_batches": active_batches},
        "bu3": {**agg(3), "current_birds": farm_birds},
        "bu4": {**agg(4), "water_stock": round(water_stock, 2)},
        "top_customers": top_customers,
        "low_feed_stock": low_stock,
        "recent_transactions": recent_tx,
        "revenue_trend": trend,
    }

# ============ Invoice PDF / Print / Share ============
import io
from urllib.parse import quote
from fastapi.responses import StreamingResponse, HTMLResponse
from reportlab.lib.pagesizes import A5
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

BUSINESS_INFO = {
    "name": "AgriBiz ERP",
    "tagline": "Integrated Agri-Business Management",
    "address": "Tamil Nadu, India",
    "phone": "+91 98765 43210",
    "email": "info@agribiz.com",
    "gst": "33ABCDE1234F1Z5",
}

async def _load_sale(stype: str, sale_id: str):
    """Load sale, customer, and item-meta for given sale type."""
    stype = stype.lower()
    if stype == "feed":
        sale = await db.feed_sales.find_one({"id": sale_id}, {"_id": 0})
        if not sale: raise HTTPException(404, "Feed sale not found")
        cust = await db.customers.find_one({"id": sale["customer_id"]}, {"_id": 0}) or {}
        item = await db.feed_items.find_one({"id": sale["feed_item_id"]}, {"_id": 0}) or {}
        return {
            "type": "Feed Sale", "type_key": "feed", "sale": sale, "customer": cust,
            "item_name": sale.get("feed_name") or item.get("name") or "Feed",
            "unit": item.get("unit", "kg"),
        }
    if stype == "chick":
        sale = await db.chick_sales.find_one({"id": sale_id}, {"_id": 0})
        if not sale: raise HTTPException(404, "Chick sale not found")
        cust = await db.customers.find_one({"id": sale["customer_id"]}, {"_id": 0}) or {}
        return {
            "type": "Chick Sale", "type_key": "chick", "sale": sale, "customer": cust,
            "item_name": f"Chicks (Batch {sale.get('batch_no','')})",
            "unit": "nos",
        }
    if stype == "farm":
        sale = await db.farm_sales.find_one({"id": sale_id}, {"_id": 0})
        if not sale: raise HTTPException(404, "Farm sale not found")
        cust = await db.customers.find_one({"id": sale["customer_id"]}, {"_id": 0}) or {}
        return {
            "type": "Farm Sale", "type_key": "farm", "sale": sale, "customer": cust,
            "item_name": "Poultry Birds",
            "unit": "nos",
        }
    raise HTTPException(400, f"Invalid invoice type: {stype}")


def _build_invoice_pdf(ctx: dict) -> bytes:
    sale = ctx["sale"]; cust = ctx["customer"]
    quantity = float(sale.get("quantity", 0) or 0)
    unit_price = float(sale.get("unit_price", 0) or 0)
    transport = float(sale.get("transport", 0) or 0)
    discount = float(sale.get("discount", 0) or 0)
    subtotal = quantity * unit_price
    grand_total = float(sale.get("total", subtotal + transport - discount) or 0)

    buf = io.BytesIO()
    PAGE_W, PAGE_H = A5  # 148mm x 210mm
    c = canvas.Canvas(buf, pagesize=A5)
    M = 10 * mm

    # Header band
    c.setFillColor(colors.HexColor("#15803D"))
    c.rect(0, PAGE_H - 22 * mm, PAGE_W, 22 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(M, PAGE_H - 11 * mm, BUSINESS_INFO["name"])
    c.setFont("Helvetica", 8)
    c.drawString(M, PAGE_H - 16 * mm, BUSINESS_INFO["tagline"])
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(PAGE_W - M, PAGE_H - 11 * mm, "TAX INVOICE")
    c.setFont("Helvetica", 7)
    c.drawRightString(PAGE_W - M, PAGE_H - 16 * mm, ctx["type"])

    y = PAGE_H - 28 * mm
    c.setFillColor(colors.black)

    # Business details + GST
    c.setFont("Helvetica", 7.5)
    c.drawString(M, y, BUSINESS_INFO["address"])
    y -= 3.5 * mm
    c.drawString(M, y, f"Phone: {BUSINESS_INFO['phone']}  |  Email: {BUSINESS_INFO['email']}")
    y -= 3.5 * mm
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(M, y, f"GSTIN: {BUSINESS_INFO['gst']}")
    y -= 5 * mm

    # Invoice meta box
    c.setStrokeColor(colors.HexColor("#E5E7EB"))
    c.setLineWidth(0.5)
    box_h = 16 * mm
    c.rect(M, y - box_h, PAGE_W - 2 * M, box_h, fill=0, stroke=1)
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(colors.HexColor("#6B7280"))
    c.drawString(M + 2 * mm, y - 4 * mm, "INVOICE NO.")
    c.drawString(M + 50 * mm, y - 4 * mm, "INVOICE DATE")
    c.drawString(M + 95 * mm, y - 4 * mm, "PAYMENT STATUS")
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M + 2 * mm, y - 9 * mm, str(sale.get("invoice_no", "—")))
    c.setFont("Helvetica", 9)
    c.drawString(M + 50 * mm, y - 9 * mm, str(sale.get("date", "—")))
    pstatus = str(sale.get("payment_status", "pending")).upper()
    pcolor = colors.HexColor("#15803D") if pstatus == "PAID" else (
        colors.HexColor("#C2410C") if pstatus == "PENDING" else colors.HexColor("#CA8A04"))
    c.setFillColor(pcolor)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(M + 95 * mm, y - 9 * mm, pstatus)
    c.setFillColor(colors.black)
    y -= (box_h + 5 * mm)

    # Customer
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#6B7280"))
    c.drawString(M, y, "BILL TO")
    y -= 4 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(M, y, cust.get("name", "—"))
    y -= 4 * mm
    c.setFont("Helvetica", 8)
    if cust.get("farm_name"):
        c.drawString(M, y, cust["farm_name"]); y -= 3.5 * mm
    if cust.get("address"):
        c.drawString(M, y, cust["address"][:80]); y -= 3.5 * mm
    if cust.get("phone"):
        c.drawString(M, y, f"Phone: {cust['phone']}"); y -= 3.5 * mm
    if cust.get("gst"):
        c.drawString(M, y, f"GSTIN: {cust['gst']}"); y -= 3.5 * mm
    y -= 3 * mm

    # Items table header
    c.setFillColor(colors.HexColor("#F3F4F6"))
    c.rect(M, y - 6 * mm, PAGE_W - 2 * M, 6 * mm, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#374151"))
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(M + 2 * mm, y - 4 * mm, "DESCRIPTION")
    c.drawRightString(M + 78 * mm, y - 4 * mm, "QTY")
    c.drawRightString(M + 102 * mm, y - 4 * mm, "RATE")
    c.drawRightString(PAGE_W - M - 2 * mm, y - 4 * mm, "AMOUNT")
    y -= 6 * mm

    # Item row
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 9)
    c.drawString(M + 2 * mm, y - 5 * mm, ctx["item_name"][:48])
    c.drawRightString(M + 78 * mm, y - 5 * mm, f"{quantity:g} {ctx['unit']}")
    c.drawRightString(M + 102 * mm, y - 5 * mm, f"Rs. {unit_price:,.2f}")
    c.drawRightString(PAGE_W - M - 2 * mm, y - 5 * mm, f"Rs. {subtotal:,.2f}")
    y -= 8 * mm

    # Totals breakdown
    c.setStrokeColor(colors.HexColor("#E5E7EB"))
    c.line(M, y, PAGE_W - M, y)
    y -= 4 * mm
    c.setFont("Helvetica", 8.5)
    def row(label, value, bold=False, color=None):
        nonlocal y
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 9 if bold else 8.5)
        if color: c.setFillColor(color)
        c.drawRightString(M + 102 * mm, y, label)
        c.drawRightString(PAGE_W - M - 2 * mm, y, value)
        c.setFillColor(colors.black)
        y -= 4.5 * mm

    row("Subtotal", f"Rs. {subtotal:,.2f}")
    row("Transport", f"Rs. {transport:,.2f}")
    row("Discount", f"- Rs. {discount:,.2f}")
    y -= 1 * mm
    c.setFillColor(colors.HexColor("#15803D"))
    c.rect(M + 60 * mm, y - 2 * mm, PAGE_W - 2 * M - 60 * mm, 8 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(M + 102 * mm, y + 2.5 * mm, "GRAND TOTAL")
    c.drawRightString(PAGE_W - M - 2 * mm, y + 2.5 * mm, f"Rs. {grand_total:,.2f}")
    c.setFillColor(colors.black)
    y -= 14 * mm

    # Thank-you + signature
    c.setFont("Helvetica-Oblique", 9)
    c.setFillColor(colors.HexColor("#15803D"))
    c.drawString(M, y, "Thank you for your business")
    c.setFillColor(colors.black)

    # Signature line bottom-right
    sig_y = 18 * mm
    c.setStrokeColor(colors.HexColor("#9CA3AF"))
    c.line(PAGE_W - M - 50 * mm, sig_y, PAGE_W - M, sig_y)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#6B7280"))
    c.drawRightString(PAGE_W - M, sig_y - 4 * mm, "Authorised Signatory")

    # Footer
    c.setFont("Helvetica", 6.5)
    c.drawString(M, 8 * mm, f"This is a computer-generated invoice  •  {BUSINESS_INFO['name']}")

    c.showPage()
    c.save()
    return buf.getvalue()


@api.get("/invoice/{stype}/{sale_id}/pdf")
async def invoice_pdf(stype: str, sale_id: str, user=Depends(get_user)):
    ctx = await _load_sale(stype, sale_id)
    pdf_bytes = _build_invoice_pdf(ctx)
    inv_no = ctx["sale"].get("invoice_no", sale_id)
    filename = f"Invoice-{inv_no}.pdf"
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'})


@api.get("/invoice/{stype}/{sale_id}/print", response_class=HTMLResponse)
async def invoice_print(stype: str, sale_id: str, request: Request, user=Depends(get_user)):
    ctx = await _load_sale(stype, sale_id)
    inv_no = ctx["sale"].get("invoice_no", sale_id)
    # PDF endpoint URL (relative path is fine inside an iframe)
    pdf_url = f"/api/invoice/{stype}/{sale_id}/pdf"
    html = f"""<!doctype html><html><head><meta charset="utf-8">
<title>Print Invoice {inv_no}</title>
<style>
  html,body{{margin:0;padding:0;height:100%;background:#f3f4f6;font-family:system-ui,sans-serif}}
  iframe{{width:100%;height:100vh;border:0;background:#fff}}
  .bar{{position:fixed;top:8px;right:8px;z-index:10}}
  .bar button{{background:#15803D;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-weight:600;cursor:pointer}}
</style></head>
<body>
<div class="bar"><button onclick="doPrint()">Print Again</button></div>
<iframe id="pdf" src="{pdf_url}"></iframe>
<script>
  function doPrint() {{
    const f = document.getElementById('pdf');
    try {{ f.contentWindow.focus(); f.contentWindow.print(); }}
    catch(e) {{ window.print(); }}
  }}
  document.getElementById('pdf').addEventListener('load', function() {{
    setTimeout(doPrint, 600);
  }});
</script>
</body></html>"""
    return HTMLResponse(content=html)


@api.post("/invoice/{stype}/{sale_id}/share")
async def invoice_share(stype: str, sale_id: str, request: Request, user=Depends(get_user)):
    ctx = await _load_sale(stype, sale_id)
    sale = ctx["sale"]; cust = ctx["customer"]
    inv_no = sale.get("invoice_no", sale_id)
    total = float(sale.get("total", 0) or 0)
    base = str(request.base_url).rstrip("/")
    pdf_url = f"{base}/api/invoice/{stype}/{sale_id}/pdf"

    message = (
        f"Hello {cust.get('name','Customer')},\n\n"
        f"Please find your invoice from {BUSINESS_INFO['name']}.\n\n"
        f"Invoice No: {inv_no}\n"
        f"Date: {sale.get('date','')}\n"
        f"Amount: Rs. {total:,.2f}\n"
        f"Payment Status: {str(sale.get('payment_status','pending')).upper()}\n\n"
        f"Invoice PDF: {pdf_url}\n\n"
        f"Thank you for your business."
    )
    phone_raw = "".join(ch for ch in (cust.get("phone") or "") if ch.isdigit())
    if phone_raw and not phone_raw.startswith("91") and len(phone_raw) == 10:
        phone_raw = "91" + phone_raw
    wa_phone = phone_raw  # may be empty -> generic wa.me/?text=
    whatsapp_url = (f"https://wa.me/{wa_phone}?text={quote(message)}"
                    if wa_phone else f"https://wa.me/?text={quote(message)}")

    subject = f"Invoice {inv_no} from {BUSINESS_INFO['name']}"
    mailto_url = f"mailto:{quote(cust.get('email',''))}?subject={quote(subject)}&body={quote(message)}"

    return {
        "whatsapp_url": whatsapp_url,
        "mailto_url": mailto_url,
        "pdf_url": pdf_url,
        "invoice_no": inv_no,
    }


# ============ Startup ============
app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True,
                   allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS","").split(",") if o.strip()],
                   allow_methods=["*"], allow_headers=["*"])

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    for coll in ["users","customers","suppliers","feed_items","feed_purchases","feed_sales",
                 "egg_purchases","poultry_batches","batch_expenses","chick_sales",
                 "farm_stock","farm_sales","farm_expenses","water_tanks","water_tank_additions",
                 "water_sales","water_expenses","internal_transfers","payments","finance_transactions"]:
        await db[coll].create_index("id", unique=True, sparse=True)
    await db.users.create_index("email", unique=True)
    await db.finance_transactions.create_index([("date", 1), ("business_unit", 1)])

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@agribiz.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"id": new_id(), "email": admin_email,
            "password_hash": hp(admin_password), "name": "Admin", "role": "admin",
            "created_at": now_iso()})
        logger.info(f"Seeded admin: {admin_email}")
    elif not vp(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hp(admin_password)}})
