import { Router, type IRouter } from "express";
import { WhopClient } from "@whop/sdk";
import { getWhopClient, getWhopConnector } from "../lib/whopClient";

const router: IRouter = Router();

router.get("/whop/config", (_req, res) => {
  res.json({
    configured: Boolean(process.env.WHOP_COMPANY_ID && process.env.WHOP_PLAN_ID),
    plan: {
      name: "FLUX Pro",
      price: "$12",
      interval: "month",
    },
  });
});

router.post("/whop/checkout", async (req, res) => {
  const accountId = process.env.WHOP_COMPANY_ID;
  const planId = process.env.WHOP_PLAN_ID;
  if (!accountId || !planId) {
    res.status(503).json({ error: "Billing is not configured yet." });
    return;
  }

  try {
    const directPurchaseUrl = process.env.WHOP_PLAN_PURCHASE_URL;
    if (directPurchaseUrl) {
      res.status(201).json({ purchaseUrl: directPurchaseUrl, checkoutMode: "hosted-plan" });
      return;
    }
    const requestOrigin = req.get("origin");
    const origin = requestOrigin?.startsWith("https://")
      ? requestOrigin
      : `https://${process.env.REPLIT_DEV_DOMAIN || req.get("x-forwarded-host") || req.get("host")}`;
    const response = await getWhopConnector().proxy("whop", "/api/v1/checkout_configurations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: accountId,
        plan_id: planId,
        redirect_url: `${origin}/pricing?checkout=complete`,
      }),
    }) as any;
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "Whop checkout request failed.");
    if (!result.purchase_url && !result.url) {
      throw new Error("Whop did not return a hosted checkout URL.");
    }
    res.status(201).json({
      checkoutId: result.id,
      purchaseUrl: result.purchase_url || result.url,
    });
  } catch (error) {
    console.error("Whop checkout creation failed", error);
    req.log.error({ err: error }, "Whop checkout creation failed");
    res.status(502).json({ error: "We could not start checkout. Please try again." });
  }
});

router.get("/whop/access", async (req, res) => {
  const productId = process.env.WHOP_PRODUCT_ID;
  const userToken = req.header("x-whop-user-token");
  if (!productId || !userToken) {
    res.json({ authenticated: false, hasAccess: false });
    return;
  }

  try {
    const accountClient = await getWhopClient();
    const userClient = new WhopClient({ token: userToken });
    const user = await userClient.users.retrieve({ id: "me" });
    const access = await accountClient.users.checkAccess({
      id: user.id,
      resource_id: productId,
    });
    res.json({ authenticated: true, hasAccess: Boolean(access.has_access) });
  } catch (error) {
    req.log.warn({ err: error }, "Whop access verification failed");
    res.json({ authenticated: false, hasAccess: false });
  }
});

export default router;