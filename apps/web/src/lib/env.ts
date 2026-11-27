import "server-only";
import { z } from "zod";

const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
const defaultAppUrl = vercelHost ? `https://${vercelHost}` : "http://localhost:3000";

// Treat "FOO=" in a .env file as "not set" instead of an invalid empty value.
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.string().url().default(defaultAppUrl),
    APP_VERSION: z.string().min(1).default("0.1.0"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    DATABASE_URL: z
      .string()
      .min(1)
      .default("postgresql://hexa:hexa@localhost:5433/hexa?schema=public"),
    REDIS_URL: z.string().url().optional(),
    AUTH_SECRET: z.string().min(32).optional(),
    DEMO_MODE: z.enum(["true", "false"]).optional(),
    // Explicit, separately named opt-in required to run demo personas in production.
    ALLOW_DEMO_MODE_IN_PRODUCTION: z.enum(["true", "false"]).optional(),
    // Set only when a trusted platform/proxy overwrites forwarding headers.
    TRUST_PROXY_HEADERS: z.enum(["true", "false"]).optional(),
    VERCEL: optionalString,
    EMAIL_PROVIDER: z.enum(["console", "smtp", "resend", "gmail"]).default("console"),
    EMAIL_FROM: z.string().min(3).default("Hexa <no-reply@hexa.local>"),
    SMTP_URL: z.string().url().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(16).optional(),
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    GOOGLE_REDIRECT_URI: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().url().optional(),
    ),
    TOKEN_ENCRYPTION_KEY: optionalString,
    GMAIL_FROM_NAME: z.string().min(1).max(80).default("PolicyPulse"),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_PROVIDER === "smtp" && !value.SMTP_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_URL"],
        message: "SMTP_URL is required when EMAIL_PROVIDER=smtp.",
      });
    }

    if (value.EMAIL_PROVIDER === "resend" && !value.RESEND_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["RESEND_API_KEY"],
        message: "RESEND_API_KEY is required when EMAIL_PROVIDER=resend.",
      });
    }

    if (value.EMAIL_PROVIDER === "gmail") {
      if (!value.GOOGLE_CLIENT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["GOOGLE_CLIENT_ID"],
          message: "GOOGLE_CLIENT_ID is required when EMAIL_PROVIDER=gmail.",
        });
      }

      if (!value.GOOGLE_CLIENT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["GOOGLE_CLIENT_SECRET"],
          message: "GOOGLE_CLIENT_SECRET is required when EMAIL_PROVIDER=gmail.",
        });
      }

      if (!value.TOKEN_ENCRYPTION_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["TOKEN_ENCRYPTION_KEY"],
          message: "TOKEN_ENCRYPTION_KEY is required when EMAIL_PROVIDER=gmail.",
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables. Check .env against .env.example.");
}

// Persona sign-in mints an OWNER session for anyone who can reach the app, so it
// is disabled in production unless the explicit, separately named opt-in is set.
const demoModeEnabled =
  parsed.data.NODE_ENV === "production"
    ? parsed.data.ALLOW_DEMO_MODE_IN_PRODUCTION === "true"
    : parsed.data.DEMO_MODE !== "false";

export const env = {
  ...parsed.data,
  DEMO_MODE_ENABLED: demoModeEnabled,
};
