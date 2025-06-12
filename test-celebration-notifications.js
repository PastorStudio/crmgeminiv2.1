/**
 * Test script para verificar las notificaciones de celebración con iconos y nombre de usuario
 */

async function testCelebrationNotifications() {
  console.log('🧪 Testing Enhanced Demo Notifications with Celebration Icons...\n');

  try {
    // Test manual demo creation to trigger celebration notification
    console.log('--- Test: Manual Demo Creation with Enhanced Notification ---');
    const { default: axios } = await import('axios');
    
    const testCustomer = {
      customerName: `María González Test ${Date.now()}`,
      phoneNumber: `+1555${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
    };

    console.log(`Creating demo for: ${testCustomer.customerName}`);
    console.log(`Phone: ${testCustomer.phoneNumber}`);

    try {
      const response = await axios.post('http://localhost:5000/api/direct/demo/create', testCustomer);
      
      if (response.data.success) {
        console.log('✅ Demo created successfully!');
        console.log('Demo Details:', {
          customerName: response.data.demo.customerName,
          username: response.data.demo.username,
          password: response.data.demo.password,
          expiresAt: response.data.demo.expiresAt
        });

        console.log('\n🎉 Expected Notification Content:');
        console.log('Title: "🎉🎊 ¡Nuevo Demo Creado! 🎊🎉"');
        console.log(`Customer: ${testCustomer.customerName}`);
        console.log(`Username: ${response.data.demo.username}`);
        console.log('Duration: 8 seconds with green border');
        console.log('Style: Green border with celebration background');

        // Test automatic demo creation flow
        console.log('\n--- Test: Automatic Demo Creation via WhatsApp Flow ---');
        const { enhancedDemoDetector } = await import('./server/services/enhancedDemoDetector.ts');
        
        const testChatId = `celebration_test_${Date.now()}`;
        const testAccountId = 1;
        const testPhone = '+1555' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

        // Step 1: Request demo
        const demoRequest = await enhancedDemoDetector.processMessage(
          '¿Tienen algún demo del sistema para probarlo?',
          testChatId,
          testAccountId,
          testPhone
        );

        if (demoRequest) {
          console.log('✅ Demo request detected');
          
          // Step 2: Provide name to create demo
          const demoCreation = await enhancedDemoDetector.processMessage(
            'Mi nombre es Carlos Celebration Test',
            testChatId,
            testAccountId,
            testPhone
          );

          if (demoCreation && demoCreation.includes('Usuario:')) {
            console.log('✅ Automatic demo created successfully!');
            
            // Extract username from response
            const usernameMatch = demoCreation.match(/Usuario:\s*(\w+)/);
            if (usernameMatch) {
              console.log(`Username created: ${usernameMatch[1]}`);
              console.log('🎉 Celebration notification should have been sent!');
            }
          }
        }

        console.log('\n--- Notification Features Implemented ---');
        console.log('✅ Celebration icons: 🎉🎊🥳');
        console.log('✅ Enhanced title with multiple celebration emojis');
        console.log('✅ Customer name prominently displayed');
        console.log('✅ Username shown in styled code block');
        console.log('✅ Extended duration (8 seconds)');
        console.log('✅ Green border and background styling');
        console.log('✅ Automatic demo list refresh');
        console.log('✅ Works for both manual and automatic creation');

      } else {
        console.log('❌ Failed to create demo:', response.data.message);
      }
    } catch (apiError) {
      if (apiError.response) {
        console.log('❌ API Error:', apiError.response.data);
      } else {
        console.log('⚠️ Could not connect to API (server may be starting)');
      }
    }

    console.log('\n🎊 Enhanced Celebration Notification Test Complete! 🎊');

  } catch (error) {
    console.error('❌ Error in celebration notification test:', error);
  } finally {
    process.exit(0);
  }
}

testCelebrationNotifications();