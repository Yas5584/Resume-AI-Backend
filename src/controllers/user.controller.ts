import { FastifyRequest, FastifyReply } from "fastify";
import { userService } from "../services/user.service.js";
import { UpdateProfileRequestSchema } from "@resumeai/shared";
import { sendSuccess } from "../utils/response.js";

export class UserController {
  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const profile = await userService.getProfile(request.user!.id);
    return sendSuccess(reply, profile);
  }

  async updateMe(request: FastifyRequest, reply: FastifyReply) {
    const body = UpdateProfileRequestSchema.parse(request.body);
    const updated = await userService.updateProfile(request.user!.id, body);
    return sendSuccess(reply, updated, 200, "Profile updated successfully");
  }
}

export const userController = new UserController();
