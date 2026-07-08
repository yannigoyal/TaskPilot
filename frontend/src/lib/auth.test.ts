import {
  DEMO_PASSWORD,
  DEMO_USERNAME,
  getAuthHeaders,
  getSession,
  isAuthenticated,
  login,
  logout,
} from "@/lib/auth";

describe("auth", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("accepts valid demo credentials", () => {
    expect(login(DEMO_USERNAME, DEMO_PASSWORD)).toBe(true);
    expect(isAuthenticated()).toBe(true);
    expect(getSession()).toEqual({ username: DEMO_USERNAME });
  });

  it("rejects invalid credentials", () => {
    expect(login("wrong", "creds")).toBe(false);
    expect(isAuthenticated()).toBe(false);
    expect(getSession()).toBeNull();
  });

  it("clears session on logout", () => {
    login(DEMO_USERNAME, DEMO_PASSWORD);
    logout();
    expect(isAuthenticated()).toBe(false);
    expect(getSession()).toBeNull();
  });

  it("returns X-User header when authenticated", () => {
    login(DEMO_USERNAME, DEMO_PASSWORD);
    expect(getAuthHeaders()).toEqual({ "X-User": DEMO_USERNAME });
  });

  it("returns empty headers when logged out", () => {
    expect(getAuthHeaders()).toEqual({});
  });
});
