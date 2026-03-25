/**
 * H.3 — Multi-Currency & International Routes
 *
 * Exchange rate management, currency conversion for deals,
 * portfolio FX exposure tracking, and historical rate lookups.
 * Fetches rates from Open Exchange Rates API (free tier).
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { exchangeRates, crmDeals } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export const multiCurrencyRouter = Router();

const OER_BASE_URL = "https://openexchangerates.org/api";
const SUPPORTED_CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "CNY",
  "MXN", "BRL", "INR", "SGD", "HKD", "KRW", "NZD", "SEK",
  "NOK", "DKK", "ZAR", "AED", "SAR", "ILS",
];

// ── Exchange Rate Management ─────────────────────────────────────────────

// POST /rates/refresh — fetch latest rates from Open Exchange Rates
multiCurrencyRouter.post("/rates/refresh", async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.OPEN_EXCHANGE_RATES_APP_ID;
    if (!apiKey) {
      return res.status(503).json({ error: "OPEN_EXCHANGE_RATES_APP_ID not configured" });
    }

    const response = await fetch(`${OER_BASE_URL}/latest.json?app_id=${apiKey}&base=USD`);
    if (!response.ok) {
      const body = await response.text();
      return res.status(502).json({ error: `Exchange rate API error: ${body}` });
    }

    const data = await response.json();
    const rates = data.rates || {};
    const rateDate = new Date().toISOString().split("T")[0];
    let upserted = 0;

    for (const currency of SUPPORTED_CURRENCIES) {
      if (currency === "USD" || !rates[currency]) continue;

      // Upsert: delete existing for today, insert new
      await db
        .delete(exchangeRates)
        .where(
          and(
            eq(exchangeRates.targetCurrency, currency),
            eq(exchangeRates.rateDate, rateDate),
          ),
        );

      await db.insert(exchangeRates).values({
        baseCurrency: "USD",
        targetCurrency: currency,
        rate: String(rates[currency]),
        source: "openexchangerates",
        rateDate,
      });
      upserted++;
    }

    res.json({
      rateDate,
      currenciesUpdated: upserted,
      source: "openexchangerates",
      timestamp: data.timestamp,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /rates/manual — manually set an exchange rate
multiCurrencyRouter.post("/rates/manual", async (req: Request, res: Response) => {
  try {
    const { baseCurrency = "USD", targetCurrency, rate, rateDate } = req.body;

    if (!targetCurrency || !rate) {
      return res.status(400).json({ error: "targetCurrency and rate are required" });
    }

    const [created] = await db
      .insert(exchangeRates)
      .values({
        baseCurrency,
        targetCurrency,
        rate: String(rate),
        source: "manual",
        rateDate: rateDate || new Date().toISOString().split("T")[0],
      })
      .returning();

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /rates — get latest rates
multiCurrencyRouter.get("/rates", async (req: Request, res: Response) => {
  try {
    const { base = "USD", date } = req.query;

    let conditions;
    if (date) {
      conditions = and(
        eq(exchangeRates.baseCurrency, base as string),
        eq(exchangeRates.rateDate, date as string),
      );
    } else {
      // Get latest available rates
      conditions = eq(exchangeRates.baseCurrency, base as string);
    }

    const rates = await db
      .select()
      .from(exchangeRates)
      .where(conditions)
      .orderBy(desc(exchangeRates.rateDate))
      .limit(50);

    // Deduplicate to latest per currency
    const latestByCurrency = new Map<string, any>();
    for (const r of rates) {
      if (!latestByCurrency.has(r.targetCurrency)) {
        latestByCurrency.set(r.targetCurrency, r);
      }
    }

    const rateMap: Record<string, number> = {};
    rateMap[base as string] = 1;
    for (const [currency, rateRecord] of latestByCurrency) {
      rateMap[currency] = parseFloat(rateRecord.rate);
    }

    res.json({
      base,
      asOf: rates[0]?.rateDate || null,
      rates: rateMap,
      currencies: SUPPORTED_CURRENCIES,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /rates/historical — get historical rate for a currency pair on a date
multiCurrencyRouter.get("/rates/historical", async (req: Request, res: Response) => {
  try {
    const { from = "USD", to, date } = req.query;

    if (!to || !date) {
      return res.status(400).json({ error: "to (currency) and date are required" });
    }

    // Try exact date first, then closest prior date
    const [rate] = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.baseCurrency, from as string),
          eq(exchangeRates.targetCurrency, to as string),
          sql`${exchangeRates.rateDate} <= ${date}`,
        ),
      )
      .orderBy(desc(exchangeRates.rateDate))
      .limit(1);

    if (!rate) {
      return res.status(404).json({ error: `No rate found for ${from}/${to} on or before ${date}` });
    }

    res.json({
      from,
      to,
      requestedDate: date,
      actualDate: rate.rateDate,
      rate: parseFloat(rate.rate),
      source: rate.source,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Currency Conversion ──────────────────────────────────────────────────

// POST /convert — convert an amount between currencies
multiCurrencyRouter.post("/convert", async (req: Request, res: Response) => {
  try {
    const { amount, from = "USD", to, date } = req.body;

    if (!amount || !to) {
      return res.status(400).json({ error: "amount and to (currency) are required" });
    }

    if (from === to) {
      return res.json({ amount, from, to, convertedAmount: amount, rate: 1 });
    }

    // Get rate for from→USD and USD→to
    let fromToUsd = 1;
    let usdToTarget = 1;

    if (from !== "USD") {
      const [fromRate] = await db
        .select()
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.baseCurrency, "USD"),
            eq(exchangeRates.targetCurrency, from),
            date ? sql`${exchangeRates.rateDate} <= ${date}` : sql`true`,
          ),
        )
        .orderBy(desc(exchangeRates.rateDate))
        .limit(1);

      if (!fromRate) {
        return res.status(404).json({ error: `No rate found for USD/${from}` });
      }
      fromToUsd = 1 / parseFloat(fromRate.rate); // inverse: from→USD
    }

    if (to !== "USD") {
      const [toRate] = await db
        .select()
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.baseCurrency, "USD"),
            eq(exchangeRates.targetCurrency, to),
            date ? sql`${exchangeRates.rateDate} <= ${date}` : sql`true`,
          ),
        )
        .orderBy(desc(exchangeRates.rateDate))
        .limit(1);

      if (!toRate) {
        return res.status(404).json({ error: `No rate found for USD/${to}` });
      }
      usdToTarget = parseFloat(toRate.rate);
    }

    const crossRate = fromToUsd * usdToTarget;
    const convertedAmount = Math.round(parseFloat(amount) * crossRate * 100) / 100;

    res.json({
      amount: parseFloat(amount),
      from,
      to,
      rate: Math.round(crossRate * 100000000) / 100000000,
      convertedAmount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── Portfolio FX Exposure ────────────────────────────────────────────────

// GET /fx-exposure — show portfolio currency exposure
multiCurrencyRouter.get("/fx-exposure", async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user.orgId;

    // Get all deals with their currencies
    const deals = await db
      .select({
        id: crmDeals.id,
        title: crmDeals.title,
        value: crmDeals.value,
        currency: crmDeals.currency,
      })
      .from(crmDeals)
      .where(and(eq(crmDeals.orgId, orgId), eq(crmDeals.isClosed, false)));

    // Group by currency
    const exposure: Record<string, { count: number; totalValue: number; deals: any[] }> = {};

    for (const deal of deals) {
      const currency = (deal as any).currency || "USD";
      if (!exposure[currency]) {
        exposure[currency] = { count: 0, totalValue: 0, deals: [] };
      }
      const value = parseFloat(deal.value || "0");
      exposure[currency].count++;
      exposure[currency].totalValue += value;
      exposure[currency].deals.push({
        id: deal.id,
        title: deal.title,
        value,
      });
    }

    // Get USD equivalent for each currency
    const latestRates = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.baseCurrency, "USD"))
      .orderBy(desc(exchangeRates.rateDate))
      .limit(50);

    const rateMap = new Map<string, number>();
    for (const r of latestRates) {
      if (!rateMap.has(r.targetCurrency)) {
        rateMap.set(r.targetCurrency, parseFloat(r.rate));
      }
    }

    let totalUsdEquivalent = 0;
    const currencyBreakdown = Object.entries(exposure).map(([currency, data]) => {
      let usdEquivalent = data.totalValue;
      if (currency !== "USD" && rateMap.has(currency)) {
        usdEquivalent = data.totalValue / rateMap.get(currency)!;
      }
      totalUsdEquivalent += usdEquivalent;

      return {
        currency,
        dealCount: data.count,
        totalValue: Math.round(data.totalValue),
        usdEquivalent: Math.round(usdEquivalent),
      };
    });

    // Calculate percentages
    const withPercentages = currencyBreakdown.map((c) => ({
      ...c,
      portfolioPct: totalUsdEquivalent > 0
        ? Math.round((c.usdEquivalent / totalUsdEquivalent) * 10000) / 100
        : 0,
    }));

    const nonUsdExposure = withPercentages
      .filter((c) => c.currency !== "USD")
      .reduce((sum, c) => sum + c.portfolioPct, 0);

    res.json({
      totalPortfolioUsd: Math.round(totalUsdEquivalent),
      nonUsdExposurePct: Math.round(nonUsdExposure * 100) / 100,
      currencies: withPercentages.sort((a, b) => b.usdEquivalent - a.usdEquivalent),
      fxRiskNote:
        nonUsdExposure > 20
          ? `${Math.round(nonUsdExposure)}% of portfolio in non-USD currencies — consider hedging strategy`
          : nonUsdExposure > 5
            ? `${Math.round(nonUsdExposure)}% non-USD exposure — monitor FX trends`
            : "Portfolio primarily USD-denominated — minimal FX risk",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
