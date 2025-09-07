#!/usr/bin/env node
/**
 * Test script for authentication flow
 * Epic 0: Developer Experience & Testing Infrastructure
 */

const BASE_URL = 'http://localhost:5990';

async function testAuthFlow() {
  console.log('🧪 Testing Authentication Flow...\n');
  
  // Test data
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';
  const testName = 'Test User';
  
  console.log('📝 Test User:', { email: testEmail, name: testName });
  console.log('');
  
  // 1. Test Signup
  console.log('1️⃣  Testing Signup...');
  try {
    const signupResponse = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: testName,
      }),
    });
    
    let signupData;
    try {
      signupData = await signupResponse.json();
    } catch (e) {
      console.log('❌ Response is not JSON. Status:', signupResponse.status);
      const text = await signupResponse.text();
      console.log('   Response text:', text.substring(0, 200));
      return;
    }
    
    if (signupResponse.ok) {
      console.log('✅ Signup successful!');
      console.log('   User ID:', signupData.user.id);
      console.log('   Email:', signupData.user.email);
      console.log('   Token received:', !!signupData.token);
      console.log('   Email verification sent:', signupData.emailVerificationSent);
    } else {
      console.log('❌ Signup failed:', signupData.error);
      return;
    }
    
    // Store token for later tests
    const token = signupData.token;
    
    console.log('');
    
    // 2. Test Login
    console.log('2️⃣  Testing Login...');
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    
    const loginData = await loginResponse.json();
    
    if (loginResponse.ok) {
      console.log('✅ Login successful!');
      console.log('   Token received:', !!loginData.token);
    } else {
      console.log('⚠️  Login failed (expected - email not verified):', loginData.error);
    }
    
    console.log('');
    
    // 3. Test Session Check
    console.log('3️⃣  Testing Session Check...');
    const sessionResponse = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const sessionData = await sessionResponse.json();
    
    if (sessionResponse.ok && sessionData.authenticated) {
      console.log('✅ Session valid!');
      console.log('   User:', sessionData.user.email);
    } else {
      console.log('❌ Session check failed');
    }
    
    console.log('');
    
    // 4. Test /embed endpoint without auth
    console.log('4️⃣  Testing /embed without auth...');
    const embedNoAuthResponse = await fetch(`${BASE_URL}/embed`, {
      redirect: 'manual',
    });
    
    if (embedNoAuthResponse.status === 302) {
      const location = embedNoAuthResponse.headers.get('location');
      console.log('✅ Correctly redirected to:', location);
    } else {
      console.log('❌ Expected redirect but got:', embedNoAuthResponse.status);
    }
    
    console.log('');
    
    // 5. Test /embed with valid token (would need cookie/header)
    console.log('5️⃣  Testing /embed requires authentication...');
    const embedAuthResponse = await fetch(`${BASE_URL}/embed`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      redirect: 'manual',
    });
    
    if (embedAuthResponse.ok) {
      console.log('✅ Authenticated access works!');
      const html = await embedAuthResponse.text();
      console.log('   HTML received:', html.includes('main-content'));
    } else if (embedAuthResponse.status === 302) {
      console.log('⚠️  Still redirected despite token (cookie may be required)');
    } else {
      console.log('❌ Authenticated access failed:', embedAuthResponse.status);
    }
    
    console.log('');
    
    // 6. Test Logout
    console.log('6️⃣  Testing Logout...');
    const logoutResponse = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    const logoutData = await logoutResponse.json();
    
    if (logoutResponse.ok) {
      console.log('✅ Logout successful!');
      console.log('   Message:', logoutData.message);
    } else {
      console.log('❌ Logout failed');
    }
    
    console.log('');
    console.log('🎉 Authentication flow test complete!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('   Make sure the dev server is running on port 5990');
  }
}

// Run the test
testAuthFlow();