// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";

// Mock server-only so it doesn't throw in test environment
vi.mock("server-only", () => ({}));

// Cookie store mock shared across tests
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } =
  await import("@/lib/auth");

const JWT_SECRET = new TextEncoder().encode("development-secret-key");
const COOKIE_NAME = "auth-token";

async function makeToken(
  payload: object,
  expiresIn: string = "7d"
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createSession", () => {
  test("signs a JWT and sets an httpOnly cookie", async () => {
    await createSession("user-1", "user@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();

    const [name, token, options] = mockCookieStore.set.mock.calls[0];
    expect(name).toBe(COOKIE_NAME);
    expect(typeof token).toBe("string");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("cookie expiry is approximately 7 days from now", async () => {
    const before = Date.now();
    await createSession("user-1", "user@example.com");
    const after = Date.now();

    const [, , options] = mockCookieStore.set.mock.calls[0];
    const expires: Date = options.expires;

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expires.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(expires.getTime()).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });

  test("JWT payload contains userId and email", async () => {
    await createSession("user-42", "hello@test.com");

    const [, token] = mockCookieStore.set.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-42");
    expect(payload.email).toBe("hello@test.com");
  });
});

describe("getSession", () => {
  test("returns null when no cookie is present", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken({
      userId: "user-1",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-1");
    expect(session?.email).toBe("user@example.com");
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken(
      { userId: "user-1", email: "user@example.com" },
      "-1s" // already expired
    );
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).toBeNull();
  });

  test("returns null for a tampered token", async () => {
    const token = "invalid.jwt.token";
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session).toBeNull();
  });
});

describe("deleteSession", () => {
  test("deletes the auth cookie", async () => {
    await deleteSession();

    expect(mockCookieStore.delete).toHaveBeenCalledOnce();
    expect(mockCookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});

describe("verifySession", () => {
  function makeRequest(token?: string): NextRequest {
    const req = new NextRequest("http://localhost/api/test");
    if (token) {
      req.cookies.set(COOKIE_NAME, token);
    }
    return req;
  }

  test("returns null when cookie is absent", async () => {
    const req = makeRequest();
    const session = await verifySession(req);
    expect(session).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await makeToken({
      userId: "user-99",
      email: "test@domain.com",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const req = makeRequest(token);

    const session = await verifySession(req);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe("user-99");
    expect(session?.email).toBe("test@domain.com");
  });

  test("returns null for an expired token", async () => {
    const token = await makeToken(
      { userId: "user-99", email: "test@domain.com" },
      "-1s"
    );
    const req = makeRequest(token);

    const session = await verifySession(req);
    expect(session).toBeNull();
  });

  test("returns null for a malformed token", async () => {
    const req = makeRequest("not.a.valid.jwt");

    const session = await verifySession(req);
    expect(session).toBeNull();
  });
});
