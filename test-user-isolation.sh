#!/bin/bash

echo "=== Testing User Data Isolation System ==="
echo ""

# Test superadmin access
echo "1. Testing Superadmin (DJP) - Should see ALL data:"
curl -s "http://localhost:5000/api/isolated/accounts?testUser=superadmin" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" | \
  grep -o '"success":[^,]*\|"canAccessAll":[^,]*\|"assignedAccountsCount":[^}]*' | \
  head -3

echo ""
echo "2. Testing Admin - Should see ALL data:"
curl -s "http://localhost:5000/api/isolated/accounts?testUser=admin" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" | \
  grep -o '"success":[^,]*\|"canAccessAll":[^,]*\|"assignedAccountsCount":[^}]*' | \
  head -3

echo ""
echo "3. Testing Agent1 - Should see LIMITED data:"
curl -s "http://localhost:5000/api/isolated/accounts?testUser=agent" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" | \
  grep -o '"success":[^,]*\|"canAccessAll":[^,]*\|"assignedAccountsCount":[^}]*' | \
  head -3

echo ""
echo "4. Testing Agent2 - Should see LIMITED data:"
curl -s "http://localhost:5000/api/isolated/accounts?testUser=agent2" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" | \
  grep -o '"success":[^,]*\|"canAccessAll":[^,]*\|"assignedAccountsCount":[^}]*' | \
  head -3

echo ""
echo "5. Testing Profile endpoint for different users:"
echo "- Superadmin profile:"
curl -s "http://localhost:5000/api/isolated/profile?testUser=superadmin" \
  -H "Accept: application/json" | \
  grep -o '"username":[^,]*\|"role":[^,]*\|"canAccessAll":[^}]*' | \
  head -3

echo ""
echo "- Agent profile:"
curl -s "http://localhost:5000/api/isolated/profile?testUser=agent" \
  -H "Accept: application/json" | \
  grep -o '"username":[^,]*\|"role":[^,]*\|"canAccessAll":[^}]*' | \
  head -3

echo ""
echo "=== User Data Isolation Test Complete ==="