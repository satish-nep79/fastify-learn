import Fastify from "fastify";
import fastifyMySQL from "@fastify/mysql";

//Controllers
import greetingController from "./greetings-controllser.js";
import books_controller from "./books_controller.js";

/*
 * Create the core Fastify instance.
 * Configuration options (like built-in Pino logger) are passed here to control
 * server behavior across the application root scope.
 */
const fastify = Fastify({
  logger: true, // Enables built-in Pino logging for request/response lifecycles
});

/**
 * DATABASE PLUGIN REGISTRATION (`@fastify/mysql`)
 *
 * Architecture & Pool Mechanics:
 * 1. Connection Pool: Passing an object config automatically creates a MySQL connection pool.
 *    The pool manages connection reuse across concurrent HTTP requests.
 * 2. Decorator Injection: `@fastify/mysql` decorates the root `fastify` instance with `fastify.mysql`,
 *    making database execution methods (`fastify.mysql.execute`, `fastify.mysql.query`) available
 *    to all downstream child plugins registered after this point.
 * 3. `promise` Option: In modern `@fastify/mysql` (v5+), promises are enabled by default for
 *    native async/await support with `mysql2/promise`.
 */
fastify.register(fastifyMySQL, {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "BeTheMan@123",
  database: "bookstore",
  promise: true, // Enables native async/await support for MySQL queries.
  connectionLimit: 10, // Max active connections allowed in the pool
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
fastify.register(books_controller, { prefix: "/books" });

try {
  // Start the HTTP server on port 3000.
  // Note: fastify.listen() returns a Promise, so standard async/await is recommended:
  // await fastify.listen({ port: 3000 });
  fastify.listen({ port: 3000 });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
