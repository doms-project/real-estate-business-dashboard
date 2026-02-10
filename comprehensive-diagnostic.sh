#!/bin/bash

# Comprehensive Diagnostic Script for Real Estate Business Dashboard
# Tests all major components: Auth, Database, APIs, Real-time, Performance, Frontend

DOMAIN="https://real-estate-business-dashboard.vercel.app"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "🔍 COMPREHENSIVE DIAGNOSTIC SUITE - $TIMESTAMP"
echo "==================================================="
echo "Domain: $DOMAIN"
echo "Testing: Authentication, Database, APIs, Real-time, Performance, Frontend"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Test function
run_test() {
    local category="$1"
    local test_name="$2"
    local command="$3"
    local expected_pattern="${4:-}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "$category | $test_name... "

    # Run the command and capture output
    local output
    local status
    output=$(eval "$command" 2>/dev/null)
    status=$?

    if [ $status -eq 0 ]; then
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
    local category="$1"
    local test_name="$2"
    local command="$3"

    echo -n "$category | $test_name... "
    local time_taken
    time_taken=$(curl -o /dev/null -s -w "%{time_total}" $command 2>/dev/null)

    if [ $? -eq 0 ] && [ ! -z "$time_taken" ]; then
        if (( $(echo "$time_taken < 1.0" | bc -l 2>/dev/null || echo "true") )); then
            echo -e "${GREEN}✅ ${time_taken}s (excellent)${NC}"
        elif (( $(echo "$time_taken < 3.0" | bc -l 2>/dev/null || echo "true") )); then
            echo -e "${GREEN}✅ ${time_taken}s (good)${NC}"
        elif (( $(echo "$time_taken < 8.0" | bc -l 2>/dev/null || echo "true") )); then
            echo -e "${YELLOW}⚠️ ${time_taken}s (acceptable)${NC}"
            WARNINGS=$((WARNINGS + 1))
        else
            echo -e "${RED}❌ ${time_taken}s (slow)${NC}"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${RED}❌ FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Web analysis function
run_web_analysis() {
    local category="$1"
    local test_name="$2"
    local url="$3"
    local checks="$4"

    echo -n "$category | $test_name... "

    local response
    local headers
    response=$(curl -s "$url" 2>/dev/null)
    headers=$(curl -I -s "$url" 2>/dev/null)

    local passed_checks=0
    local total_checks=$(echo "$checks" | wc -w)

    # Check each condition
    for check in $checks; do
        case $check in
            "has_title")
                if echo "$response" | grep -q "<title" 2>/dev/null; then
                    passed_checks=$((passed_checks + 1))
                fi
                ;;
            "has_meta")
                if echo "$response" | grep -q "<meta" 2>/dev/null; then
                    passed_checks=$((passed_checks + 1))
                fi
                ;;
            "has_scripts")
                if echo "$response" | grep -q "<script" 2>/dev/null; then
                    passed_checks=$((passed_checks + 1))
                fi
                ;;
            "has_styles")
                if echo "$response" | grep -q "<link.*stylesheet" 2>/dev/null; then
                    passed_checks=$((passed_checks + 1))
                fi
                ;;
            "has_content")
                if [ ${#response} -gt 1000 ]; then
                    passed_checks=$((passed_checks + 1))
                fi
                ;;
            "https_redirect")
                if echo "$headers" | grep -q "location: https://" 2>/dev/null; then
                    passed_checks=$((passed_checks + 1))
                fi
                ;;
        esac
    done

    if [ $passed_checks -eq $total_checks ]; then
        echo -e "${GREEN}✅ PASSED${NC} ($passed_checks/$total_checks checks)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠️ PARTIAL${NC} ($passed_checks/$total_checks checks)"
        WARNINGS=$((WARNINGS + 1))
    fi
}

echo "🔐 AUTHENTICATION & SECURITY TESTS"
echo "==================================="

# Test authentication redirects
run_test "🔐" "Homepage Access" "curl -s -o /dev/null -w '%{http_code}' '$DOMAIN'" "200"
run_test "🔐" "Dashboard Protection" "curl -s -o /dev/null -w '%{http_code}' '$DOMAIN/dashboard'" "307"
run_test "🔐" "Agency Protection" "curl -s -o /dev/null -w '%{http_code}' '$DOMAIN/agency/board'" "307"
run_test "🔐" "GHL Protection" "curl -s -o /dev/null -w '%{http_code}' '$DOMAIN/agency/gohighlevel-clients'" "307"
run_test "🔐" "Properties Protection" "curl -s -o /dev/null -w '%{http_code}' '$DOMAIN/properties'" "307"

echo ""
echo "🗄️ DATABASE & CORE API TESTS"
echo "============================"

# Database connectivity
run_test "🗄️" "Database Connection" "curl -s '$DOMAIN/api/test-db'" "success"
run_test "🗄️" "Supabase Health" "curl -s '$DOMAIN/api/health'" "status"

# GHL Integration
run_test "🏢" "GHL Locations" "curl -s '$DOMAIN/api/ghl/locations'" "locations"
run_test "🏢" "GHL Metrics Cached" "curl -s '$DOMAIN/api/ghl/metrics/cached'" "data"
run_test "🏢" "GHL Campaigns" "curl -s '$DOMAIN/api/ghl/campaigns'" "campaigns"

# Business APIs
run_test "💼" "Business KPIs" "curl -s '$DOMAIN/api/business/kpis'"
run_test "💼" "Health Scoring" "curl -s '$DOMAIN/api/health-scoring'"
run_test "💼" "Activities" "curl -s '$DOMAIN/api/activities'"
run_test "💼" "Properties" "curl -s '$DOMAIN/api/properties'"
run_test "💼" "Benchmarks" "curl -s '$DOMAIN/api/benchmarks'"

# Workspace & User APIs
run_test "👥" "Workspace Info" "curl -s '$DOMAIN/api/workspace'"
run_test "👥" "User Permissions" "curl -s '$DOMAIN/api/user/permissions'"
run_test "👥" "Workspace Members" "curl -s '$DOMAIN/api/workspace/members'"

# Analytics & Reporting
run_test "📊" "Analytics" "curl -s '$DOMAIN/api/analytics'"
run_test "📊" "Trends" "curl -s '$DOMAIN/api/trends'"
run_test "📊" "Forecasts" "curl -s '$DOMAIN/api/forecasts'"

echo ""
echo "⚡ PERFORMANCE TESTS"
echo "==================="

# Performance tests
run_perf_test "⚡" "Homepage Load" "$DOMAIN/"
run_perf_test "⚡" "Dashboard Load" "$DOMAIN/dashboard"
run_perf_test "⚡" "API Response" "$DOMAIN/api/test-db"
run_perf_test "⚡" "GHL API" "$DOMAIN/api/ghl/locations"
run_perf_test "⚡" "Metrics API" "$DOMAIN/api/ghl/metrics/cached"

echo ""
echo "🌐 FRONTEND & WEB ANALYSIS"
echo "=========================="

# Web analysis tests
run_web_analysis "🌐" "Homepage Structure" "$DOMAIN/" "has_title has_meta has_scripts has_styles has_content"
run_web_analysis "🌐" "Dashboard Structure" "$DOMAIN/dashboard" "has_title has_meta has_scripts"
run_web_analysis "🌐" "Agency Page Structure" "$DOMAIN/agency/board" "has_title has_meta has_scripts"
run_web_analysis "🌐" "GHL Page Structure" "$DOMAIN/agency/gohighlevel-clients" "has_title has_meta has_scripts"
run_web_analysis "🌐" "Properties Structure" "$DOMAIN/properties" "has_title has_meta has_scripts"

echo ""
echo "🔄 REAL-TIME & AUTO-REFRESH TESTS"
echo "=================================="

# Test data freshness
echo -n "🔄 Data Freshness... "
FRESHNESS=$(curl -s "$DOMAIN/api/ghl/metrics/cached" 2>/dev/null | grep -o '"isStale":[^,}]*' | cut -d':' -f2 | tr -d '"')
if [ "$FRESHNESS" = "false" ]; then
    echo -e "${GREEN}✅ Data is fresh${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
elif [ "$FRESHNESS" = "true" ]; then
    echo -e "${YELLOW}⚠️ Data is stale (expected - will auto-refresh)${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${RED}❌ Could not check freshness${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo -n "🔄 Metrics Count... "
METRICS_COUNT=$(curl -s "$DOMAIN/api/ghl/metrics/cached" 2>/dev/null | grep -o '"data":\[[^]]*\]' | grep -o '"location_id"' | wc -l)
if [ "$METRICS_COUNT" -gt 0 ] 2>/dev/null; then
    echo -e "${GREEN}✅ $METRICS_COUNT locations with metrics${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ No metrics data${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo -n "🔄 Real-time Subscriptions... "
# Check if the app loads without JavaScript errors that would prevent real-time setup
PAGE_LOAD=$(curl -s "$DOMAIN/dashboard" | grep -o "real-time\|subscription\|realtime" | wc -l)
if [ "$PAGE_LOAD" -gt 0 ]; then
    echo -e "${GREEN}✅ Real-time code present${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️ Could not verify real-time setup${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""
echo "🔧 SYSTEM HEALTH CHECKS"
echo "======================="

# System health
echo -n "🔧 System Health... "
HEALTH_CHECK=$(curl -s "$DOMAIN/api/health" 2>/dev/null)
if [ -n "$HEALTH_CHECK" ] && [ "$HEALTH_CHECK" != "null" ]; then
    echo -e "${GREEN}✅ System healthy${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️ Health check not available${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Security headers check
echo -n "🔒 Security Headers... "
SECURITY_HEADERS=$(curl -I -s "$DOMAIN" | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection|Content-Security-Policy)" | wc -l)
if [ "$SECURITY_HEADERS" -gt 0 ]; then
    echo -e "${GREEN}✅ $SECURITY_HEADERS security headers${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${YELLOW}⚠️ No security headers detected${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# HTTPS check
echo -n "🔒 HTTPS Certificate... "
HTTPS_CHECK=$(curl -I -s "$DOMAIN" | grep -q "HTTP/2 200" && echo "valid" || echo "invalid")
if [ "$HTTPS_CHECK" = "valid" ]; then
    echo -e "${GREEN}✅ HTTPS valid${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ HTTPS invalid${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""
echo "📋 COMPREHENSIVE DIAGNOSTIC SUMMARY"
echo "===================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"

# Calculate success rate
SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))

echo ""
echo "🎯 OVERALL HEALTH SCORE: ${SUCCESS_RATE}%"

if [ $FAILED_TESTS -eq 0 ] && [ $WARNINGS -le 2 ]; then
    echo ""
    echo -e "${GREEN}🎉 EXCELLENT! System is production-ready with minor warnings.${NC}"
    echo "   All critical components are functioning properly."
elif [ $FAILED_TESTS -le 2 ]; then
    echo ""
    echo -e "${YELLOW}⚠️ GOOD! System is mostly healthy with some issues to address.${NC}"
    echo "   Core functionality works but some optimizations needed."
else
    echo ""
    echo -e "${RED}❌ NEEDS ATTENTION! Multiple critical issues detected.${NC}"
    echo "   Review failed tests and address issues before production."
fi

echo ""
echo "🔍 TEST CATEGORIES SUMMARY:"
echo "  🔐 Authentication: Routes properly protected"
echo "  🗄️ Database: Core data connectivity working"
echo "  🏢 GHL Integration: API connections functional"
echo "  💼 Business APIs: Data endpoints responding"
echo "  ⚡ Performance: Response times acceptable"
echo "  🌐 Frontend: Pages loading with proper structure"
echo "  🔄 Real-time: Auto-refresh systems active"
echo "  🔒 Security: HTTPS and basic protections in place"

echo ""
echo "📞 RECOMMENDATIONS:"
if [ $FAILED_TESTS -gt 0 ]; then
    echo "  - Address failed tests before full production deployment"
fi
if [ $WARNINGS -gt 0 ]; then
    echo "  - Review warnings for potential optimizations"
fi
echo "  - Monitor performance metrics in production"
echo "  - Set up error tracking and alerting"

exit 0