import { describe, expect, it } from "vitest";

import {
  adaptLegacyToV2Canonical,
  parsePaymentRequiredHeader,
  validatePaymentRequirementTtmHash,
  ProtocolCompatibilityError
} from "../../src/index.js";

function encodePaymentRequired(value: unknown): string {
  if (typeof globalThis.btoa !== "function") {
    throw new Error("Runtime does not support base64 encoding");
  }

  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return globalThis.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

describe("x402 conformance matrix draft", () => {
  describe("legacy(v1/L402) compatibility", () => {
    it.each([
      {
        name: "comma-delimited auth params",
        header: `L402 invoice="https://gateway.example.com/invoices/iv_legacy_1", amount=50000, currency="USDC", network="base-mainnet", pay_to="0xabc", resource="https://api.example.com/r1"`
      },
      {
        name: "semicolon-delimited auth params",
        header: `L402 invoice="https://gateway.example.com/invoices/iv_legacy_2"; amount=42; currency="USDC"; network="eip155:8453"; merchant="0xdef"; resource="https://api.example.com/r2"`
      }
    ])("adapts $name to v2 canonical requirement", ({ header }) => {
      const requirement = adaptLegacyToV2Canonical(header);
      expect(requirement.x402Version).toBe(2);
      expect(requirement.accepts[0]?.network).toBe("eip155:8453");
      expect(requirement.accepts[0]?.asset).toBe("USDC");
    });

    it("rejects legacy header without required network", () => {
      expect(() =>
        adaptLegacyToV2Canonical(
          'L402 invoice="https://gateway.example.com/invoices/iv_legacy_missing", amount=10, currency="USDC", pay_to="0xabc"'
        )
      ).toThrow(ProtocolCompatibilityError);
      expect(() =>
        adaptLegacyToV2Canonical(
          'L402 invoice="https://gateway.example.com/invoices/iv_legacy_missing", amount=10, currency="USDC", pay_to="0xabc"'
        )
      ).toThrow("Missing required x402 field: network");
    });
  });

  describe("v2 PAYMENT-REQUIRED baseline", () => {
    it.each([
      {
        name: "x402Version as number",
        encoded: encodePaymentRequired({
          x402Version: 2,
          accepts: [
            {
              scheme: "exact",
              network: "base-mainnet",
              maxAmountRequired: "0.015",
              payTo: "0xaaa",
              resource: "https://api.example.com/protected/a",
              asset: "USDC"
            }
          ],
          ttmHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        })
      },
      {
        name: "x402Version as string",
        encoded: encodePaymentRequired({
          x402Version: "2",
          accepts: [
            {
              scheme: "exact",
              network: "eip155:8453",
              maxAmountRequired: "10",
              payTo: "0xbbb",
              resource: "https://api.example.com/protected/b",
              asset: "USDC"
            }
          ],
          ttmHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        })
      }
    ])("parses $name", ({ encoded }) => {
      const requirement = parsePaymentRequiredHeader(encoded);
      expect(requirement.x402Version).toBe(2);
      expect(requirement.accepts[0]?.network).toBe("eip155:8453");
      expect(requirement.accepts[0]?.payTo).toMatch(/^0x/);
      expect(requirement.ttmHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("[D-001] validates lowercase 64-char hex ttmHash and fails closed on malformed expected hash", () => {
      const validHex = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const requirement = parsePaymentRequiredHeader(
        encodePaymentRequired({
          x402Version: 2,
          accepts: [
            {
              scheme: "exact",
              network: "eip155:8453",
              maxAmountRequired: "10",
              payTo: "0xccc",
              resource: "https://api.example.com/protected/d",
              asset: "USDC"
            }
          ],
          ttmHash: validHex
        })
      );

      expect(validatePaymentRequirementTtmHash(requirement, validHex)).toBe(true);
      expect(() => validatePaymentRequirementTtmHash(requirement, "not-hex")).toThrow(
        ProtocolCompatibilityError
      );
    });

    it.each([
      {
        name: "invalid base64url payload",
        encoded: "not*base64*payload",
        expectedMessage: "Invalid PAYMENT-REQUIRED base64url payload"
      },
      {
        name: "missing accepts",
        encoded: encodePaymentRequired({
          x402Version: 2
        }),
        expectedMessage: "Missing required x402 field: accepts"
      },
      {
        name: "missing payTo in accepts item",
        encoded: encodePaymentRequired({
          x402Version: 2,
          accepts: [
            {
              scheme: "exact",
              network: "eip155:8453",
              maxAmountRequired: "10",
              resource: "https://api.example.com/protected/c",
              asset: "USDC"
            }
          ]
        }),
        expectedMessage: "Missing required x402 field: accepts[0].payTo"
      },
      {
        name: "scientific notation amount (precision rule violation)",
        encoded: encodePaymentRequired({
          x402Version: 2,
          accepts: [
            {
              scheme: "exact",
              network: "eip155:8453",
              maxAmountRequired: "1e-3",
              payTo: "0xddd",
              resource: "https://api.example.com/protected/e",
              asset: "USDC"
            }
          ]
        }),
        expectedMessage: "Invalid amount in x402 field: accepts[0].maxAmountRequired"
      }
    ])("rejects $name", ({ encoded, expectedMessage }) => {
      expect(() => parsePaymentRequiredHeader(encoded)).toThrow(
        ProtocolCompatibilityError
      );
      expect(() => parsePaymentRequiredHeader(encoded)).toThrow(expectedMessage);
    });
  });
});
