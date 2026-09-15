import { FastifyPluginAsync } from "fastify";
import { userController } from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/me", userController.getMe.bind(userController));
  fastify.patch("/me", userController.updateMe.bind(userController));
  // Backward compatibility alias
  fastify.get("/profile", userController.getMe.bind(userController));
};
