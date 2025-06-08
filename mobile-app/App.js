import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Provider as PaperProvider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';

import DashboardScreen from './src/screens/DashboardScreen';
import LeadsScreen from './src/screens/LeadsScreen';
import MessagesScreen from './src/screens/MessagesScreen';
import TemplatesScreen from './src/screens/TemplatesScreen';

const Tab = createBottomTabNavigator();

const theme = {
  colors: {
    primary: '#10b981',
    accent: '#3b82f6',
    background: '#f8fafc',
    surface: '#ffffff',
    text: '#1f2937',
  },
};

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;

              if (route.name === 'Dashboard') {
                iconName = 'dashboard';
              } else if (route.name === 'Leads') {
                iconName = 'people';
              } else if (route.name === 'Messages') {
                iconName = 'message';
              } else if (route.name === 'Templates') {
                iconName = 'text-snippet';
              }

              return <Icon name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#10b981',
            tabBarInactiveTintColor: '#6b7280',
            tabBarStyle: {
              backgroundColor: '#ffffff',
              borderTopColor: '#e5e7eb',
            },
            headerStyle: {
              backgroundColor: '#10b981',
            },
            headerTintColor: '#ffffff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          })}
        >
          <Tab.Screen 
            name="Dashboard" 
            component={DashboardScreen}
            options={{ title: 'Panel Principal' }}
          />
          <Tab.Screen 
            name="Leads" 
            component={LeadsScreen}
            options={{ title: 'Leads' }}
          />
          <Tab.Screen 
            name="Messages" 
            component={MessagesScreen}
            options={{ title: 'Mensajes' }}
          />
          <Tab.Screen 
            name="Templates" 
            component={TemplatesScreen}
            options={{ title: 'Plantillas' }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}