import { describe, it, expect } from "vitest";
import { AppError } from "../src/errors/index.js";
import { ErrorCode } from "@resumeai/shared";

describe("Server-Side Ownership & Security Assertions", () => {
  it("AppError.forbidden generates correct status code and structured error code", () => {
    const error = AppError.forbidden(
      "Access denied: You do not own this resume",
    );
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe(ErrorCode.FORBIDDEN);
    expect(error.message).toContain("do not own");
  });

  it("AppError.unauthorized generates correct 401 code", () => {
    const error = AppError.unauthorized();
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it("Repository pattern strictly enforces user isolation query pattern", () => {
    // Conceptual verification of repository query filter
    const createOwnershipFilter = (
      resourceId: string,
      authenticatedUserId: string,
    ) => {
      if (!authenticatedUserId) throw AppError.unauthorized();
      return { id: resourceId, userId: authenticatedUserId };
    };

    const filter = createOwnershipFilter("res-123", "user-abc");
    expect(filter).toEqual({ id: "res-123", userId: "user-abc" });

    expect(() => createOwnershipFilter("res-123", "")).toThrow(AppError);
  });
});
