from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# -------------------- Setup --------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 24h for internal dashboard

app = FastAPI(title="AgriBiz Platform API")
api = APIRouter(prefix="/api")

bearer = HTTPBearer(auto_error=False)

VALID_ROLES = {"super_admin", "owner", "manager", "accountant", "farm_staff", "driver"}

# -------------------- Helpers --------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def make_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def strip_user(u: dict) -> dict:
    u = {**u}
    u.pop("password_hash", None)
    u.pop("_id", None)
    return u

async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
) -> dict:
    token = None
    if creds and creds.credentials:
        token = creds.credentials
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return strip_user(user)

def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles and user.get("role") != "super_admin":
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return checker

# -------------------- Models --------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    role: str = "farm_staff"
    phone: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None

class CustomerIn(BaseModel):
    name: str
    business_name: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    gst: Optional[str] = ""
    credit_limit: float = 0.0
    payment_terms: Optional[str] = "Net 30"
    status: str = "active"

class BatchIn(BaseModel):
    batch_no: str
    hatch_date: str
    quantity: int
    mortality: int = 0
    feed_kg: float = 0.0
    status: str = "active"
    notes: Optional[str] = ""

class PoultrySaleIn(BaseModel):
    customer_id: str
    customer_name: str
    date: str
    product: str  # eggs/chicks/chickens/hens
    quantity: float
    unit_price: float
    transport: float = 0.0
    discount: float = 0.0
    payment_status: str = "pending"  # paid/partial/pending
    batch_id: Optional[str] = None

class ExpenseIn(BaseModel):
    category: str
    amount: float
    date: str
    notes: Optional[str] = ""
    batch_id: Optional[str] = None
    lorry_id: Optional[str] = None

class TankIn(BaseModel):
    name: str
    capacity: float
    current_liters: float = 0.0

class TankAdjustIn(BaseModel):
    delta: float  # +/-
    reason: str = "manual"

class LorryIn(BaseModel):
    registration_no: str
    capacity: float
    driver_id: Optional[str] = None
    driver_name: Optional[str] = ""
    status: str = "idle"  # idle/transit/maintenance

class WaterSaleIn(BaseModel):
    customer_id: str
    customer_name: str
    date: str
    liters: float
    rate: float
    delivery: float = 0.0
    payment_status: str = "pending"
    lorry_id: Optional[str] = None

class InventoryItemIn(BaseModel):
    name: str
    category: str  # feed/medicine/vaccine/water/other
    unit: str = "kg"
    stock: float = 0.0
    threshold: float = 0.0

class StockMoveIn(BaseModel):
    item_id: str
    type: str  # in/out/adjust
    quantity: float
    reason: Optional[str] = ""

class PaymentIn(BaseModel):
    customer_id: str
    amount: float
    date: str
    notes: Optional[str] = ""
    method: Optional[str] = "cash"

# -------------------- Auth Routes --------------------
@api.post("/auth/register")
async def register(payload: RegisterIn, user: dict = Depends(get_current_user)):
    # Only super_admin / owner can create users
    if user.get("role") not in ("super_admin", "owner"):
        raise HTTPException(status_code=403, detail="Only admin/owner can create users")
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already exists")
    doc = {
        "id": new_id(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": payload.role,
        "phone": payload.phone or "",
        "status": "active",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    return strip_user(doc)

@api.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("status") == "disabled":
        raise HTTPException(status_code=403, detail="Account disabled")
    token = make_token(user["id"], user["email"], user["role"])
    await db.audit_logs.insert_one({
        "id": new_id(), "user_id": user["id"], "action": "login",
        "details": {}, "ts": now_iso()
    })
    return {"access_token": token, "token_type": "bearer", "user": strip_user(user)}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.get("/users")
async def list_users(user: dict = Depends(require_roles("super_admin", "owner", "manager"))):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return items

@api.patch("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdateIn, user: dict = Depends(require_roles("super_admin", "owner"))):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "role" in update and update["role"] not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.users.update_one({"id": user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return doc

# -------------------- Generic CRUD helpers --------------------
async def list_collection(coll, filt: Optional[dict] = None, limit: int = 1000):
    items = await coll.find(filt or {}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items

# -------------------- Customers --------------------
@api.get("/customers")
async def list_customers(user: dict = Depends(get_current_user)):
    return await list_collection(db.customers)

@api.post("/customers")
async def create_customer(payload: CustomerIn, user: dict = Depends(require_roles("super_admin","owner","manager","accountant"))):
    doc = {"id": new_id(), **payload.model_dump(), "outstanding": 0.0, "created_at": now_iso()}
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/customers/{cid}")
async def update_customer(cid: str, payload: CustomerIn, user: dict = Depends(require_roles("super_admin","owner","manager","accountant"))):
    res = await db.customers.update_one({"id": cid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return await db.customers.find_one({"id": cid}, {"_id": 0})

@api.delete("/customers/{cid}")
async def delete_customer(cid: str, user: dict = Depends(require_roles("super_admin","owner"))):
    await db.customers.update_one({"id": cid}, {"$set": {"status": "deleted"}})
    return {"ok": True}

@api.get("/customers/{cid}/ledger")
async def customer_ledger(cid: str, user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    poultry = await db.poultry_sales.find({"customer_id": cid}, {"_id": 0}).to_list(1000)
    water = await db.water_sales.find({"customer_id": cid}, {"_id": 0}).to_list(1000)
    payments = await db.payments.find({"customer_id": cid}, {"_id": 0}).to_list(1000)
    return {"customer": customer, "poultry_sales": poultry, "water_sales": water, "payments": payments}

# -------------------- Poultry --------------------
@api.get("/poultry/batches")
async def list_batches(user: dict = Depends(get_current_user)):
    return await list_collection(db.poultry_batches)

@api.post("/poultry/batches")
async def create_batch(payload: BatchIn, user: dict = Depends(require_roles("super_admin","owner","manager","farm_staff"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.poultry_batches.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/poultry/batches/{bid}")
async def update_batch(bid: str, payload: BatchIn, user: dict = Depends(require_roles("super_admin","owner","manager","farm_staff"))):
    res = await db.poultry_batches.update_one({"id": bid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Batch not found")
    return await db.poultry_batches.find_one({"id": bid}, {"_id": 0})

@api.delete("/poultry/batches/{bid}")
async def delete_batch(bid: str, user: dict = Depends(require_roles("super_admin","owner","manager"))):
    await db.poultry_batches.delete_one({"id": bid})
    return {"ok": True}

@api.get("/poultry/sales")
async def list_poultry_sales(user: dict = Depends(get_current_user)):
    return await list_collection(db.poultry_sales)

@api.post("/poultry/sales")
async def create_poultry_sale(payload: PoultrySaleIn, user: dict = Depends(require_roles("super_admin","owner","manager","accountant"))):
    total = payload.quantity * payload.unit_price + payload.transport - payload.discount
    count = await db.poultry_sales.count_documents({}) + 1
    invoice_no = f"P-{datetime.now().year}-{count:05d}"
    doc = {"id": new_id(), "invoice_no": invoice_no, **payload.model_dump(),
           "total": round(total, 2), "created_at": now_iso()}
    await db.poultry_sales.insert_one(doc)
    doc.pop("_id", None)
    if payload.payment_status != "paid":
        await db.customers.update_one({"id": payload.customer_id}, {"$inc": {"outstanding": doc["total"]}})
    await db.finance_transactions.insert_one({
        "id": new_id(), "type": "income", "category": "poultry_sale",
        "amount": doc["total"], "date": payload.date, "source": "poultry",
        "ref_id": doc["id"], "notes": invoice_no, "created_at": now_iso()
    })
    return doc

@api.get("/poultry/expenses")
async def list_poultry_expenses(user: dict = Depends(get_current_user)):
    return await list_collection(db.poultry_expenses)

@api.post("/poultry/expenses")
async def create_poultry_expense(payload: ExpenseIn, user: dict = Depends(require_roles("super_admin","owner","manager","accountant","farm_staff"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.poultry_expenses.insert_one(doc)
    doc.pop("_id", None)
    await db.finance_transactions.insert_one({
        "id": new_id(), "type": "expense", "category": payload.category,
        "amount": payload.amount, "date": payload.date, "source": "poultry",
        "ref_id": doc["id"], "notes": payload.notes, "created_at": now_iso()
    })
    return doc

# -------------------- Water --------------------
@api.get("/water/tanks")
async def list_tanks(user: dict = Depends(get_current_user)):
    return await list_collection(db.water_tanks)

@api.post("/water/tanks")
async def create_tank(payload: TankIn, user: dict = Depends(require_roles("super_admin","owner","manager"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.water_tanks.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.post("/water/tanks/{tid}/adjust")
async def adjust_tank(tid: str, payload: TankAdjustIn, user: dict = Depends(require_roles("super_admin","owner","manager","farm_staff","driver"))):
    tank = await db.water_tanks.find_one({"id": tid})
    if not tank:
        raise HTTPException(status_code=404, detail="Tank not found")
    new_val = max(0.0, tank["current_liters"] + payload.delta)
    await db.water_tanks.update_one({"id": tid}, {"$set": {"current_liters": new_val}})
    await db.water_tank_movements.insert_one({
        "id": new_id(), "tank_id": tid, "delta": payload.delta,
        "reason": payload.reason, "ts": now_iso()
    })
    return {"id": tid, "current_liters": new_val}

@api.delete("/water/tanks/{tid}")
async def delete_tank(tid: str, user: dict = Depends(require_roles("super_admin","owner"))):
    await db.water_tanks.delete_one({"id": tid})
    return {"ok": True}

@api.get("/water/lorries")
async def list_lorries(user: dict = Depends(get_current_user)):
    return await list_collection(db.water_lorries)

@api.post("/water/lorries")
async def create_lorry(payload: LorryIn, user: dict = Depends(require_roles("super_admin","owner","manager"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.water_lorries.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/water/lorries/{lid}")
async def update_lorry(lid: str, payload: LorryIn, user: dict = Depends(require_roles("super_admin","owner","manager"))):
    res = await db.water_lorries.update_one({"id": lid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lorry not found")
    return await db.water_lorries.find_one({"id": lid}, {"_id": 0})

@api.delete("/water/lorries/{lid}")
async def delete_lorry(lid: str, user: dict = Depends(require_roles("super_admin","owner"))):
    await db.water_lorries.delete_one({"id": lid})
    return {"ok": True}

@api.get("/water/sales")
async def list_water_sales(user: dict = Depends(get_current_user)):
    return await list_collection(db.water_sales)

@api.post("/water/sales")
async def create_water_sale(payload: WaterSaleIn, user: dict = Depends(require_roles("super_admin","owner","manager","accountant","driver"))):
    total = payload.liters * payload.rate + payload.delivery
    count = await db.water_sales.count_documents({}) + 1
    invoice_no = f"W-{datetime.now().year}-{count:05d}"
    doc = {"id": new_id(), "invoice_no": invoice_no, **payload.model_dump(),
           "total": round(total, 2), "created_at": now_iso()}
    await db.water_sales.insert_one(doc)
    doc.pop("_id", None)
    if payload.payment_status != "paid":
        await db.customers.update_one({"id": payload.customer_id}, {"$inc": {"outstanding": doc["total"]}})
    await db.finance_transactions.insert_one({
        "id": new_id(), "type": "income", "category": "water_sale",
        "amount": doc["total"], "date": payload.date, "source": "water",
        "ref_id": doc["id"], "notes": invoice_no, "created_at": now_iso()
    })
    return doc

@api.get("/water/expenses")
async def list_water_expenses(user: dict = Depends(get_current_user)):
    return await list_collection(db.water_expenses)

@api.post("/water/expenses")
async def create_water_expense(payload: ExpenseIn, user: dict = Depends(require_roles("super_admin","owner","manager","accountant","driver"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.water_expenses.insert_one(doc)
    doc.pop("_id", None)
    await db.finance_transactions.insert_one({
        "id": new_id(), "type": "expense", "category": payload.category,
        "amount": payload.amount, "date": payload.date, "source": "water",
        "ref_id": doc["id"], "notes": payload.notes, "created_at": now_iso()
    })
    return doc

# -------------------- Inventory --------------------
@api.get("/inventory/items")
async def list_inventory(user: dict = Depends(get_current_user)):
    return await list_collection(db.inventory_items)

@api.post("/inventory/items")
async def create_inventory_item(payload: InventoryItemIn, user: dict = Depends(require_roles("super_admin","owner","manager","farm_staff"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.inventory_items.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.patch("/inventory/items/{iid}")
async def update_inventory_item(iid: str, payload: InventoryItemIn, user: dict = Depends(require_roles("super_admin","owner","manager"))):
    res = await db.inventory_items.update_one({"id": iid}, {"$set": payload.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return await db.inventory_items.find_one({"id": iid}, {"_id": 0})

@api.delete("/inventory/items/{iid}")
async def delete_inventory_item(iid: str, user: dict = Depends(require_roles("super_admin","owner"))):
    await db.inventory_items.delete_one({"id": iid})
    return {"ok": True}

@api.post("/inventory/move")
async def move_stock(payload: StockMoveIn, user: dict = Depends(require_roles("super_admin","owner","manager","farm_staff"))):
    item = await db.inventory_items.find_one({"id": payload.item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    qty = payload.quantity
    if payload.type == "in":
        new_stock = item["stock"] + qty
    elif payload.type == "out":
        new_stock = max(0.0, item["stock"] - qty)
    else:  # adjust
        new_stock = qty
    await db.inventory_items.update_one({"id": payload.item_id}, {"$set": {"stock": new_stock}})
    move = {"id": new_id(), **payload.model_dump(), "prev_stock": item["stock"],
            "new_stock": new_stock, "ts": now_iso()}
    await db.inventory_movements.insert_one(move)
    move.pop("_id", None)
    return move

@api.get("/inventory/movements")
async def list_movements(user: dict = Depends(get_current_user)):
    return await list_collection(db.inventory_movements)

# -------------------- Payments --------------------
@api.get("/payments")
async def list_payments(user: dict = Depends(get_current_user)):
    return await list_collection(db.payments)

@api.post("/payments")
async def record_payment(payload: PaymentIn, user: dict = Depends(require_roles("super_admin","owner","manager","accountant"))):
    doc = {"id": new_id(), **payload.model_dump(), "created_at": now_iso()}
    await db.payments.insert_one(doc)
    doc.pop("_id", None)
    await db.customers.update_one({"id": payload.customer_id}, {"$inc": {"outstanding": -payload.amount}})
    await db.finance_transactions.insert_one({
        "id": new_id(), "type": "income", "category": "payment_received",
        "amount": payload.amount, "date": payload.date, "source": "payment",
        "ref_id": doc["id"], "notes": payload.notes, "created_at": now_iso()
    })
    return doc

# -------------------- Finance --------------------
@api.get("/finance/transactions")
async def list_transactions(user: dict = Depends(get_current_user)):
    return await list_collection(db.finance_transactions, limit=2000)

@api.get("/finance/pnl")
async def pnl(user: dict = Depends(get_current_user), month: Optional[str] = None):
    # month format: YYYY-MM
    q: Dict[str, Any] = {}
    if month:
        q["date"] = {"$regex": f"^{month}"}
    txs = await db.finance_transactions.find(q, {"_id": 0}).to_list(5000)
    income = sum(t["amount"] for t in txs if t["type"] == "income")
    expense = sum(t["amount"] for t in txs if t["type"] == "expense")
    by_cat: Dict[str, float] = {}
    for t in txs:
        if t["type"] == "expense":
            by_cat[t["category"]] = by_cat.get(t["category"], 0) + t["amount"]
    return {"income": round(income, 2), "expense": round(expense, 2),
            "profit": round(income - expense, 2), "expense_by_category": by_cat}

# -------------------- Dashboard --------------------
@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    month = datetime.now(timezone.utc).strftime("%Y-%m")

    txs = await db.finance_transactions.find({}, {"_id": 0}).to_list(5000)
    today_sales = sum(t["amount"] for t in txs if t["type"] == "income" and t.get("date","").startswith(today))
    month_income = sum(t["amount"] for t in txs if t["type"] == "income" and t.get("date","").startswith(month))
    month_expense = sum(t["amount"] for t in txs if t["type"] == "expense" and t.get("date","").startswith(month))

    customers = await db.customers.find({}, {"_id": 0}).to_list(2000)
    outstanding = sum(c.get("outstanding", 0) for c in customers)
    top_customers = sorted(customers, key=lambda c: c.get("outstanding", 0), reverse=True)[:5]

    inv = await db.inventory_items.find({}, {"_id": 0}).to_list(500)
    low_stock = [i for i in inv if i.get("threshold", 0) > 0 and i.get("stock", 0) <= i.get("threshold", 0)]

    batches = await db.poultry_batches.find({"status": "active"}, {"_id": 0}).to_list(500)
    lorries = await db.water_lorries.find({}, {"_id": 0}).to_list(500)
    tanks = await db.water_tanks.find({}, {"_id": 0}).to_list(500)

    recent_poultry = await db.poultry_sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    recent_water = await db.water_sales.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)

    # Last 7 days revenue trend
    trend = []
    for i in range(6, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).strftime("%Y-%m-%d")
        amt = sum(t["amount"] for t in txs if t["type"] == "income" and t.get("date","").startswith(d))
        trend.append({"date": d[5:], "revenue": round(amt, 2)})

    return {
        "today_sales": round(today_sales, 2),
        "month_income": round(month_income, 2),
        "month_expense": round(month_expense, 2),
        "net_profit": round(month_income - month_expense, 2),
        "outstanding": round(outstanding, 2),
        "low_stock_count": len(low_stock),
        "active_batches": len(batches),
        "lorries_total": len(lorries),
        "tanks_total": len(tanks),
        "top_customers": top_customers,
        "low_stock": low_stock,
        "recent_poultry_sales": recent_poultry,
        "recent_water_sales": recent_water,
        "revenue_trend": trend,
    }

# -------------------- Startup --------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.customers.create_index("id", unique=True)
    await db.poultry_batches.create_index("id", unique=True)
    await db.poultry_sales.create_index("id", unique=True)
    await db.water_tanks.create_index("id", unique=True)
    await db.water_lorries.create_index("id", unique=True)
    await db.water_sales.create_index("id", unique=True)
    await db.inventory_items.create_index("id", unique=True)
    await db.finance_transactions.create_index("date")

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@agribiz.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": new_id(), "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin", "role": "super_admin",
            "phone": "", "status": "active", "created_at": now_iso(),
        })
        logger.info(f"Seeded admin user: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

@app.on_event("shutdown")
async def shutdown():
    client.close()
