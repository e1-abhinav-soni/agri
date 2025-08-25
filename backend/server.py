from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Cookie
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.encoders import jsonable_encoder
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timedelta
import aiohttp
import json
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer(auto_error=False)

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())

class UserSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())

class AuthRequest(BaseModel):
    session_id: str

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    price: float
    image_url: str
    state: str
    category: str
    farmer_name: str
    quantity_available: int
    unit: str  # kg, tons, etc.

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    image_url: str
    state: str
    category: str
    farmer_name: str
    quantity_available: int
    unit: str

class CartItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    quantity: int
    user_id: Optional[str] = None  # For authenticated users
    user_session: str  # For guest users

class CartItemCreate(BaseModel):
    product_id: str
    quantity: int
    user_session: str

class StateInfo(BaseModel):
    name: str
    agricultural_products: List[str]
    description: str
    coordinates: dict  # For 3D positioning

class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    amount: float
    currency: str
    payment_status: str  # pending, paid, failed
    user_session: str
    user_id: Optional[str] = None
    cart_items: List[str]  # product IDs
    created_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    updated_at: datetime = Field(default_factory=lambda: datetime.utcnow())
    metadata: Optional[Dict[str, str]] = None

class CheckoutRequest(BaseModel):
    origin_url: str
    user_session: str

# Auth helper functions
async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    """Get current user from session token in cookie or Authorization header"""
    token = None
    
    # Try to get token from cookie first
    if session_token:
        token = session_token
    # Fallback to Authorization header
    elif credentials:
        token = credentials.credentials
    
    if not token:
        return None
    
    # Find session in database
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        return None
    
    # Convert expires_at to datetime for comparison
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        # Remove any timezone info and parse
        expires_at_str = expires_at.replace('Z', '').split('.')[0]  # Remove microseconds and Z
        try:
            expires_at = datetime.fromisoformat(expires_at_str)
        except ValueError:
            # If parsing fails, treat as expired
            return None
    elif not isinstance(expires_at, datetime):
        # If it's neither string nor datetime, treat as expired
        return None
    
    # Now we can safely compare datetime objects
    try:
        if expires_at < datetime.utcnow():
            return None
    except TypeError:
        # If comparison still fails, treat as expired
        return None
    
    # Get user data
    user = await db.users.find_one({"id": session["user_id"]})
    if user:
        return User(**user)
    
    return None

# Sample data for Indian states and their agricultural products
STATES_DATA = {
    "punjab": {
        "name": "Punjab",
        "agricultural_products": ["Wheat", "Basmati Rice", "Cotton", "Dairy Products"],
        "description": "Known as the 'Granary of India', Punjab is famous for wheat and basmati rice production.",
        "coordinates": {"x": -1.8, "y": 2.4, "z": 0}
    },
    "maharashtra": {
        "name": "Maharashtra",
        "agricultural_products": ["Cotton", "Sugarcane", "Grapes", "Onions", "Turmeric"],
        "description": "Maharashtra leads in cotton and sugarcane production, also famous for wine grapes.",
        "coordinates": {"x": -0.6, "y": 0.6, "z": 0}
    },
    "kerala": {
        "name": "Kerala",
        "agricultural_products": ["Spices", "Coconut", "Tea", "Coffee", "Cardamom", "Black Pepper"],
        "description": "The 'Spice Garden of India', Kerala produces finest quality spices and coconut.",
        "coordinates": {"x": 0.3, "y": -1.5, "z": 0}
    },
    "tamil_nadu": {
        "name": "Tamil Nadu",
        "agricultural_products": ["Rice", "Tea", "Coffee", "Bananas", "Coconut"],
        "description": "Major rice producer with excellent tea and coffee plantations in hill regions.",
        "coordinates": {"x": 0.9, "y": -0.9, "z": 0}
    },
    "karnataka": {
        "name": "Karnataka",
        "agricultural_products": ["Coffee", "Silk", "Ragi", "Areca Nut", "Spices"],
        "description": "India's coffee hub, producing premium arabica and robusta coffee varieties.",
        "coordinates": {"x": 0.3, "y": -0.3, "z": 0}
    },
    "west_bengal": {
        "name": "West Bengal",
        "agricultural_products": ["Rice", "Jute", "Tea", "Fish", "Potatoes"],
        "description": "Leading producer of rice and jute, with famous Darjeeling tea.",
        "coordinates": {"x": 1.8, "y": 0.9, "z": 0}
    },
    "gujarat": {
        "name": "Gujarat",
        "agricultural_products": ["Cotton", "Groundnut", "Cumin", "Milk Products", "Dates"],
        "description": "Largest producer of cotton and groundnut in India, also leading in dairy.",
        "coordinates": {"x": -1.8, "y": 0.9, "z": 0}
    },
    "rajasthan": {
        "name": "Rajasthan",
        "agricultural_products": ["Bajra", "Mustard", "Cumin", "Barley", "Gram"],
        "description": "Desert state producing drought-resistant crops and famous for mustard and cumin.",
        "coordinates": {"x": -1.2, "y": 1.5, "z": 0}
    }
}

# Sample products data
SAMPLE_PRODUCTS = [
    # Punjab Products
    {"name": "Premium Basmati Rice", "description": "Aromatic long-grain basmati rice from Punjab fields", "price": 120.0, "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400", "state": "punjab", "category": "Grains", "farmer_name": "Harpreet Singh", "quantity_available": 1000, "unit": "kg"},
    {"name": "Golden Wheat", "description": "High-quality wheat grain perfect for making flour", "price": 25.0, "image_url": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400", "state": "punjab", "category": "Grains", "farmer_name": "Sukhdev Kaur", "quantity_available": 5000, "unit": "kg"},
    
    # Maharashtra Products
    {"name": "Organic Cotton", "description": "Pure organic cotton from Maharashtra farms", "price": 80.0, "image_url": "https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?w=400", "state": "maharashtra", "category": "Fiber", "farmer_name": "Ramesh Patil", "quantity_available": 2000, "unit": "kg"},
    {"name": "Fresh Grapes", "description": "Sweet and juicy grapes from Nashik vineyards", "price": 60.0, "image_url": "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=400", "state": "maharashtra", "category": "Fruits", "farmer_name": "Vineeta Sharma", "quantity_available": 500, "unit": "kg"},
    
    # Kerala Products
    {"name": "Premium Cardamom", "description": "Aromatic green cardamom from Kerala hills", "price": 1200.0, "image_url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400", "state": "kerala", "category": "Spices", "farmer_name": "Mohanan Nair", "quantity_available": 50, "unit": "kg"},
    {"name": "Black Pepper", "description": "King of spices - premium black pepper from Western Ghats", "price": 800.0, "image_url": "https://images.unsplash.com/photo-1599940824045-7ac4277b83b4?w=400", "state": "kerala", "category": "Spices", "farmer_name": "Priya Menon", "quantity_available": 100, "unit": "kg"},
    {"name": "Fresh Coconuts", "description": "Fresh coconuts rich in water and meat", "price": 30.0, "image_url": "https://images.unsplash.com/photo-1447175008436-054170c2e979?w=400", "state": "kerala", "category": "Fruits", "farmer_name": "Ravi Kumar", "quantity_available": 1000, "unit": "pieces"},
    
    # Tamil Nadu Products
    {"name": "Nilgiri Tea", "description": "Premium black tea from Nilgiri mountains", "price": 400.0, "image_url": "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=400", "state": "tamil_nadu", "category": "Beverages", "farmer_name": "Murugan Pillai", "quantity_available": 200, "unit": "kg"},
    {"name": "Red Rice", "description": "Nutritious red rice variety from Tamil Nadu", "price": 45.0, "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400", "state": "tamil_nadu", "category": "Grains", "farmer_name": "Kamala Devi", "quantity_available": 800, "unit": "kg"},
    
    # Karnataka Products
    {"name": "Arabica Coffee Beans", "description": "Premium arabica coffee from Coorg plantations", "price": 600.0, "image_url": "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400", "state": "karnataka", "category": "Beverages", "farmer_name": "Chandra Gowda", "quantity_available": 300, "unit": "kg"},
    {"name": "Ragi Flour", "description": "Healthy finger millet flour rich in calcium", "price": 35.0, "image_url": "https://images.unsplash.com/photo-1574684891174-df6b02ab38d7?w=400", "state": "karnataka", "category": "Grains", "farmer_name": "Lakshmi Naik", "quantity_available": 600, "unit": "kg"},
    
    # West Bengal Products
    {"name": "Darjeeling Tea", "description": "World-famous Darjeeling tea with muscatel flavor", "price": 800.0, "image_url": "https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=400", "state": "west_bengal", "category": "Beverages", "farmer_name": "Bikash Sharma", "quantity_available": 150, "unit": "kg"},
    {"name": "Gobindobhog Rice", "description": "Aromatic short-grain rice from Bengal", "price": 85.0, "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400", "state": "west_bengal", "category": "Grains", "farmer_name": "Subhash Ghosh", "quantity_available": 400, "unit": "kg"},
    
    # Gujarat Products
    {"name": "Groundnut Oil", "description": "Pure cold-pressed groundnut oil from Gujarat", "price": 150.0, "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", "state": "gujarat", "category": "Oils", "farmer_name": "Kiran Patel", "quantity_available": 500, "unit": "liters"},
    {"name": "Cumin Seeds", "description": "Aromatic cumin seeds from Gujarat farms", "price": 350.0, "image_url": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400", "state": "gujarat", "category": "Spices", "farmer_name": "Meera Shah", "quantity_available": 200, "unit": "kg"},
    
    # Rajasthan Products
    {"name": "Mustard Oil", "description": "Pure mustard oil with strong aroma from Rajasthan", "price": 120.0, "image_url": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400", "state": "rajasthan", "category": "Oils", "farmer_name": "Ramesh Singh", "quantity_available": 300, "unit": "liters"},
    {"name": "Bajra Flour", "description": "Nutritious pearl millet flour from desert regions", "price": 40.0, "image_url": "https://images.unsplash.com/photo-1574684891174-df6b02ab38d7?w=400", "state": "rajasthan", "category": "Grains", "farmer_name": "Sunita Devi", "quantity_available": 800, "unit": "kg"}
]

# Initialize database with sample data
@app.on_event("startup")
async def startup_event():
    # Check if products already exist
    existing_products = await db.products.count_documents({})
    if existing_products == 0:
        # Insert sample products
        products_to_insert = []
        for product_data in SAMPLE_PRODUCTS:
            product = Product(**product_data)
            products_to_insert.append(product.dict())
        await db.products.insert_many(products_to_insert)
        logging.info(f"Inserted {len(products_to_insert)} sample products")

# API Routes
@api_router.get("/")
async def root():
    return {"message": "AgriMap Market API"}

# Authentication Routes
@api_router.post("/auth/login")
async def authenticate_user(auth_request: AuthRequest, request: Request):
    """Authenticate user with Emergent session ID"""
    try:
        # Call Emergent auth API
        async with aiohttp.ClientSession() as session:
            headers = {"X-Session-ID": auth_request.session_id}
            async with session.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers=headers
            ) as response:
                if response.status != 200:
                    raise HTTPException(status_code=401, detail="Invalid session")
                
                auth_data = await response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": auth_data["email"]})
        
        if not existing_user:
            # Create new user
            user_data = {
                "id": str(uuid.uuid4()),
                "email": auth_data["email"],
                "name": auth_data["name"],
                "picture": auth_data.get("picture"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            user = User(**user_data)
            await db.users.insert_one(jsonable_encoder(user))
            user_id = user.id
        else:
            user_id = existing_user["id"]
            user = User(**existing_user)
        
        # Create session
        session_token = auth_data["session_token"]
        expires_at = datetime.utcnow() + timedelta(days=7)
        
        user_session_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at,
            "created_at": datetime.utcnow()
        }
        
        user_session = UserSession(**user_session_data)
        await db.user_sessions.insert_one(jsonable_encoder(user_session))
        
        # Create response with HttpOnly cookie
        response = JSONResponse(jsonable_encoder({
            "user": user.dict(),
            "message": "Authentication successful"
        }))
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            max_age=7*24*60*60,  # 7 days
            httponly=True,
            secure=True,
            samesite="none",
            path="/"
        )
        
        return response
        
    except Exception as e:
        logging.error(f"Authentication error: {str(e)}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@api_router.post("/auth/logout")
async def logout_user(request: Request, current_user: Optional[User] = Depends(get_current_user)):
    """Logout user and invalidate session"""
    if current_user:
        session_token = request.cookies.get("session_token")
        if session_token:
            await db.user_sessions.delete_one({"session_token": session_token})
    
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie("session_token", path="/")
    return response

@api_router.get("/auth/me")
async def get_current_user_info(current_user: Optional[User] = Depends(get_current_user)):
    """Get current user information"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return current_user

@api_router.get("/states", response_model=dict)
async def get_states():
    return STATES_DATA

@api_router.get("/states/{state_name}", response_model=dict)
async def get_state_info(state_name: str):
    if state_name.lower() in STATES_DATA:
        return STATES_DATA[state_name.lower()]
    raise HTTPException(status_code=404, detail="State not found")

@api_router.get("/products", response_model=List[Product])
async def get_products(state: Optional[str] = None, category: Optional[str] = None):
    query = {}
    if state:
        query["state"] = state.lower()
    if category:
        query["category"] = category
    
    products = await db.products.find(query).to_list(1000)
    return [Product(**product) for product in products]

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**product)

@api_router.post("/cart/add", response_model=CartItem)
async def add_to_cart(cart_item: CartItemCreate, current_user: Optional[User] = Depends(get_current_user)):
    # Verify product exists
    product = await db.products.find_one({"id": cart_item.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Set user_id if authenticated
    user_id = current_user.id if current_user else None
    
    # Check if item already exists in cart
    query = {"product_id": cart_item.product_id}
    if user_id:
        query["user_id"] = user_id
    else:
        query["user_session"] = cart_item.user_session
        query["user_id"] = None
    
    existing_item = await db.cart_items.find_one(query)
    
    if existing_item:
        # Update quantity
        new_quantity = existing_item["quantity"] + cart_item.quantity
        await db.cart_items.update_one(
            {"id": existing_item["id"]},
            {"$set": {"quantity": new_quantity}}
        )
        existing_item["quantity"] = new_quantity
        return CartItem(**existing_item)
    else:
        # Create new cart item
        cart_item_dict = cart_item.dict()
        cart_item_dict["user_id"] = user_id
        cart_item_obj = CartItem(**cart_item_dict)
        await db.cart_items.insert_one(cart_item_obj.dict())
        return cart_item_obj

@api_router.get("/cart/{user_session}", response_model=List[dict])
async def get_cart(user_session: str, current_user: Optional[User] = Depends(get_current_user)):
    # Get cart items for user (authenticated or guest)
    if current_user:
        cart_items = await db.cart_items.find({"user_id": current_user.id}).to_list(1000)
    else:
        cart_items = await db.cart_items.find({
            "user_session": user_session,
            "user_id": None
        }).to_list(1000)
    
    # Enrich cart items with product details
    enriched_items = []
    for item in cart_items:
        product = await db.products.find_one({"id": item["product_id"]})
        if product:
            enriched_items.append({
                "cart_item": CartItem(**item),
                "product": Product(**product),
                "total_price": product["price"] * item["quantity"]
            })
    
    return enriched_items

@api_router.delete("/cart/{user_session}/{product_id}")
async def remove_from_cart(user_session: str, product_id: str, current_user: Optional[User] = Depends(get_current_user)):
    query = {"product_id": product_id}
    if current_user:
        query["user_id"] = current_user.id
    else:
        query["user_session"] = user_session
        query["user_id"] = None
    
    result = await db.cart_items.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return {"message": "Item removed from cart"}

@api_router.put("/cart/{user_session}/{product_id}")
async def update_cart_quantity(user_session: str, product_id: str, quantity: int, current_user: Optional[User] = Depends(get_current_user)):
    if quantity <= 0:
        # Remove item if quantity is 0 or negative
        return await remove_from_cart(user_session, product_id, current_user)
    
    query = {"product_id": product_id}
    if current_user:
        query["user_id"] = current_user.id
    else:
        query["user_session"] = user_session
        query["user_id"] = None
    
    result = await db.cart_items.update_one(
        query,
        {"$set": {"quantity": quantity}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return {"message": "Cart updated"}

# Stripe Payment Integration
@api_router.post("/checkout/create-session")
async def create_checkout_session(request: Request, checkout_req: CheckoutRequest, current_user: Optional[User] = Depends(get_current_user)):
    try:
        # Get cart items based on authentication status
        if current_user:
            cart_items = await db.cart_items.find({"user_id": current_user.id}).to_list(1000)
        else:
            cart_items = await db.cart_items.find({
                "user_session": checkout_req.user_session,
                "user_id": None
            }).to_list(1000)
        
        if not cart_items:
            raise HTTPException(status_code=400, detail="Cart is empty")
        
        # Calculate total amount
        total_amount = 0.0
        product_ids = []
        for item in cart_items:
            product = await db.products.find_one({"id": item["product_id"]})
            if product:
                total_amount += product["price"] * item["quantity"]
                product_ids.append(item["product_id"])
        
        if total_amount <= 0:
            raise HTTPException(status_code=400, detail="Invalid cart total")
        
        # Convert INR to USD for Stripe (approximate conversion rate)
        usd_amount = round(total_amount / 82.0, 2)  # Assuming 1 USD = 82 INR
        
        # Initialize Stripe checkout
        stripe_api_key = os.environ.get('STRIPE_API_KEY')
        if not stripe_api_key:
            raise HTTPException(status_code=500, detail="Stripe API key not configured")
        
        host_url = str(request.base_url).rstrip('/')
        webhook_url = f"{host_url}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
        
        # Create success and cancel URLs
        success_url = f"{checkout_req.origin_url}/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{checkout_req.origin_url}/cancel"
        
        # Create checkout session
        metadata = {
            "user_session": checkout_req.user_session,
            "product_ids": ",".join(product_ids),
            "inr_amount": str(total_amount)
        }
        
        # Add user info only if user is authenticated
        if current_user:
            metadata["user_id"] = current_user.id
            metadata["user_email"] = current_user.email
        else:
            metadata["user_id"] = "guest"
            metadata["user_email"] = "guest"
        
        checkout_request = CheckoutSessionRequest(
            amount=usd_amount,
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create payment transaction record
        transaction_metadata = {
            "usd_amount": str(usd_amount),
            "stripe_session_id": session.session_id,
            "user_email": current_user.email if current_user else "guest"
        }
        
        payment_transaction_data = {
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "amount": total_amount,
            "currency": "INR",
            "payment_status": "pending",
            "user_session": checkout_req.user_session,
            "user_id": current_user.id if current_user else None,
            "cart_items": product_ids,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "metadata": transaction_metadata
        }
        
        payment_transaction = PaymentTransaction(**payment_transaction_data)
        await db.payment_transactions.insert_one(jsonable_encoder(payment_transaction))
        
        return {"url": session.url, "session_id": session.session_id}
        
    except Exception as e:
        logging.error(f"Error creating checkout session: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    try:
        # Get payment transaction from database
        transaction = await db.payment_transactions.find_one({"session_id": session_id})
        if not transaction:
            raise HTTPException(status_code=404, detail="Payment transaction not found")
        
        # Check with Stripe
        stripe_api_key = os.environ.get('STRIPE_API_KEY')
        webhook_url = f"{os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
        
        checkout_status = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction status if changed
        if checkout_status.payment_status != transaction["payment_status"]:
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {
                    "$set": {
                        "payment_status": checkout_status.payment_status,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Clear cart if payment successful
            if checkout_status.payment_status == "paid":
                if transaction["user_id"]:
                    await db.cart_items.delete_many({"user_id": transaction["user_id"]})
                else:
                    await db.cart_items.delete_many({"user_session": transaction["user_session"]})
        
        return {
            "status": checkout_status.status,
            "payment_status": checkout_status.payment_status,
            "amount_total": checkout_status.amount_total,
            "currency": checkout_status.currency,
            "inr_amount": transaction["amount"]
        }
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        logging.error(f"Error checking payment status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        stripe_api_key = os.environ.get('STRIPE_API_KEY')
        webhook_url = f"{str(request.base_url)}/api/webhook/stripe"
        stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update payment transaction based on webhook
        if webhook_response.session_id:
            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {
                    "$set": {
                        "payment_status": webhook_response.payment_status,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
        
        return {"status": "success"}
        
    except Exception as e:
        logging.error(f"Webhook error: {str(e)}")
        return JSONResponse(status_code=400, content={"error": str(e)})

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()