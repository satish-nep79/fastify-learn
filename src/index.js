import Fastify from "fastify";
import greetingController from "./greetings-controllser.js";

/*
 * Create the core Fastify instance.
 * Configuration options (like built-in Pino logger) are passed here to control 
 * server behavior across the application root scope.
 */
const fastify = Fastify({
  logger: true, // Enables built-in Pino logging for request/response lifecycles
});

/*
 * Register a plugin (`greetingController`).
 * 
 * In Fastify, plugins are the fundamental building blocks used to encapsulate 
 * routes, decorators, and hooks within isolated child contexts.
 * 
 * Passing options (e.g., `{ prefix: "/greetings" }`) configures context boundaries:
 * - Route Encapsulation: All routes declared inside `greetingController` are automatically 
 *   prefixed with `/greetings` (e.g., `/` becomes `/greetings`, `/hello` becomes `/greetings/hello`).
 * - Scope Isolation: Encapsulated plugins inherit parent decorators and hooks, but any 
 *   decorators or hooks added inside `greetingController` will not leak back up to the parent instance.
 */
fastify.register(greetingController, { prefix: "/greetings" });

try {
  // Start the HTTP server on port 3000.
  // Note: fastify.listen() returns a Promise, so standard async/await is recommended:
  // await fastify.listen({ port: 3000 });
  fastify.listen({ port: 3000 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}