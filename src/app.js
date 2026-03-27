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
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(o => o.trim())
  : [
      "https://bizcivitas-performance-marketing.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all for now, tighten later
      }
    },
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
app.get("/pm/health", (req, res) => {
  res.json({ status: "ok", service: "pm-backend", timestamp: new Date().toISOString() });
});

// Mount PM routes (matches frontend paths: /pm/*)
app.use("/pm/inquiry", pmInquiryRouter);
app.use("/pm/plans", pmPlanRouter);
app.use("/pm/engagement", pmEngagementRouter);
app.use("/pm/scoring-config", pmScoringConfigRouter);
app.use("/pm/stories", pmStoryRouter);
app.use("/pm/mailerlite", pmMailerliteRouter);
app.use("/pm/email-templates", pmEmailTemplateRouter);
app.use("/pm/email-automations", pmEmailAutomationRouter);
app.use("/pm/track", pmEmailTrackingRouter);
app.use("/pm/api-integrations", pmApiIntegrationsRouter);
app.use("/pm/api-plugins", pmApiPluginRouter);
app.use("/pm/whatsapp-templates", pmWhatsappTemplateRouter);
app.use("/pm/whatsapp-automations", pmWhatsappAutomationRouter);
app.use("/pm/whatsapp-tracking", pmWhatsappTrackingRouter);
app.use("/pm/whatsapp-webhook", pmWhatsappWebhookRouter);

// Error handler
app.use(errorHandler);

export default app;
