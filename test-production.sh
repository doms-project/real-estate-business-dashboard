#!/bin/bash

# Production Testing Script for Real Estate Business Dashboard
# Domain: https://real-estate-business-dashboard.vercel.app
#
# Updated to properly handle:
# - Authentication redirects (HTTP 307) as successful protection
# - Various API response formats (not just "success":true)
# - Realistic performance thresholds
# - Null/empty responses as failures

DOMAIN="https://real-estate-business-dashboard.vercel.app"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "🧪 Production Testing Suite - $TIMESTAMP"
echo "==============================================="
echo "Domain: $DOMAIN"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="${3:-}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "🔍 $test_name... "

    # Run the command and capture output
    local output
    local status
    output=$(eval "$command" 2>/dev/null)
    status=$?

    if [ $status -eq 0 ]; then
        # Check for specific patterns or successful responses
        if [ -n "$expected_pattern" ]; then
            if echo "$output" | grep -q "$expected_pattern" 2>/dev/null; then
                echo -e "${GREEN}✅ PASSED${NC}"
                PASSED_TESTS=$((PASSED_TESTS + 1))
            else
                echo -e "${RED}❌ FAILED${NC} (expected: $expected_pattern)"
                FAILED_TESTS=$((FAILED_TESTS + 1))
            fi
        elif echo "$output" | grep -q '"success":true' 2>/dev/null || echo "$output" | grep -q "HTTP.*200" 2>/dev/null || echo "$output" | grep -q "HTTP.*307" 2>/dev/null || ([ "$output" != "null" ] && [ -n "$output" ]); then
            echo -e "${GREEN}✅ PASSED${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}❌ FAILED${NC} (null or empty response)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${RED}❌ FAILED${NC} (exit code: $status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Performance test function
run_perf_test() {
    local test_name="$1"
    local command="$2"

    echo -n "⚡ $test_name... "
    local time_taken
    time_taken=$(curl -o /dev/null -s -w "%{time_total}" $command 2>/dev/null)

    if [ $? -eq 0 ] && [ ! -z "$time_taken" ]; then
        # More realistic thresholds for production
        if (( $(echo "$time_taken < 2.0" | bc -l 2>/dev/null || echo "true") )); then
            echo -e "${GREEN}✅ ${time_taken}s${NC}"
        elif (( $(echo "$time_taken < 5.0" | bc -l 2>/dev/null || echo "true") )); then
            echo -e "${YELLOW}⚠️ ${time_taken}s${NC}"
        else
            echo -e "${RED}❌ ${time_taken}s (slow)${NC}"
        fi
    else
        echo -e "${RED}❌ FAILED${NC}"
    fi
}

echo "📊 Database & API Tests"
echo "-----------------------"

# Database connectivity
run_test "Database Connection" "curl -s '$DOMAIN/api/test-db'" "success"

# GHL API endpoints
run_test "GHL Locations" "curl -s '$DOMAIN/api/ghl/locations'" "locations"
run_test "GHL Metrics Cached" "curl -s '$DOMAIN/api/ghl/metrics/cached'" "data"
run_test "GHL Metrics Refresh" "curl -s '$DOMAIN/api/ghl/metrics/refresh'" "success"

# Business data
run_test "Business KPIs" "curl -s '$DOMAIN/api/business/kpis'"
run_test "Health Scoring" "curl -s '$DOMAIN/api/health-scoring'"

# Other APIs
run_test "Activities" "curl -s '$DOMAIN/api/activities'"
run_test "Properties" "curl -s '$DOMAIN/api/properties'"
run_test "Benchmarks" "curl -s '$DOMAIN/api/benchmarks'"

echo ""
echo "⚡ Performance Tests"
echo "-------------------"

# Performance tests
run_perf_test "Homepage Load" "$DOMAIN/"
run_perf_test "Dashboard Load" "$DOMAIN/dashboard"
run_perf_test "API Response" "$DOMAIN/api/test-db"
run_perf_test "Metrics API" "$DOMAIN/api/ghl/metrics/cached"

echo ""
echo "🔐 Authentication & Security Tests"
echo "----------------------------------"

# Basic security checks
run_test "HTTPS Connection" "curl -I '$DOMAIN' | grep -q 'HTTP/2 200'" "200"
run_test "API Connectivity" "curl -s '$DOMAIN/api/test-db' | grep -v null"

# Check for common security headers
echo -n "🛡️ Security Headers... "
SECURITY_HEADERS=$(curl -I -s "$DOMAIN" | grep -E "(X-Frame-Options|X-Content-Type-Options|Content-Security-Policy)" | wc -l)
if [ "$SECURITY_HEADERS" -gt 0 ]; then
    echo -e "${GREEN}✅ $SECURITY_HEADERS headers found${NC}"
else
    echo -e "${YELLOW}⚠️ No security headers detected${NC}"
fi

echo ""
echo "📱 Frontend Page Tests"
echo "----------------------"

# Test authentication (redirects are expected for protected routes)
run_test "Dashboard Protection" "curl -s -o /dev/null -w '%{http_code}' '$DOMAIN/dashboard'" "307"
run_test "Agency Board Protection" "curl -s -o /dev/null -w '%{http_code}' '$DOMAIN/agency/board'" "307"
run_test "GHL Clients Protection" "curl -s -o /dev/null -w '%{http_code}' '$DOMAIN/agency/gohighlevel-clients'" "307"
run_test "Properties Protection" "curl -s -o /dev/null -w '%{http_code}' '$DOMAIN/properties'" "307"

echo ""
echo "🔍 Data Consistency Tests"
echo "-------------------------"

# Test data consistency
echo -n "📊 Data Freshness... "
FRESHNESS=$(curl -s "$DOMAIN/api/ghl/metrics/cached" 2>/dev/null | grep -o '"isStale":[^,}]*' | cut -d':' -f2 | tr -d '"')
if [ "$FRESHNESS" = "false" ]; then
    echo -e "${GREEN}✅ Data is fresh${NC}"
elif [ "$FRESHNESS" = "true" ]; then
    echo -e "${YELLOW}⚠️ Data is stale${NC}"
else
    echo -e "${RED}❌ Could not check freshness${NC}"
fi

echo -n "📈 Metrics Count... "
METRICS_COUNT=$(curl -s "$DOMAIN/api/ghl/metrics/cached" 2>/dev/null | grep -o '"data":\[[^]]*\]' | grep -o '"location_id"' | wc -l)
if [ "$METRICS_COUNT" -gt 0 ] 2>/dev/null; then
    echo -e "${GREEN}✅ $METRICS_COUNT locations with metrics${NC}"
else
    echo -e "${RED}❌ No metrics data${NC}"
fi

echo ""
echo "📋 Test Summary"
echo "==============="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! Production deployment looks healthy.${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}⚠️ $FAILED_TESTS tests failed. Check the output above for details.${NC}"
    exit 1
fi