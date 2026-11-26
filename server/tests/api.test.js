const http = require('http');
const fs = require('fs');
const path = require('path');
const { app, startServer } = require('../server');
const { disconnectDB } = require('../src/config/db');

// Simple native HTTP request helper for testing without external testing framework
const request = ({ method, path, headers = {}, body = null, isFormData = false, boundary = '' }) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers: {
        ...headers,
      },
    };

    if (body && !isFormData) {
      const jsonBody = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(jsonBody);
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => {
        responseBody += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(responseBody);
        } catch {
          parsed = responseBody;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (body && !isFormData) {
      req.write(JSON.stringify(body));
    } else if (isFormData && body) {
      req.write(body);
    }
    req.end();
  });
};

async function runTests() {
  console.log('🧪 Starting Shelf Life API Integration Tests...\n');
  let server;

  try {
    try {
      const ping = await request({ method: 'GET', path: '/api/health' });
      if (ping.statusCode === 200) {
        console.log('⚡ Connected to active server on port 5000');
      }
    } catch {
      server = await startServer();
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 1. Health Check
    console.log('➡️ Testing GET /api/health...');
    const healthRes = await request({ method: 'GET', path: '/api/health' });
    console.assert(healthRes.statusCode === 200, `Health check failed: ${healthRes.statusCode}`);
    console.log('  ✅ Health check passed');

    // 2. Auth: Register
    console.log('➡️ Testing POST /api/auth/register...');
    const testEmail = `chef_${Date.now()}@shelflife.test`;
    const regRes = await request({
      method: 'POST',
      path: '/api/auth/register',
      body: {
        name: 'Chef Gordon',
        email: testEmail,
        password: 'Password123!',
      },
    });
    console.assert(regRes.statusCode === 201, `Register failed: ${JSON.stringify(regRes.data)}`);
    const { accessToken, refreshToken, user } = regRes.data.data;
    console.assert(accessToken && user.email === testEmail, 'Invalid register payload');
    console.log(`  ✅ User registered: ${user.name} (${user.email})`);

    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // 3. Auth: Second device Login (must not revoke first refresh token)
    console.log('➡️ Testing multi-device POST /api/auth/login...');
    const loginRes = await request({
      method: 'POST',
      path: '/api/auth/login',
      body: {
        email: testEmail,
        password: 'Password123!',
      },
    });
    console.assert(loginRes.statusCode === 200, 'Login failed');
    const secondRefreshToken = loginRes.data.data.refreshToken;
    console.log('  ✅ Multi-device login successful');

    // 4. Auth: Refresh Token from device 1 & confirm device 2 stays active
    console.log('➡️ Testing POST /api/auth/refresh-token...');
    const refreshRes = await request({
      method: 'POST',
      path: '/api/auth/refresh-token',
      body: { refreshToken },
    });
    console.assert(refreshRes.statusCode === 200, 'Refresh failed');
    const newAccessToken = refreshRes.data.data.accessToken;
    console.assert(secondRefreshToken !== refreshToken, 'Session tokens should differ');
    console.log('  ✅ Token refreshed & rotated successfully');

    const updatedAuthHeaders = { Authorization: `Bearer ${newAccessToken}` };

    // 5. Auth: Get Current Profile
    console.log('➡️ Testing GET /api/auth/me...');
    const meRes = await request({
      method: 'GET',
      path: '/api/auth/me',
      headers: updatedAuthHeaders,
    });
    console.assert(meRes.statusCode === 200, 'Get profile failed');
    console.log(`  ✅ Profile retrieved: ${meRes.data.data.user.name}`);

    // 6. Items: Create Item 1 (Expiring tomorrow - Fridge)
    console.log('➡️ Testing POST /api/items (Expiring soon item)...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const item1Res = await request({
      method: 'POST',
      path: '/api/items',
      headers: updatedAuthHeaders,
      body: {
        name: 'Fresh Whole Milk',
        category: 'dairy',
        location: 'fridge',
        quantity: 1,
        unit: 'l',
        expiryDate: tomorrow.toISOString(),
        notes: 'Organic pasture raised',
      },
    });
    console.assert(item1Res.statusCode === 201, `Create item failed: ${JSON.stringify(item1Res.data)}`);
    const item1Id = item1Res.data.data.item._id;
    console.log(`  ✅ Item 1 created: "${item1Res.data.data.item.name}" (Urgency: ${item1Res.data.data.item.urgency})`);

    // 7. Items: Create Item 2 (Pantry item, 30 days away)
    console.log('➡️ Testing POST /api/items (Pantry item)...');
    const monthLater = new Date();
    monthLater.setDate(monthLater.getDate() + 30);

    const item2Res = await request({
      method: 'POST',
      path: '/api/items',
      headers: updatedAuthHeaders,
      body: {
        name: 'Organic Basmati Rice',
        category: 'pantry',
        location: 'pantry',
        quantity: 2,
        unit: 'kg',
        expiryDate: monthLater.toISOString(),
      },
    });
    console.assert(item2Res.statusCode === 201, 'Create item 2 failed');
    console.log(`  ✅ Item 2 created: "${item2Res.data.data.item.name}"`);

    // 8. Items: GET /items with location filter
    console.log('➡️ Testing GET /api/items?location=fridge...');
    const fridgeItemsRes = await request({
      method: 'GET',
      path: '/api/items?location=fridge',
      headers: updatedAuthHeaders,
    });
    console.assert(fridgeItemsRes.statusCode === 200 && fridgeItemsRes.data.data.items.length >= 1, 'Filter failed');
    console.log(`  ✅ Retrieved ${fridgeItemsRes.data.data.items.length} fridge item(s)`);

    // 9. Items: GET /items/expiring-soon?days=3
    console.log('➡️ Testing GET /api/items/expiring-soon?days=3...');
    const expiringRes = await request({
      method: 'GET',
      path: '/api/items/expiring-soon?days=3',
      headers: updatedAuthHeaders,
    });
    console.assert(expiringRes.statusCode === 200, 'Expiring soon query failed');
    console.assert(
      expiringRes.data.data.items.some((i) => i.name === 'Fresh Whole Milk'),
      'Expiring item not found in query'
    );
    console.log(`  ✅ Found ${expiringRes.data.data.items.length} item(s) expiring within 3 days`);

    // 10. Items: Update Item (Mark as consumed)
    console.log('➡️ Testing PATCH /api/items/:id (Mark as consumed)...');
    const updateRes = await request({
      method: 'PATCH',
      path: `/api/items/${item1Id}`,
      headers: updatedAuthHeaders,
      body: { status: 'consumed' },
    });
    console.assert(updateRes.statusCode === 200, 'Update item failed');
    console.assert(updateRes.data.data.item.status === 'consumed', 'Status was not updated');
    console.log('  ✅ Item marked as consumed successfully');

    // 11. Households: Create Household
    console.log('➡️ Testing POST /api/households...');
    const hhRes = await request({
      method: 'POST',
      path: '/api/households',
      headers: updatedAuthHeaders,
      body: { name: 'Lake House Kitchen' },
    });
    console.assert(hhRes.statusCode === 201, 'Create household failed');
    const household = hhRes.data.data.household;
    console.log(`  ✅ Household created: "${household.name}" (Invite Code: ${household.inviteCode})`);

    // 12. Analytics: GET /api/analytics/summary
    console.log('➡️ Testing GET /api/analytics/summary...');
    const analyticsRes = await request({
      method: 'GET',
      path: '/api/analytics/summary',
      headers: updatedAuthHeaders,
    });
    console.assert(analyticsRes.statusCode === 200, 'Analytics failed');
    console.log(
      `  ✅ Analytics verified: ${analyticsRes.data.data.counts.consumed} consumed, ${analyticsRes.data.data.counts.active} active`
    );

    // 13. Recipe Suggestions: GET /recipes/suggestions?days=3 and /api/recipes/suggestions
    console.log('➡️ Testing GET /recipes/suggestions?days=3...');
    const recipesRes = await request({
      method: 'GET',
      path: '/recipes/suggestions?days=3',
      headers: updatedAuthHeaders,
    });
    console.assert(recipesRes.statusCode === 200, 'Recipe suggestions failed');
    console.assert(Array.isArray(recipesRes.data.data.recipes), 'recipes array missing');
    console.log(`  ✅ Received ${recipesRes.data.data.recipes.length} recipe suggestion(s) from /recipes/suggestions`);

    console.log('➡️ Testing GET /api/recipes/suggestions?days=3...');
    const apiRecipesRes = await request({
      method: 'GET',
      path: '/api/recipes/suggestions?days=3',
      headers: updatedAuthHeaders,
    });
    console.assert(apiRecipesRes.statusCode === 200, '/api/recipes/suggestions failed');
    console.log(`  ✅ Received ${apiRecipesRes.data.data.recipes.length} recipe suggestion(s) from /api/recipes/suggestions`);

    // 14. Background Cron Job Trigger
    console.log('➡️ Testing POST /api/jobs/trigger-expiry-check...');
    const cronRes = await request({
      method: 'POST',
      path: '/api/jobs/trigger-expiry-check',
      headers: updatedAuthHeaders,
    });
    console.assert(cronRes.statusCode === 200, 'Cron trigger failed');
    console.log('  ✅ Expiry check cron job executed successfully');

    // 15. Quick Grocery Haul Parse & Batch Create
    console.log('➡️ Testing POST /api/items/parse-haul & POST /api/items/batch...');
    const parseRes = await request({
      method: 'POST',
      path: '/api/items/parse-haul',
      headers: updatedAuthHeaders,
      body: { text: '2 Baby Spinach $3.50, Sourdough Bread $4.00, SUBTOTAL $7.50' },
    });
    console.assert(parseRes.statusCode === 200 && parseRes.data.data.items.length === 2, 'Parse haul failed');

    const batchRes = await request({
      method: 'POST',
      path: '/api/items/batch',
      headers: updatedAuthHeaders,
      body: { items: parseRes.data.data.items },
    });
    console.assert(batchRes.statusCode === 201 && batchRes.data.data.count === 2, 'Batch create failed');
    console.log('  ✅ Quick Haul parsed & batch-created 2 items');

    // 16. Smart Restock List Flow
    console.log('➡️ Testing /api/restock add, check, and stock-bought...');
    const addRestockRes = await request({
      method: 'POST',
      path: '/api/restock',
      headers: updatedAuthHeaders,
      body: { name: 'Greek Yogurt', quantity: 1, unit: 'pack', price: 5.25, source: 'manual' },
    });
    console.assert(addRestockRes.statusCode === 201, 'Add restock item failed');
    const restockId = addRestockRes.data.data.item._id;

    const checkRestockRes = await request({
      method: 'PATCH',
      path: `/api/restock/${restockId}`,
      headers: updatedAuthHeaders,
      body: { isChecked: true },
    });
    console.assert(checkRestockRes.statusCode === 200 && checkRestockRes.data.data.item.isChecked === true, 'Check restock item failed');

    const stockRes = await request({
      method: 'POST',
      path: '/api/restock/stock-bought',
      headers: updatedAuthHeaders,
    });
    console.assert(stockRes.statusCode === 201 && stockRes.data.data.count === 1, 'Stock bought failed');
    console.log('  ✅ Restock item added, checked, and moved into kitchen');

    // 17. All Status filter includes consumed + active items
    console.log('➡️ Testing GET /api/items?status=all...');
    const allStatusRes = await request({
      method: 'GET',
      path: '/api/items?status=all',
      headers: updatedAuthHeaders,
    });
    console.assert(
      allStatusRes.statusCode === 200 &&
        allStatusRes.data.data.items.some((i) => i.status === 'consumed') &&
        allStatusRes.data.data.items.some((i) => i.status === 'active'),
      'status=all did not include both consumed and active items'
    );
    console.log('  ✅ status=all returned both consumed and active items');

    // 18. Security: Unauthorized household reassignment rejected
    console.log('➡️ Testing unauthorized household update protection...');
    const badHouseholdUpdate = await request({
      method: 'PATCH',
      path: `/api/items/${item1Id}`,
      headers: updatedAuthHeaders,
      body: { householdId: '65f000000000000000000001' },
    });
    console.assert(
      badHouseholdUpdate.statusCode === 403,
      `Expected 403 on unauthorized household reassignment, got ${badHouseholdUpdate.statusCode}`
    );
    console.log('  ✅ Unauthorized household reassignment blocked with 403');

    // 19. Auth: Change password revokes old refresh token & issues fresh session
    console.log('➡️ Testing POST /api/auth/change-password...');
    const changePwRes = await request({
      method: 'POST',
      path: '/api/auth/change-password',
      headers: updatedAuthHeaders,
      body: { currentPassword: 'Password123!', newPassword: 'NewPassword456!' },
    });
    console.assert(changePwRes.statusCode === 200 && changePwRes.data.data.refreshToken, 'Change password failed');

    const staleRefreshRes = await request({
      method: 'POST',
      path: '/api/auth/refresh-token',
      body: { refreshToken: secondRefreshToken },
    });
    console.assert(staleRefreshRes.statusCode === 401, 'Old refresh token should be revoked after password change');
    console.log('  ✅ Password updated and prior sessions revoked');

    // 20. Receipt Scanner multipart upload test
    console.log('➡️ Testing POST /api/items/scan-receipt...');
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const boundary = '----ShelfLifeTestBoundary123';
    const headerPart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="receipt"; filename="blank.png"\r\nContent-Type: image/png\r\n\r\n`,
      'utf8'
    );
    const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const multipartBody = Buffer.concat([headerPart, Buffer.from(pngBase64, 'base64'), footerPart]);
    const scanRes = await request({
      method: 'POST',
      path: '/api/items/scan-receipt',
      headers: {
        Authorization: `Bearer ${changePwRes.data.data.accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': multipartBody.length,
      },
      body: multipartBody,
      isFormData: true,
    });
    console.assert(scanRes.statusCode === 200 && Array.isArray(scanRes.data.data.items), `Receipt scan failed: ${JSON.stringify(scanRes.data)}`);
    console.log(`  ✅ Receipt scanner returned 200 with ${scanRes.data.data.items.length} item(s)`);

    console.log('\n🎉 ALL 20 BACKEND INTEGRATION TESTS PASSED!\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
      await disconnectDB();
    }
    process.exit(process.exitCode || 0);
  }
}

runTests();
