import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "./prisma";
import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST || "localhost";
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER || "";
const smtpPass = process.env.SMTP_PASS || "";

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
});

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET || "default_dev_secret_key_needs_to_be_at_least_32_characters_long",
  baseURL: process.env.BETTER_AUTH_URL || (process.env.PUBLIC_ORIGIN ? (process.env.PUBLIC_ORIGIN.startsWith('http') ? process.env.PUBLIC_ORIGIN : `https://${process.env.PUBLIC_ORIGIN}`) : (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173"))),
  trustedOrigins: [
    'https://judge-theta-ten.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    ...(process.env.PUBLIC_ORIGIN ? [process.env.PUBLIC_ORIGIN] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`] : []),
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword(data) {
      console.log(`[AUTH] Password reset requested for ${data.user.email}: ${data.url}`);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      console.log(`[AUTH] Verification email for ${user.email}: Code: ${token} | URL: ${url}`);
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        try {
          await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Untitled Judge" <no-reply@judge.org>',
            to: user.email,
            subject: "Your Untitled Judge Login Code",
            text: `Your confirmation code is: ${token}\nOr click here to verify: ${url}`,
          });
        } catch (err) {
          console.error("Failed to send verification email:", err);
        }
      }
    },
  },
  socialProviders: (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {},
  plugins: [
    admin({
      defaultRole: "student",
      adminRole: "admin",
    }),
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
});

