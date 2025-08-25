import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Html } from '@react-three/drei';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import axios from 'axios';
import './App.css';

// Import icons from lucide-react
import { ShoppingCart as CartIcon, X, Plus, Minus, Package, MapPin, Star, CreditCard, ArrowLeft, CheckCircle, AlertCircle, User, LogOut, LogIn } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Configure axios to include credentials
axios.defaults.withCredentials = true;

// Generate a simple session ID for cart management
const SESSION_ID = 'session_' + Math.random().toString(36).substr(2, 9);

// Auth Context
const AuthContext = React.createContext();

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
      } catch (error) {
        console.log('Not authenticated');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Handle authentication from URL fragment
  useEffect(() => {
    const handleAuthCallback = async () => {
      const fragment = window.location.hash;
      console.log('URL fragment:', fragment);
      
      if (fragment.includes('session_id=')) {
        const sessionId = fragment.split('session_id=')[1].split('&')[0]; // Handle multiple params
        console.log('Extracted session ID:', sessionId);
        
        if (sessionId && sessionId.trim()) {
          try {
            console.log('Attempting authentication with session ID:', sessionId);
            const response = await axios.post(`${API}/auth/login`, {
              session_id: sessionId.trim()
            });
            
            console.log('Authentication response:', response.data);
            setUser(response.data.user);
            toast.success(`Welcome ${response.data.user.name}!`);
            
            // Clear the URL fragment
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (error) {
            console.error('Authentication error:', error.response?.data || error.message);
            toast.error(`Authentication failed: ${error.response?.data?.detail || 'Unknown error'}`);
            setLoading(false);
          }
        } else {
          console.error('Invalid session ID extracted');
          toast.error('Invalid authentication response');
          setLoading(false);
        }
      } else {
        console.log('No session_id found in URL fragment');
        setLoading(false);
      }
    };

    // Only run this on mount and when URL changes
    if (loading) {
      handleAuthCallback();
    }
  }, [loading]);

  const login = () => {
    const redirectUrl = encodeURIComponent(window.location.origin + '/profile');
    window.location.href = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      setUser(null);
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Use Auth Hook
const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Utility function to get URL parameters
function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(window.location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// User Profile Component
const UserProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check for authentication callback first
    const fragment = window.location.hash;
    if (fragment.includes('session_id=')) {
      // This will be handled by AuthProvider, just wait
      return;
    }
    
    // If no auth callback and still loading, wait
    if (loading) {
      return;
    }
    
    // If not loading and no user, redirect to home
    if (!loading && !user) {
      console.log('No user found, redirecting to home');
      navigate('/');
    }
  }, [user, loading, navigate]);

  // Show loading state while processing authentication
  if (loading || window.location.hash.includes('session_id=')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Setting up your account...</h2>
          <p className="text-gray-600">Please wait while we complete your authentication.</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Failed</h2>
          <p className="text-gray-600 mb-6">Unable to complete authentication. Please try again.</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl transition-colors duration-200"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
          {user.picture ? (
            <img 
              src={user.picture} 
              alt={user.name}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="w-10 h-10 text-white" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome, {user.name}!</h2>
        <p className="text-gray-600 mb-6">{user.email}</p>
        <button 
          onClick={() => navigate('/')}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl transition-colors duration-200 mb-4"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
};

// 2D Fallback Map Component with Better Design
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
    <div className="relative w-full h-full bg-gradient-to-br from-emerald-50 to-blue-50 rounded-3xl p-8">
      {/* India Map Layout */}
      <div className="relative w-full h-full">
        {/* North India */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-6">
          {/* Punjab */}
          {states.punjab && (
            <div
              onClick={() => onStateClick('punjab', states.punjab)}
              className="state-card cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${stateColors['Punjab']}, ${stateColors['Punjab']}dd)`
              }}
            >
              <h3 className="text-white font-bold text-lg">{states.punjab.name}</h3>
              <div className="flex flex-wrap gap-1 mt-2">
                {states.punjab.agricultural_products?.slice(0, 2).map((product, index) => (
                  <span key={index} className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-xs">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Rajasthan */}
          {states.rajasthan && (
            <div
              onClick={() => onStateClick('rajasthan', states.rajasthan)}
              className="state-card cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${stateColors['Rajasthan']}, ${stateColors['Rajasthan']}dd)`
              }}
            >
              <h3 className="text-white font-bold text-lg">{states.rajasthan.name}</h3>
              <div className="flex flex-wrap gap-1 mt-2">
                {states.rajasthan.agricultural_products?.slice(0, 2).map((product, index) => (
                  <span key={index} className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-xs">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* West India */}
        <div className="absolute top-1/3 left-8">
          {states.gujarat && (
            <div
              onClick={() => onStateClick('gujarat', states.gujarat)}
              className="state-card cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${stateColors['Gujarat']}, ${stateColors['Gujarat']}dd)`
              }}
            >
              <h3 className="text-white font-bold text-lg">{states.gujarat.name}</h3>
              <div className="flex flex-wrap gap-1 mt-2">
                {states.gujarat.agricultural_products?.slice(0, 2).map((product, index) => (
                  <span key={index} className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-xs">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Central India */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          {states.maharashtra && (
            <div
              onClick={() => onStateClick('maharashtra', states.maharashtra)}
              className="state-card cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${stateColors['Maharashtra']}, ${stateColors['Maharashtra']}dd)`
              }}
            >
              <h3 className="text-white font-bold text-lg">{states.maharashtra.name}</h3>
              <div className="flex flex-wrap gap-1 mt-2">
                {states.maharashtra.agricultural_products?.slice(0, 2).map((product, index) => (
                  <span key={index} className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-xs">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* East India */}
        <div className="absolute top-1/3 right-8">
          {states.west_bengal && (
            <div
              onClick={() => onStateClick('west_bengal', states.west_bengal)}
              className="state-card cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${stateColors['West Bengal']}, ${stateColors['West Bengal']}dd)`
              }}
            >
              <h3 className="text-white font-bold text-lg">{states.west_bengal.name}</h3>
              <div className="flex flex-wrap gap-1 mt-2">
                {states.west_bengal.agricultural_products?.slice(0, 2).map((product, index) => (
                  <span key={index} className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-xs">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* South India */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-6">
          {/* Karnataka */}
          {states.karnataka && (
            <div
              onClick={() => onStateClick('karnataka', states.karnataka)}
              className="state-card cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${stateColors['Karnataka']}, ${stateColors['Karnataka']}dd)`
              }}
            >
              <h3 className="text-white font-bold text-lg">{states.karnataka.name}</h3>
              <div className="flex flex-wrap gap-1 mt-2">
                {states.karnataka.agricultural_products?.slice(0, 2).map((product, index) => (
                  <span key={index} className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-xs">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Tamil Nadu */}
          {states.tamil_nadu && (
            <div
              onClick={() => onStateClick('tamil_nadu', states.tamil_nadu)}
              className="state-card cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${stateColors['Tamil Nadu']}, ${stateColors['Tamil Nadu']}dd)`
              }}
            >
              <h3 className="text-white font-bold text-lg">{states.tamil_nadu.name}</h3>
              <div className="flex flex-wrap gap-1 mt-2">
                {states.tamil_nadu.agricultural_products?.slice(0, 2).map((product, index) => (
                  <span key={index} className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-xs">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Kerala */}
          {states.kerala && (
            <div
              onClick={() => onStateClick('kerala', states.kerala)}
              className="state-card cursor-pointer transform transition-all duration-300 hover:scale-110 hover:shadow-2xl"
              style={{
                background: `linear-gradient(135deg, ${stateColors['Kerala']}, ${stateColors['Kerala']}dd)`
              }}
            >
              <h3 className="text-white font-bold text-lg">{states.kerala.name}</h3>
              <div className="flex flex-wrap gap-1 mt-2">
                {states.kerala.agricultural_products?.slice(0, 2).map((product, index) => (
                  <span key={index} className="bg-white bg-opacity-20 text-white px-2 py-1 rounded-full text-xs">
                    {product}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced 3D India Map Component
const IndiaState = ({ position, name, color, onClick, hovered, onHover, onUnhover }) => {
  return (
    <mesh
      position={position}
      onClick={onClick}
      onPointerOver={onHover}
      onPointerOut={onUnhover}
      scale={hovered ? [1.2, 1.2, 1.2] : [1, 1, 1]}
    >
      <boxGeometry args={[0.6, 0.4, 0.2]} />
      <meshStandardMaterial 
        color={hovered ? '#fbbf24' : color} 
        transparent 
        opacity={0.9}
        roughness={0.2}
        metalness={0.1}
      />
      {hovered && (
        <Html>
          <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm pointer-events-none shadow-lg">
            <div className="font-semibold">{name}</div>
            <div className="text-xs opacity-75">Click to explore</div>
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
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} />
      <pointLight position={[-10, -10, -5]} intensity={0.8} />
      <spotLight position={[0, 10, 0]} intensity={0.5} angle={0.3} />
      
      {Object.entries(states).map(([key, state]) => (
        <IndiaState
          key={key}
          position={[state.coordinates.x, state.coordinates.y, state.coordinates.z]}
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
        fontSize={0.4}
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
const ShoppingCart = ({ isOpen, onClose, cartItems, onUpdateQuantity, onRemoveItem, onCheckout }) => {
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
            <button 
              onClick={onCheckout}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors duration-200 flex items-center justify-center space-x-2"
            >
              <CreditCard className="w-5 h-5" />
              <span>Proceed to Checkout</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Success/Cancel Pages
const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [paymentStatus, setPaymentStatus] = useState('checking');
  const [paymentDetails, setPaymentDetails] = useState(null);

  useEffect(() => {
    const sessionId = getUrlParameter('session_id');
    if (sessionId) {
      pollPaymentStatus(sessionId);
    } else {
      setPaymentStatus('error');
    }
  }, []);

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      setPaymentStatus('timeout');
      return;
    }

    try {
      const response = await axios.get(`${API}/checkout/status/${sessionId}`);
      const data = response.data;
      
      if (data.payment_status === 'paid') {
        setPaymentStatus('success');
        setPaymentDetails(data);
        return;
      } else if (data.status === 'expired') {
        setPaymentStatus('expired');
        return;
      }

      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (error) {
      console.error('Error checking payment status:', error);
      setPaymentStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
        {paymentStatus === 'checking' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Processing Payment...</h2>
            <p className="text-gray-600">Please wait while we confirm your payment.</p>
          </>
        )}
        
        {paymentStatus === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h2>
            <p className="text-gray-600 mb-4">Thank you for your purchase from AgriMap Market.</p>
            {paymentDetails && (
              <div className="bg-emerald-50 p-4 rounded-xl mb-4">
                <p className="text-sm text-emerald-700">
                  Amount: ₹{paymentDetails.inr_amount} (${(paymentDetails.amount_total / 100).toFixed(2)})
                </p>
              </div>
            )}
            <button 
              onClick={() => navigate('/')}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl transition-colors duration-200"
            >
              Continue Shopping
            </button>
          </>
        )}
        
        {(paymentStatus === 'error' || paymentStatus === 'timeout' || paymentStatus === 'expired') && (
          <>
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Issue</h2>
            <p className="text-gray-600 mb-4">
              {paymentStatus === 'timeout' && "Payment verification timed out. Please check your email for confirmation."}
              {paymentStatus === 'expired' && "Payment session expired. Please try again."}
              {paymentStatus === 'error' && "There was an error processing your payment."}
            </p>
            <button 
              onClick={() => navigate('/')}
              className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl transition-colors duration-200"
            >
              Back to Shop
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
        <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Payment Cancelled</h2>
        <p className="text-gray-600 mb-6">Your payment was cancelled. You can try again anytime.</p>
        <button 
          onClick={() => navigate('/')}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl transition-colors duration-200"
        >
          Back to Shop
        </button>
      </div>
    </div>
  );
};

// Main App Component
function AppContent() {
  const { user, login, logout, loading } = useAuth();
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

  // Handle checkout
  const handleCheckout = async () => {
    try {
      const originUrl = window.location.origin;
      const response = await axios.post(`${API}/checkout/create-session`, {
        origin_url: originUrl,
        user_session: SESSION_ID
      });
      
      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        toast.error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to initiate checkout');
    }
  };

  // Load cart items on component mount
  useEffect(() => {
    fetchCartItems();
  }, [user]);

  const totalCartItems = cartItems.reduce((sum, item) => sum + item.cart_item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
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
            
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {user.picture ? (
                      <img 
                        src={user.picture} 
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-gray-600" />
                    )}
                    <span className="text-sm text-gray-700">Hi, {user.name.split(' ')[0]}</span>
                  </div>
                  <button 
                    onClick={logout}
                    className="text-gray-600 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100 transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={login}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors duration-200 flex items-center space-x-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
              
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
        </div>
      </header>

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
                Click on any state to explore their agricultural specialties.
              </p>
            </div>

            {/* Enhanced Map */}
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
                  <CreditCard className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Secure Payments</h3>
                <p className="text-gray-600">Safe and secure checkout powered by Stripe payment processing</p>
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
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-6 py-3 rounded-2xl transition-colors duration-200 flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Map</span>
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

      {/* Shopping Cart Modal */}
      <ShoppingCart 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/success" element={<PaymentSuccess />} />
          <Route path="/cancel" element={<PaymentCancel />} />
          <Route path="/" element={<AppContent />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;