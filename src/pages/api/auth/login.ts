import type { APIRoute } from "astro";
import { db, ensureDbInitialized } from "../../../db/client";
import { users } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword } from "../../../lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    await ensureDbInitialized();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and password are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Default admin fallback if DB isn't seeded yet or fails
    const adminEmail = (import.meta.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL || "tinnaphop.moss@gmail.com").trim();
    const adminPassword = (import.meta.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Moss2547").trim();

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    let isValid = false;
    let userData = {
      id: "admin-1",
      email: adminEmail,
      name: "Moss (Admin)",
      role: "admin",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
    };

    try {
      const userList = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
      const user = userList[0];

      if (user) {
        isValid = await verifyPassword(cleanPassword, user.passwordHash);
        if (isValid) {
          userData = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            avatar: user.avatar || userData.avatar,
          };
        }
      } else if (cleanEmail === adminEmail && cleanPassword === adminPassword) {
        isValid = true;
      }
    } catch (err) {
      // Fallback check against default env admin credentials
      if (cleanEmail === adminEmail && cleanPassword === adminPassword) {
        isValid = true;
      }
    }

    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Set cookie
    cookies.set("auth_user", JSON.stringify(userData), {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return new Response(
      JSON.stringify({ success: true, user: userData }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Login error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Server error during login" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
