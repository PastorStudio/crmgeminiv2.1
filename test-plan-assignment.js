/**
 * Test script to verify subscription plan assignment functionality
 */

async function testPlanAssignment() {
  console.log("🧪 Testing subscription plan assignment...");
  
  try {
    // Test 1: Get available plans
    console.log("1. Getting available subscription plans...");
    const plansResponse = await fetch('http://localhost:5000/api/subscription-plans');
    const plansData = await plansResponse.json();
    
    if (!plansData.success || !Array.isArray(plansData.plans)) {
      throw new Error("Failed to get subscription plans");
    }
    
    console.log(`✅ Found ${plansData.plans.length} subscription plans`);
    
    // Test 2: Get users list to find a test user
    console.log("2. Getting users list...");
    const usersResponse = await fetch('http://localhost:5000/api/users');
    const usersData = await usersResponse.json();
    
    if (!Array.isArray(usersData)) {
      throw new Error("Failed to get users list");
    }
    
    console.log(`✅ Found ${usersData.length} users`);
    const testUser = usersData.find(user => user.id !== 3); // Not the super admin
    
    if (!testUser) {
      throw new Error("No test user found");
    }
    
    console.log(`✅ Using test user: ${testUser.username} (ID: ${testUser.id})`);
    console.log(`Current plan: ${testUser.currentPlan || 'None'}`);
    
    // Test 3: Assign a different plan
    const targetPlan = plansData.plans.find(plan => plan.id !== testUser.currentPlanId);
    if (!targetPlan) {
      throw new Error("No different plan available for testing");
    }
    
    console.log(`3. Assigning plan "${targetPlan.name}" to user ${testUser.username}...`);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    const assignResponse = await fetch('http://localhost:5000/api/user-subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: testUser.id,
        plan_id: targetPlan.id,
        end_date: endDate.toISOString(),
        notes: 'Test assignment from script'
      })
    });
    
    const assignData = await assignResponse.json();
    
    if (!assignData.success) {
      throw new Error(`Plan assignment failed: ${assignData.message}`);
    }
    
    console.log(`✅ Plan assigned successfully: ${assignData.message}`);
    
    // Test 4: Verify the assignment by getting users again
    console.log("4. Verifying plan assignment...");
    
    // Wait a moment for database updates
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const verifyResponse = await fetch('http://localhost:5000/api/users');
    const verifyData = await verifyResponse.json();
    
    const updatedUser = verifyData.find(user => user.id === testUser.id);
    
    if (!updatedUser) {
      throw new Error("User not found in verification");
    }
    
    console.log(`Updated user plan: ${updatedUser.currentPlan || 'None'}`);
    console.log(`Expected plan: ${targetPlan.name}`);
    
    if (updatedUser.currentPlan === targetPlan.name) {
      console.log("✅ PLAN ASSIGNMENT TEST PASSED - Plan updated correctly!");
    } else {
      console.log("❌ PLAN ASSIGNMENT TEST FAILED - Plan not updated");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
testPlanAssignment();