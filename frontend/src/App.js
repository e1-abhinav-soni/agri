import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import axios from 'axios';
import './App.css';

// Import icons from lucide-react
import { ShoppingCart as CartIcon, X, Plus, Minus, Package, MapPin, Star } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Generate a simple session ID for cart management
const SESSION_ID = 'session_' + Math.random().toString(36).substr(2, 9);

// 2D Fallback Map Component
const IndiaMap2D = ({ onStateClick }) => {
  const [states, setStates] = useState({});

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await axios.get(`${API}/states`);
        setStates(response.data);
      } catch (error) {
        console.error('Error fetching states:', error);
      }
    };
    fetchStates();
  }, []);

  const stateColors = {
    'Punjab': '#22c55e',
    'Maharashtra': '#3b82f6', 
    'Kerala': '#10b981',
    'Tamil Nadu': '#f59e0b',
    'Karnataka': '#8b5cf6',
    'West Bengal': '#ef4444',
    'Gujarat': '#06b6d4',
    'Rajasthan': '#f97316'
  };

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-blue-100 to-green-100 rounded-3xl p-8 flex items-center justify-center">
      <div className="grid grid-cols-3 gap-4 max-w-2xl w-full">
        {Object.entries(states).map(([key, state]) => (
          <div
            key={key}
            onClick={() => onStateClick(key, state)}
            className="bg-white rounded-2xl p-6 shadow-lg cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-xl"
            style={{
              borderLeft: `6px solid ${stateColors[state.name] || '#64748b'}`
            }}
          >
            <h3 className="text-lg font-bold text-gray-800 mb-2">{state.name}</h3>
            <p className="text-gray-600 text-sm mb-3">{state.description}</p>
            <div className="flex flex-wrap gap-1">
              {state.agricultural_products?.slice(0, 3).map((product, index) => (
                <span key={index} className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">
                  {product}
                </span>
              ))}
              {state.agricultural_products?.length > 3 && (
                <span className="text-xs text-gray-500">+{state.agricultural_products.length - 3} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 3D India Map Component (with error handling)
const IndiaState = ({ position, name, color, onClick, hovered, onHover, onUnhover }) => {
  return (
    <mesh
      position={position}
      onClick={onClick}
      onPointerOver={onUnhover}
      onPointerOut={onHover}
      scale={hovered ? [1.1, 1.1, 1.1] : [1, 1, 1]}
    >
      <boxGeometry args={[0.8, 0.6, 0.1]} />
      <meshStandardMaterial 
        color={hovered ? '#f59e0b' : color} 
        transparent 
        opacity={0.8}
        roughness={0.3}
        metalness={0.2}
      />
      {hovered && (
        <Html>
          <div className="bg-black text-white px-2 py-1 rounded text-sm pointer-events-none">
            {name}
          </div>
        </Html>
      )}
    </mesh>
  );
};

const IndiaMap3D = ({ onStateClick }) => {
  const [hoveredState, setHoveredState] = useState(null);
  const [states, setStates] = useState({});

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await axios.get(`${API}/states`);
        setStates(response.data);
      } catch (error) {
        console.error('Error fetching states:', error);
      }
    };
    fetchStates();
  }, []);

  const stateColors = {
    'Punjab': '#22c55e',
    'Maharashtra': '#3b82f6', 
    'Kerala': '#10b981',
    'Tamil Nadu': '#f59e0b',
    'Karnataka': '#8b5cf6',
    'West Bengal': '#ef4444',
    'Gujarat': '#06b6d4',
    'Rajasthan': '#f97316'
  };

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} />
      
      {Object.entries(states).map(([key, state]) => (
        <IndiaState
          key={key}
          position={[state.coordinates.x * 3, state.coordinates.y * 3, state.coordinates.z]}
          name={state.name}
          color={stateColors[state.name] || '#64748b'}
          onClick={() => onStateClick(key, state)}
          hovered={hoveredState === key}
          onHover={() => setHoveredState(key)}
          onUnhover={() => setHoveredState(null)}
        />
      ))}

      <Text
        position={[0, -3, 0]}
        fontSize={0.5}
        color="#374151"
        anchorX="center"
        anchorY="middle"
      >
        Click on any state to explore products
      </Text>
    </>
  );
};

// Product Card Component
const ProductCard = ({ product, onAddToCart }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAddToCart = async () => {
    setIsLoading(true);
    try {
      await onAddToCart(product);
      toast.success(`${product.name} added to cart!`);
    } catch (error) {
      toast.error('Failed to add to cart');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-xl">
      <div className="relative h-48 overflow-hidden">
        <img 
          src={product.image_url} 
          alt={product.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3 bg-emerald-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
          {product.category}
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{product.name}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>
        
        <div className="flex items-center justify-between mb-4">
          <div className="text-2xl font-bold text-emerald-600">
            ₹{product.price}<span className="text-sm font-normal text-gray-500">/{product.unit}</span>
          </div>
          <div className="flex items-center text-yellow-500">
            <Star className="w-4 h-4 fill-current" />
            <span className="ml-1 text-sm text-gray-600">4.8</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            <MapPin className="w-4 h-4 inline mr-1" />
            By {product.farmer_name}
          </div>
          <div className="text-sm text-gray-500">
            <Package className="w-4 h-4 inline mr-1" />
            {product.quantity_available} {product.unit} available
          </div>
        </div>
        
        <button
          onClick={handleAddToCart}
          disabled={isLoading}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Adding...' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
};

// Shopping Cart Component
const ShoppingCart = ({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem }) => {
  const totalAmount = cartItems.reduce((sum, item) => sum + item.total_price, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.cart_item.quantity, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">Shopping Cart</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-gray-600 mt-2">{totalItems} items in your cart</p>
        </div>
        
        <div className="overflow-y-auto max-h-96 p-6">
          {cartItems.length === 0 ? (
            <div className="text-center py-8">
              <CartIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div key={item.cart_item.id} className="flex items-center space-x-4 bg-gray-50 rounded-xl p-4">
                  <img 
                    src={item.product.image_url} 
                    alt={item.product.name}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{item.product.name}</h3>
                    <p className="text-gray-600 text-sm">{item.product.farmer_name}</p>
                    <p className="text-emerald-600 font-semibold">₹{item.product.price}/{item.product.unit}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => onUpdateQuantity(item.product.id, item.cart_item.quantity - 1)}
                      className="p-1 hover:bg-gray-200 rounded-full"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-semibold">{item.cart_item.quantity}</span>
                    <button 
                      onClick={() => onUpdateQuantity(item.product.id, item.cart_item.quantity + 1)}
                      className="p-1 hover:bg-gray-200 rounded-full"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-800">₹{item.total_price.toFixed(2)}</p>
                    <button 
                      onClick={() => onRemoveItem(item.product.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xl font-semibold text-gray-800">Total: ₹{totalAmount.toFixed(2)}</span>
            </div>
            <button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200">
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [selectedState, setSelectedState] = useState(null);
  const [products, setProducts] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [use3DMap, setUse3DMap] = useState(true);

  // Fetch cart items
  const fetchCartItems = async () => {
    try {
      const response = await axios.get(`${API}/cart/${SESSION_ID}`);
      setCartItems(response.data);
    } catch (error) {
      console.error('Error fetching cart:', error);
    }
  };

  // Fetch products for selected state
  const fetchProducts = async (stateKey) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/products?state=${stateKey}`);
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle state selection
  const handleStateClick = (stateKey, stateData) => {
    setSelectedState({ key: stateKey, ...stateData });
    fetchProducts(stateKey);
  };

  // Add product to cart
  const handleAddToCart = async (product) => {
    try {
      await axios.post(`${API}/cart/add`, {
        product_id: product.id,
        quantity: 1,
        user_session: SESSION_ID
      });
      fetchCartItems();
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error;
    }
  };

  // Update cart quantity
  const handleUpdateQuantity = async (productId, newQuantity) => {
    try {
      await axios.put(`${API}/cart/${SESSION_ID}/${productId}?quantity=${newQuantity}`);
      fetchCartItems();
    } catch (error) {
      console.error('Error updating cart:', error);
      toast.error('Failed to update cart');
    }
  };

  // Remove item from cart
  const handleRemoveItem = async (productId) => {
    try {
      await axios.delete(`${API}/cart/${SESSION_ID}/${productId}`);
      fetchCartItems();
      toast.success('Item removed from cart');
    } catch (error) {
      console.error('Error removing item:', error);
      toast.error('Failed to remove item');
    }
  };

  // Load cart items on component mount
  useEffect(() => {
    fetchCartItems();
  }, []);

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.cart_item.quantity, 0);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
        <Toaster position="top-right" />
        
        {/* Header */}
        <header className="bg-white shadow-lg backdrop-blur-sm bg-opacity-95 sticky top-0 z-40">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">AgriMap Market</h1>
                  <p className="text-gray-600 text-sm">Farm Fresh, Locally Sourced</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-2xl transition-colors duration-200 flex items-center space-x-2"
              >
                <CartIcon className="w-5 h-5" />
                <span>Cart</span>
                {totalCartItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                    {totalCartItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={
            <div className="container mx-auto px-6 py-8">
              {!selectedState ? (
                <>
                  {/* Hero Section */}
                  <div className="text-center mb-12">
                    <h2 className="text-5xl font-bold text-gray-800 mb-6">
                      Explore India's Agricultural Treasures
                    </h2>
                    <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                      Discover authentic, farm-fresh products from every corner of India. 
                      Click on any state below to explore their agricultural specialties.
                    </p>
                  </div>

                  {/* 3D/2D Map */}
                  <div className="bg-white rounded-3xl shadow-2xl p-8 mb-12" style={{ height: '600px' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-gray-800">Interactive Map of India</h3>
                      <button
                        onClick={() => setUse3DMap(!use3DMap)}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm transition-colors duration-200"
                      >
                        Switch to {use3DMap ? '2D' : '3D'} View
                      </button>
                    </div>
                    <div style={{ height: 'calc(100% - 80px)' }}>
                      {use3DMap ? (
                        <Suspense fallback={<IndiaMap2D onStateClick={handleStateClick} />}>
                          <Canvas 
                            camera={{ position: [0, 0, 8], fov: 75 }}
                            onCreated={({ gl }) => {
                              // Handle WebGL context creation errors
                              gl.domElement.addEventListener('webglcontextlost', (e) => {
                                console.warn('WebGL context lost, switching to 2D map');
                                setUse3DMap(false);
                              });
                            }}
                          >
                            <IndiaMap3D onStateClick={handleStateClick} />
                            <OrbitControls 
                              enableZoom={true} 
                              enablePan={true} 
                              enableRotate={true}
                              maxDistance={15}
                              minDistance={5}
                            />
                          </Canvas>
                        </Suspense>
                      ) : (
                        <IndiaMap2D onStateClick={handleStateClick} />
                      )}
                    </div>
                  </div>

                  {/* Features Section */}
                  <div className="grid md:grid-cols-3 gap-8">
                    <div className="text-center p-6 bg-white rounded-2xl shadow-lg">
                      <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8 text-emerald-600" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Regional Specialties</h3>
                      <p className="text-gray-600">Discover unique agricultural products from every state of India</p>
                    </div>
                    <div className="text-center p-6 bg-white rounded-2xl shadow-lg">
                      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Direct from Farmers</h3>
                      <p className="text-gray-600">Fresh products delivered straight from local farmers to your doorstep</p>
                    </div>
                    <div className="text-center p-6 bg-white rounded-2xl shadow-lg">
                      <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Star className="w-8 h-8 text-purple-600" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">Premium Quality</h3>
                      <p className="text-gray-600">Handpicked products ensuring the highest quality and freshness</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* State Header */}
                  <div className="bg-white rounded-3xl shadow-xl p-8 mb-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-4xl font-bold text-gray-800 mb-2">{selectedState.name}</h2>
                        <p className="text-gray-600 mb-4">{selectedState.description}</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedState.agricultural_products?.map((product, index) => (
                            <span key={index} className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
                              {product}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedState(null)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 py-3 rounded-2xl transition-colors duration-200"
                      >
                        ← Back to Map
                      </button>
                    </div>
                  </div>

                  {/* Products Grid */}
                  {isLoading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                      <p className="mt-4 text-gray-600">Loading products...</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {products.map((product) => (
                        <ProductCard 
                          key={product.id} 
                          product={product} 
                          onAddToCart={handleAddToCart}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          } />
        </Routes>

        {/* Shopping Cart Modal */}
        <ShoppingCart 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cartItems={cartItems}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;