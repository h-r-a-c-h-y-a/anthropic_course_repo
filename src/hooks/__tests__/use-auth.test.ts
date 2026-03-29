import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  (getAnonWorkData as any).mockReturnValue(null);
  (getProjects as any).mockResolvedValue([]);
  (createProject as any).mockResolvedValue({ id: "new-project-id" });
});

describe("useAuth", () => {
  describe("initial state", () => {
    test("isLoading is false initially", () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.isLoading).toBe(false);
    });

    test("exposes signIn, signUp, and isLoading", () => {
      const { result } = renderHook(() => useAuth());
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("signIn", () => {
    test("returns the result from signInAction", async () => {
      (signInAction as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });

    test("calls signInAction with email and password", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(signInAction).toHaveBeenCalledWith("user@example.com", "password123");
    });

    test("sets isLoading to true while signing in and false after", async () => {
      let resolveSignIn: (v: any) => void;
      (signInAction as any).mockReturnValue(
        new Promise((res) => { resolveSignIn = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => { result.current.signIn("user@example.com", "password123"); });
      expect(result.current.isLoading).toBe(true);

      await act(async () => { resolveSignIn!({ success: false }); });
      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when signInAction throws", async () => {
      (signInAction as any).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign in fails", async () => {
      (signInAction as any).mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpassword");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    test("returns error result when sign in fails", async () => {
      const errorResult = { success: false, error: "Invalid credentials" };
      (signInAction as any).mockResolvedValue(errorResult);

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrongpassword");
      });

      expect(returnValue).toEqual(errorResult);
    });
  });

  describe("signUp", () => {
    test("returns the result from signUpAction", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useAuth());
      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.signUp("new@example.com", "password123");
      });

      expect(returnValue).toEqual({ success: true });
    });

    test("calls signUpAction with email and password", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(signUpAction).toHaveBeenCalledWith("existing@example.com", "password123");
    });

    test("sets isLoading to true while signing up and false after", async () => {
      let resolveSignUp: (v: any) => void;
      (signUpAction as any).mockReturnValue(
        new Promise((res) => { resolveSignUp = res; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => { result.current.signUp("new@example.com", "password123"); });
      expect(result.current.isLoading).toBe(true);

      await act(async () => { resolveSignUp!({ success: false }); });
      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false even when signUpAction throws", async () => {
      (signUpAction as any).mockRejectedValue(new Error("Server error"));

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate when sign up fails", async () => {
      (signUpAction as any).mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("existing@example.com", "password123");
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("post sign-in navigation: anonymous work exists", () => {
    const anonWork = {
      messages: [{ id: "1", role: "user", content: "Hello" }],
      fileSystemData: { "/App.jsx": { type: "file", content: "export default () => <div/>" } },
    };

    beforeEach(() => {
      (getAnonWorkData as any).mockReturnValue(anonWork);
      (createProject as any).mockResolvedValue({ id: "anon-project-id" });
      (signInAction as any).mockResolvedValue({ success: true });
    });

    test("creates a project with the anonymous work", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonWork.messages,
          data: anonWork.fileSystemData,
        })
      );
    });

    test("clears anonymous work after creating the project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(clearAnonWork).toHaveBeenCalled();
    });

    test("navigates to the new project page", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/anon-project-id");
    });

    test("does not call getProjects when anon work exists", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(getProjects).not.toHaveBeenCalled();
    });
  });

  describe("post sign-in navigation: no anonymous work, existing projects", () => {
    const existingProjects = [
      { id: "project-1", name: "First Project" },
      { id: "project-2", name: "Second Project" },
    ];

    beforeEach(() => {
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue(existingProjects);
      (signInAction as any).mockResolvedValue({ success: true });
    });

    test("navigates to the most recent project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/project-1");
    });

    test("does not create a new project when one exists", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).not.toHaveBeenCalled();
    });
  });

  describe("post sign-in navigation: no anonymous work, no existing projects", () => {
    beforeEach(() => {
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "brand-new-project" });
      (signInAction as any).mockResolvedValue({ success: true });
    });

    test("creates a new empty project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [],
          data: {},
        })
      );
    });

    test("navigates to the newly created project", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/brand-new-project");
    });
  });

  describe("post sign-in navigation: anon work with empty messages", () => {
    beforeEach(() => {
      (getAnonWorkData as any).mockReturnValue({ messages: [], fileSystemData: {} });
      (getProjects as any).mockResolvedValue([{ id: "existing-project" }]);
      (signInAction as any).mockResolvedValue({ success: true });
    });

    test("skips anon work if messages array is empty and falls through to getProjects", async () => {
      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(getProjects).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/existing-project");
    });
  });

  describe("signUp post-auth navigation", () => {
    beforeEach(() => {
      (signUpAction as any).mockResolvedValue({ success: true });
    });

    test("navigates to existing project after sign up", async () => {
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "user-project" }]);

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/user-project");
    });

    test("creates project with anon work after sign up", async () => {
      (getAnonWorkData as any).mockReturnValue({
        messages: [{ id: "1", role: "user", content: "Hello" }],
        fileSystemData: {},
      });
      (createProject as any).mockResolvedValue({ id: "signup-anon-project" });

      const { result } = renderHook(() => useAuth());
      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/signup-anon-project");
      expect(clearAnonWork).toHaveBeenCalled();
    });
  });
});
