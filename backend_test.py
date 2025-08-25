import requests
import sys
import json
from datetime import datetime

class AgriMapAPITester:
    def __init__(self, base_url="https://mapfresh-market.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_id = f"test_session_{datetime.now().strftime('%H%M%S')}"
        self.tests_run = 0
        self.tests_passed = 0
        self.product_ids = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list) and len(response_data) > 0:
                        print(f"   Response: {len(response_data)} items returned")
                    elif isinstance(response_data, dict):
                        print(f"   Response keys: {list(response_data.keys())}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root API Endpoint", "GET", "", 200)

    def test_get_states(self):
        """Test getting all states"""
        success, response = self.run_test("Get All States", "GET", "states", 200)
        if success and response:
            expected_states = ['punjab', 'maharashtra', 'kerala', 'tamil_nadu', 'karnataka', 'west_bengal', 'gujarat', 'rajasthan']
            actual_states = list(response.keys())
            if all(state in actual_states for state in expected_states):
                print(f"   ✅ All 8 expected states found: {actual_states}")
            else:
                print(f"   ⚠️  Expected states: {expected_states}")
                print(f"   ⚠️  Actual states: {actual_states}")
        return success, response

    def test_get_specific_state(self, state_name="punjab"):
        """Test getting specific state info"""
        success, response = self.run_test(f"Get {state_name.title()} State Info", "GET", f"states/{state_name}", 200)
        if success and response:
            required_fields = ['name', 'agricultural_products', 'description', 'coordinates']
            if all(field in response for field in required_fields):
                print(f"   ✅ All required fields present: {required_fields}")
            else:
                print(f"   ⚠️  Missing fields in response")
        return success, response

    def test_get_all_products(self):
        """Test getting all products"""
        success, response = self.run_test("Get All Products", "GET", "products", 200)
        if success and response:
            self.product_ids = [product['id'] for product in response if 'id' in product]
            print(f"   ✅ Found {len(response)} products, collected {len(self.product_ids)} product IDs")
        return success, response

    def test_get_products_by_state(self, state="punjab"):
        """Test getting products filtered by state"""
        success, response = self.run_test(f"Get {state.title()} Products", "GET", "products", 200, params={"state": state})
        if success and response:
            # Verify all products belong to the requested state
            state_products = [p for p in response if p.get('state') == state]
            if len(state_products) == len(response):
                print(f"   ✅ All {len(response)} products belong to {state}")
            else:
                print(f"   ⚠️  Some products don't belong to {state}")
        return success, response

    def test_get_specific_product(self):
        """Test getting a specific product by ID"""
        if not self.product_ids:
            print("❌ No product IDs available for testing")
            return False, {}
        
        product_id = self.product_ids[0]
        return self.run_test("Get Specific Product", "GET", f"products/{product_id}", 200)

    def test_add_to_cart(self):
        """Test adding product to cart"""
        if not self.product_ids:
            print("❌ No product IDs available for cart testing")
            return False, {}
        
        product_id = self.product_ids[0]
        cart_data = {
            "product_id": product_id,
            "quantity": 2,
            "user_session": self.session_id
        }
        return self.run_test("Add Product to Cart", "POST", "cart/add", 200, data=cart_data)

    def test_get_cart(self):
        """Test getting cart contents"""
        return self.run_test("Get Cart Contents", "GET", f"cart/{self.session_id}", 200)

    def test_update_cart_quantity(self):
        """Test updating cart item quantity"""
        if not self.product_ids:
            print("❌ No product IDs available for cart update testing")
            return False, {}
        
        product_id = self.product_ids[0]
        return self.run_test("Update Cart Quantity", "PUT", f"cart/{self.session_id}/{product_id}", 200, params={"quantity": 3})

    def test_remove_from_cart(self):
        """Test removing item from cart"""
        if not self.product_ids:
            print("❌ No product IDs available for cart removal testing")
            return False, {}
        
        product_id = self.product_ids[0]
        return self.run_test("Remove from Cart", "DELETE", f"cart/{self.session_id}/{product_id}", 200)

    def test_checkout_create_session(self):
        """Test creating checkout session (Stripe integration)"""
        # First add a product to cart
        if not self.product_ids:
            print("❌ No product IDs available for checkout testing")
            return False, {}
        
        # Add product to cart first
        product_id = self.product_ids[0]
        cart_data = {
            "product_id": product_id,
            "quantity": 1,
            "user_session": self.session_id
        }
        self.run_test("Add Product for Checkout", "POST", "cart/add", 200, data=cart_data)
        
        # Now test checkout session creation
        checkout_data = {
            "origin_url": "https://mapfresh-market.preview.emergentagent.com",
            "user_session": self.session_id
        }
        success, response = self.run_test("Create Checkout Session", "POST", "checkout/create-session", 200, data=checkout_data)
        
        if success and response:
            if 'url' in response and 'session_id' in response:
                print(f"   ✅ Checkout session created with URL and session_id")
                return success, response
            else:
                print(f"   ⚠️  Missing 'url' or 'session_id' in response")
        
        return success, response

    def test_checkout_status_invalid(self):
        """Test checkout status with invalid session ID"""
        return self.run_test("Get Invalid Checkout Status", "GET", "checkout/status/invalid_session_id", 404)

    def test_invalid_endpoints(self):
        """Test error handling for invalid endpoints"""
        print("\n🔍 Testing Error Handling...")
        
        # Test invalid state
        self.run_test("Invalid State", "GET", "states/invalid_state", 404)
        
        # Test invalid product ID
        self.run_test("Invalid Product ID", "GET", "products/invalid_id", 404)
        
        # Test adding invalid product to cart
        invalid_cart_data = {
            "product_id": "invalid_id",
            "quantity": 1,
            "user_session": self.session_id
        }
        self.run_test("Add Invalid Product to Cart", "POST", "cart/add", 404, data=invalid_cart_data)

def main():
    print("🚀 Starting AgriMap Market API Tests")
    print("=" * 50)
    
    tester = AgriMapAPITester()
    
    # Test sequence
    test_sequence = [
        ("Root Endpoint", tester.test_root_endpoint),
        ("States Data", tester.test_get_states),
        ("Specific State", lambda: tester.test_get_specific_state("punjab")),
        ("All Products", tester.test_get_all_products),
        ("Punjab Products", lambda: tester.test_get_products_by_state("punjab")),
        ("Kerala Products", lambda: tester.test_get_products_by_state("kerala")),
        ("Specific Product", tester.test_get_specific_product),
        ("Add to Cart", tester.test_add_to_cart),
        ("Get Cart", tester.test_get_cart),
        ("Update Cart", tester.test_update_cart_quantity),
        ("Remove from Cart", tester.test_remove_from_cart),
        ("Error Handling", tester.test_invalid_endpoints),
    ]
    
    for test_name, test_func in test_sequence:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend API is working correctly.")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())