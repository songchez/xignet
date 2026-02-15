# Risk Register

## R-001 x402 Version/Header Drift
- Impact: High
- Mitigation: v2 baseline + legacy adapter + conformance matrix tests

## R-002 WebAuthn Platform Variance
- Impact: Medium
- Mitigation: adapter contract + matrix test

## R-003 Chain Confirmation Delay
- Impact: High
- Mitigation: pending state 정책 RFC 추가

## R-004 Policy Misconfiguration
- Impact: High
- Mitigation: policy id 주입 + fail-closed 기본값 + contract tests

## R-005 Legal/Consent Evidence Drift
- Impact: High
- Mitigation: consent 최소 증빙 필드 강제 + artifact id 추적
