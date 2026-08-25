/**
 * Fastify Plugin Architecture
 *
 * Fastify plugins are standard JavaScript functions with the signature:
 * `(fastify, options, done) => void` (or `async (fastify, options) => void`).
 *
 * Concepts Demonstrated:
 * - `fastify`: The encapsulated child Fastify instance isolated to this plugin scope.
 * - `options`: Configuration object passed during plugin registration via `fastify.register(plugin, options)`.
 * - `done`: Life-cycle callback used to signal completion of synchronous plugin setup tasks.
 */
const greetingController = (fastify, options, done) => {
  /**
   * Fastify Schema System (Ajv & fast-json-stringify)
   *
   * Fastify uses compiled JSON schemas for high performance:
   * 1. Ajv validates incoming request payloads (query, params, body, headers).
   * 2. fast-json-stringify serializes outgoing responses up to 2x faster than standard JSON.stringify().
   *
   * CRITICAL SECURITY & SERIALIZATION RULE:
   * Response schemas act as strict output filters. Any property returned by a route handler
   * that is NOT explicitly declared in `response[statusCode].properties` will be automatically
   * stripped from the outgoing JSON response to prevent accidental data leaks.
   */
  const responseSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          message: { type: "string" },
          loggedTime: { type: "string" }, // Must be defined here, or fast-json-stringify will strip it
        },
        required: ["message", "loggedTime"],
      },
    },
  };

  /**
   * 1. REQUEST DECORATION (`fastify.decorateRequest`)
   *
   * Extends Fastify's core `Request` prototype.
   *
   * V8 Optimization Note:
   * Decorating requests up-front initializes consistent hidden classes in V8. This ensures
   * high execution performance compared to dynamically attaching arbitrary properties
   * (e.g., `request.myNewProp = value`) inside lifecycle hooks or route handlers.
   *
   * Scope & Handling Multiple Decorators:
   * Decorators added inside a plugin are scoped strictly to this context and its children.
   * Declare each property explicitly to handle multiple custom request state values.
   */
  // Primary request decorator for timestamp tracking
  fastify.decorateRequest("loggedTime", "");

  // Secondary request decorator initialized with a default fallback location
  fastify.decorateRequest("currentLocation", "Vaasa, Ostrobothnia, Finland");

  /**
   * 2. LIFECYCLE HOOKS (`fastify.addHook`)
   *
   * Intercepts Fastify's internal execution lifecycle.
   * `onRequest` is the very first hook fired when an HTTP request enters the server,
   * executing prior to parsing parameters, query strings, body payload, or route matching.
   *
   * Async Handler Note:
   * Async hook handlers implicitly return a Promise—do NOT call `done()` when using `async/await`.
   * Fastify resolves completion automatically when the async function completes.
   */
  fastify.addHook("onRequest", async (request, reply) => {
    // Populate/mutate the pre-decorated request instance properties for downstream routes
    request.loggedTime = new Date().toISOString();
    request.currentLocation = "Vaasa, Ostrobothnia, Finland";
  });

  /**
   * Route 1: Shorthand Method (`fastify.get`)
   *
   * Registers a GET route at `/` relative to this plugin's prefix.
   * If registered with `{ prefix: "/greetings" }`, this resolves to `GET /greetings/`.
   */
  fastify.get("/", { schema: responseSchema }, async (request, reply) => {
    // Fastify automatically passes plain JS objects through fast-json-stringify
    return {
      message: `Hello, world! from ${request.currentLocation}`,
      loggedTime: request.loggedTime,
    };
  });

  /**
   * Route 2: Dynamic Path Parameters & Decorator Access
   */
  fastify.get(
    "/:username",
    { schema: responseSchema },
    async (request, reply) => {
      // Access path parameters automatically parsed by Fastify
      const { username } = request.params;

      // Access request decorators set during the `onRequest` hook lifecycle
      const { loggedTime, currentLocation } = request;

      // Direct returns are preferred over `reply.send()` inside async handlers
      return {
        message: `Hello, ${username}! from ${currentLocation}`,
        loggedTime: loggedTime,
      };
    },
  );

  /**
   * Route 3: Full Route Declaration (`fastify.route()`)
   *
   * Shorthand functions (`fastify.get`, `fastify.post`) are syntactic sugar on top of `fastify.route()`.
   * Using `fastify.route()` directly provides complete control over multi-part schema contracts,
   * route-level hooks (`preHandler`, `onRequest`), custom constraints, and metadata config.
   */
  fastify.route({
    method: "GET",
    url: "/full/:username",

    /**
     * Complete Input/Output Contract Validation
     * Invalid incoming requests fail automatically at the Ajv validation step with HTTP 400
     * before reaching the execution handler.
     */
    schema: {
      params: {
        type: "object",
        properties: {
          username: { type: "string" },
        },
        required: ["username"],
      },
      querystring: {
        type: "object",
        properties: {
          lastName: { type: "string" },
        },
        required: ["lastName"],
      },
      response: {
        200: {
          type: "object",
          properties: {
            message: { type: "string" },
            // Property key in schema must match the key returned in handler ('loggedTime')
            loggedTime: { type: "string" },
          },
          required: ["message", "loggedTime"],
        },
        500: {
          type: "object",
          properties: {
            statusCode: { type: "number" },
            error: { type: "string" },
          },
          required: ["error"],
        },
      },
    },

    // Route Execution Handler
    handler: async (request, reply) => {
      const { username } = request.params;
      const { lastName } = request.query;
      const { loggedTime, currentLocation } = request;

      return {
        message: `Hello, ${username} ${lastName}! from ${currentLocation}`,
        loggedTime: loggedTime,
      };
    },
  });

  // Signals to Fastify that synchronous plugin initialization is complete.
  // (Not required if defining the plugin function as `async (fastify, options)`).
  done();
};

export default greetingController;
