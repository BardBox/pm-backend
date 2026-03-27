import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";

// Import PM routes
import pmInquiryRouter from "./routes/pmInquiry.routes.js";
import pmPlanRouter from "./routes/pmPlan.routes.js";
import pmEngagementRouter from "./routes/pmEngagement.routes.js";
import pmScoringConfigRouter from "./routes/pmScoringConfig.routes.js";
import pmStoryRouter from "./routes/pmStory.routes.js";
import pmMailerliteRouter from "./routes/pmMailerlite.routes.js";
import pmEmailTemplateRouter from "./routes/pmEmailTemplate.routes.js";
import pmEmailAutomationRouter from "./routes/pmEmailAutomation.routes.js";
import pmEmailTrackingRouter from "./routes/pmEmailTracking.routes.js";
import pmApiIntegrationsRouter from "./routes/pmApiIntegrations.routes.js";
import pmApiPluginRouter from "./routes/pmApiPlugin.routes.js";
import pmWhatsappTemplateRouter from "./routes/pmWhatsappTemplate.routes.js";
import pmWhatsappAutomationRouter from "./routes/pmWhatsappAutomation.routes.js";
import pmWhatsappTrackingRouter from "./routes/pmWhatsappTracking.routes.js";
import pmWhatsappWebhookRouter from "./routes/pmWhatsappWebhook.routes.js";

const app = express();

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
    credentials: true,
  })
);

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Static files
app.use(express.static("public"));

// Health check
app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok", service: "pm-backend", timestamp: new Date().toISOString() });
});

// Mount PM routes
app.use("/api/v1/pm/inquiry", pmInquiryRouter);
app.use("/api/v1/pm/plans", pmPlanRouter);
app.use("/api/v1/pm/engagement", pmEngagementRouter);
app.use("/api/v1/pm/scoring-config", pmScoringConfigRouter);
app.use("/api/v1/pm/stories", pmStoryRouter);
app.use("/api/v1/pm/mailerlite", pmMailerliteRouter);
app.use("/api/v1/pm/email-templates", pmEmailTemplateRouter);
app.use("/api/v1/pm/email-automations", pmEmailAutomationRouter);
app.use("/api/v1/pm/track", pmEmailTrackingRouter);
app.use("/api/v1/pm/api-integrations", pmApiIntegrationsRouter);
app.use("/api/v1/pm/api-plugins", pmApiPluginRouter);
app.use("/api/v1/pm/whatsapp-templates", pmWhatsappTemplateRouter);
app.use("/api/v1/pm/whatsapp-automations", pmWhatsappAutomationRouter);
app.use("/api/v1/pm/whatsapp-tracking", pmWhatsappTrackingRouter);
app.use("/api/v1/pm/whatsapp-webhook", pmWhatsappWebhookRouter);

// Error handler
app.use(errorHandler);

export default app;
