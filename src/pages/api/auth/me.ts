import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const authCookie = cookies.get("auth_user");
  if (!authCookie) {
    return new Response(
      JSON.stringify({ authenticated: false, user: null }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const user = JSON.parse(authCookie.value);
    return new Response(
      JSON.stringify({ authenticated: true, user }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ authenticated: false, user: null }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
};
