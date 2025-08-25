from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

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

# Define Models
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
    user_session: str  # For now, using session-based cart

class CartItemCreate(BaseModel):
    product_id: str
    quantity: int
    user_session: str

class StateInfo(BaseModel):
    name: str
    agricultural_products: List[str]
    description: str
    coordinates: dict  # For 3D positioning

# Sample data for Indian states and their agricultural products
STATES_DATA = {
    "punjab": {
        "name": "Punjab",
        "agricultural_products": ["Wheat", "Basmati Rice", "Cotton", "Dairy Products"],
        "description": "Known as the 'Granary of India', Punjab is famous for wheat and basmati rice production.",
        "coordinates": {"x": -0.5, "y": 0.8, "z": 0}
    },
    "maharashtra": {
        "name": "Maharashtra",
        "agricultural_products": ["Cotton", "Sugarcane", "Grapes", "Onions", "Turmeric"],
        "description": "Maharashtra leads in cotton and sugarcane production, also famous for wine grapes.",
        "coordinates": {"x": -0.2, "y": 0.2, "z": 0}
    },
    "kerala": {
        "name": "Kerala",
        "agricultural_products": ["Spices", "Coconut", "Tea", "Coffee", "Cardamom", "Black Pepper"],
        "description": "The 'Spice Garden of India', Kerala produces finest quality spices and coconut.",
        "coordinates": {"x": 0.1, "y": -0.5, "z": 0}
    },
    "tamil_nadu": {
        "name": "Tamil Nadu",
        "agricultural_products": ["Rice", "Tea", "Coffee", "Bananas", "Coconut"],
        "description": "Major rice producer with excellent tea and coffee plantations in hill regions.",
        "coordinates": {"x": 0.3, "y": -0.3, "z": 0}
    },
    "karnataka": {
        "name": "Karnataka",
        "agricultural_products": ["Coffee", "Silk", "Ragi", "Areca Nut", "Spices"],
        "description": "India's coffee hub, producing premium arabica and robusta coffee varieties.",
        "coordinates": {"x": 0.1, "y": -0.1, "z": 0}
    },
    "west_bengal": {
        "name": "West Bengal",
        "agricultural_products": ["Rice", "Jute", "Tea", "Fish", "Potatoes"],
        "description": "Leading producer of rice and jute, with famous Darjeeling tea.",
        "coordinates": {"x": 0.6, "y": 0.3, "z": 0}
    },
    "gujarat": {
        "name": "Gujarat",
        "agricultural_products": ["Cotton", "Groundnut", "Cumin", "Milk Products", "Dates"],
        "description": "Largest producer of cotton and groundnut in India, also leading in dairy.",
        "coordinates": {"x": -0.6, "y": 0.3, "z": 0}
    },
    "rajasthan": {
        "name": "Rajasthan",
        "agricultural_products": ["Bajra", "Mustard", "Cumin", "Barley", "Gram"],
        "description": "Desert state producing drought-resistant crops and famous for mustard and cumin.",
        "coordinates": {"x": -0.4, "y": 0.5, "z": 0}
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
async def add_to_cart(cart_item: CartItemCreate):
    # Verify product exists
    product = await db.products.find_one({"id": cart_item.product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if item already exists in cart
    existing_item = await db.cart_items.find_one({
        "product_id": cart_item.product_id,
        "user_session": cart_item.user_session
    })
    
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
        cart_item_obj = CartItem(**cart_item.dict())
        await db.cart_items.insert_one(cart_item_obj.dict())
        return cart_item_obj

@api_router.get("/cart/{user_session}", response_model=List[dict])
async def get_cart(user_session: str):
    cart_items = await db.cart_items.find({"user_session": user_session}).to_list(1000)
    
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
async def remove_from_cart(user_session: str, product_id: str):
    result = await db.cart_items.delete_one({
        "product_id": product_id,
        "user_session": user_session
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return {"message": "Item removed from cart"}

@api_router.put("/cart/{user_session}/{product_id}")
async def update_cart_quantity(user_session: str, product_id: str, quantity: int):
    if quantity <= 0:
        # Remove item if quantity is 0 or negative
        return await remove_from_cart(user_session, product_id)
    
    result = await db.cart_items.update_one(
        {"product_id": product_id, "user_session": user_session},
        {"$set": {"quantity": quantity}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Cart item not found")
    return {"message": "Cart updated"}

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