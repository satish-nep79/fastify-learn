# Fastify Learning Project - Learning Notes

This project demonstrates core Fastify concepts through a practical greeting API and a book management API. Below are detailed notes on what I learned and how each concept was applied.

---

## 📚 Table of Contents

1. [Fastify Instance Creation](#1-fastify-instance-creation)
2. [Plugin Architecture](#2-plugin-architecture)
3. [Request Decorators (`decorateRequest`)](#3-request-decorators-decoraterequest)
4. [Lifecycle Hooks (`addHook`)](#4-lifecycle-hooks-addhook)
5. [Application Life Cycle](#5-application-life-cycle)
6. [Schema System: Validation & Serialization](#6-schema-system-validation--serialization)
7. [Route Definitions](#7-route-definitions)
8. [Route Prefix & Encapsulation](#8-route-prefix--encapsulation)
9. [Database Integration (`@fastify/mysql`)](#9-database-integration-fastifymysql)
10. [Summary of Key Takeaways](#10-summary-of-key-takeaways)
11. [Running the Project](#11-running-the-project)

---

## 1. Fastify Instance Creation

**File:** `src/index.js` (lines 9-15)

```javascript
const fastify = Fastify({
  logger: true, // Enables built-in Pino logging for request/response lifecycles
});
```

### What I Learned
- Fastify's constructor accepts configuration options that apply globally
- `logger: true` enables **Pino** - a fast, structured JSON logger built-in to Fastify
- The logger automatically logs request/response lifecycles with timing information

### How I Used It
Created the root Fastify instance with logging enabled to observe all incoming requests and responses during development.

---

## 2. Plugin Architecture

**File:** `src/index.js` (lines 17-52), `src/greetings-controllser.js` (lines 1-180), `src/books_controller.js` (lines 1-160)

```javascript
// In index.js - Registering plugins with prefixes
fastify.register(greetingController, { prefix: "/greetings" });
fastify.register(books_controller, { prefix: "/books" });

// In greetings-controllser.js - Plugin signature
const greetingController = (fastify, options, done) => {
  // ... plugin logic
  done(); // Signal completion for sync plugins
};
export default greetingController;
```

### What I Learned
- **Plugins** are the fundamental building blocks in Fastify for encapsulation
- Plugin signature: `(fastify, options, done) => void` or `async (fastify, options) => void`
- `fastify` - An encapsulated **child Fastify instance** isolated to this plugin scope
- `options` - Configuration object passed during registration
- `done` - Lifecycle callback for synchronous plugin setup (not needed for async plugins)

### Key Concepts Demonstrated
| Concept | Description |
|---------|-------------|
| **Route Encapsulation** | All routes inside the plugin automatically get the specified prefix |
| **Scope Isolation** | Decorators/hooks added in the plugin don't leak to parent |
| **Inheritance** | Child plugins inherit parent decorators and hooks |

### How I Used It
Created two plugins:
1. `greetingController` - Encapsulates all greeting-related routes, decorators, and hooks under `/greetings`
2. `books_controller` - Handles book CRUD operations with MySQL under `/books`

---

## 3. Request Decorators (`decorateRequest`)

**File:** `src/greetings-controllser.js` (lines 38-56)

```javascript
/**
 * V8 Optimization Note:
 * Decorating requests up-front initializes consistent hidden classes in V8.
 * This ensures high execution performance compared to dynamically attaching
 * arbitrary properties inside lifecycle hooks or route handlers.
 */

// Primary request decorator for timestamp tracking
fastify.decorateRequest("loggedTime", "");

// Secondary request decorator with default fallback location
fastify.decorateRequest("currentLocation", "Vaasa, Ostrobothnia, Finland");
```

### What I Learned
- **`decorateRequest(name, defaultValue)`** extends Fastify's core `Request` prototype
- Properties are defined **up-front** (not dynamically) for V8 hidden class optimization
- Decorators are **scoped to the plugin** and its children
- Each custom property must be declared explicitly

### Performance Note
> Declaring decorators up-front initializes consistent hidden classes in V8, ensuring high execution performance compared to dynamically attaching arbitrary properties (e.g., `request.myNewProp = value`) inside lifecycle hooks or route handlers.

### How I Used It
Defined two request properties:
1. `loggedTime` - Populated by the `onRequest` hook with the current timestamp
2. `currentLocation` - Default location, overridden in the hook

Accessed in route handlers via `request.loggedTime` and `request.currentLocation`.

---

## 4. Lifecycle Hooks (`addHook`)

**File:** `src/greetings-controllser.js` (lines 58-73)

```javascript
/**
 * `onRequest` is the very first hook fired when an HTTP request enters the server,
 * executing prior to parsing parameters, query strings, body payload, or route matching.
 */
fastify.addHook("onRequest", async (request, reply) => {
  // Populate/mutate the pre-decorated request instance properties for downstream routes
  request.loggedTime = new Date().toISOString();
  request.currentLocation = "Vaasa, Ostrobothnia, Finland";
});
```

### What I Learned
- **Hooks** intercept Fastify's internal execution lifecycle
- **`onRequest`** - First hook, runs before parsing params/query/body or route matching
- **Async handlers** implicitly return a Promise - **don't call `done()`** when using async/await
- Fastify resolves completion automatically when the async function completes

### Hook Execution Order (Key Ones)
```
onRequest → preParsing → preValidation → preHandler → handler → preSerialization → onSend → onResponse → onError → onClose
```

### How I Used It
Used `onRequest` to populate the request decorators (`loggedTime` and `currentLocation`) before any route handler executes, ensuring every request has these values available.

---

## 5. Application Life Cycle

Fastify's request/response lifecycle is a well-defined sequence of hooks that execute in a specific order. Understanding this flow is crucial for placing logic at the right lifecycle stage.

### Complete Request/Response Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FASTIFY REQUEST/RESPONSE LIFECYCLE                   │
└─────────────────────────────────────────────────────────────────────────────┘

  INCOMING REQUEST
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 1. onRequest                         │ ◄── FIRST: Request received
  │    • Runs before ANY parsing         │
  │    • No access to params, query, body│
  │    • Ideal for: auth checks, logging,│
  │      request decoration, rate limit  │
  └──────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 2. preParsing                        │
  │    • Raw body available              │
  │    • Can transform body before parse │
  └──────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 3. preValidation                     │
  │    • Runs after parsing, before      │
  │      schema validation               │
  │    • Can modify request before       │
  │      validation runs                 │
  └──────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 4. preHandler (Route-level hooks)    │
  │    • Runs after validation passes    │
  │    • Route-specific logic            │
  │    • Access to validated params/     │
  │      query/body                      │
  └──────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 5. HANDLER (Route function)          │ ◄── YOUR BUSINESS LOGIC
  │    • Main route implementation       │
  │    • Return value = response body    │
  │    • Or use reply.send()             │
  └──────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 6. preSerialization                  │
  │    • Runs before serialization       │
  │    • Can modify response payload     │
  │    • Runs for every response         │
  └──────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 7. onSend                            │
  │    • Runs for each response chunk    │
  │    • Can transform/modify response   │
  │    • Useful for compression,         │
  │      encryption, adding headers      │
  └──────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 8. onResponse                        │ ◄── LAST: Response sent
  │    • Runs after response is sent     │
  │    • Cannot modify response          │
  │    • Ideal for: cleanup, metrics,    │
  │      audit logging                   │
  └──────────────────────────────────────┘
       │
       ▼
  RESPONSE SENT TO CLIENT

  ─── ERROR PATH ───
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 9. onError                           │ ◄── Triggered on thrown errors
  │    • Receives (request, reply, error)│
  │    • Can transform error response    │
  │    • If no handler, Fastify defaults │
  └──────────────────────────────────────┘
       │
       ▼
  ┌──────────────────────────────────────┐
  │ 10. onClose                          │ ◄── Connection closed
  │    • Cleanup resources               │
  │    • Close DB connections, etc.      │
  └──────────────────────────────────────┘
```

### Hook Categories in This Project

| Hook | Used In | Purpose |
|------|---------|---------|
| `onRequest` | `greetings-controllser.js` | Populate request decorators with timestamp & location |
| `preHandler` | (Not used yet) | Route-specific pre-processing |
| `onSend` | (Not used yet) | Response transformation |
| `onResponse` | (Not used yet) | Post-response logging/metrics |
| `onError` | `books_controller.js` | Error logging via `fastify.log.error()` |
| `onClose` | (Not used yet) | Resource cleanup |

### Lifecycle Timing & Performance

| Phase | Timing | Use Case |
|-------|--------|----------|
| **onRequest** | Earliest | Auth, rate limiting, request ID generation |
| **preValidation** | After parse, before validate | Transform input, set defaults |
| **preHandler** | After validate | Load related data, permissions |
| **Handler** | Core logic | Business logic, DB queries |
| **preSerialization** | Before serialize | Modify output structure |
| **onSend** | During send | Compression, headers |
| **onResponse** | After send | Metrics, audit logs |
| **onError** | On throw | Custom error formatting |
| **onClose** | Connection end | Cleanup |

### Practical Example: Our `onRequest` Hook

```javascript
fastify.addHook("onRequest", async (request, reply) => {
  // This runs for EVERY request to /greetings/*
  // BEFORE route matching, BEFORE validation
  
  request.loggedTime = new Date().toISOString();    // Available in ALL routes
  request.currentLocation = "Vaasa, Ostrobothnia, Finland"; // Available in ALL routes
});
```

**Why `onRequest` and not `preHandler`?**
- `onRequest` runs even for routes that don't exist (404s)
- `preHandler` only runs for matched routes
- For cross-cutting concerns (logging, auth, decoration), `onRequest` is correct

---

## 6. Schema System: Validation & Serialization

**File:** `src/greetings-controllser.js` (lines 14-36, 126-160), `src/books_controller.js` (lines 62-114)

### Response Schema (Strict Output Filtering)

```javascript
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
```

### Full Route Schema (Input + Output) - Greeting Controller

```javascript
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
    200: { /* ... */ },
    500: { /* error response schema */ }
  },
}
```

### POST Body Schema - Books Controller

```javascript
const postRequestSchema = {
  body: {
    type: "object",
    properties: {
      book: { type: "object" },
    },
    required: ["book"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
      required: ["message"],
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
};
```

### What I Learned

Fastify uses **compiled JSON schemas** for high performance:

| Component | Purpose |
|-----------|---------|
| **Ajv** | Validates incoming request payloads (params, query, body, headers) |
| **fast-json-stringify** | Serializes outgoing responses up to **2x faster** than `JSON.stringify()` |

### ⚠️ CRITICAL SECURITY & SERIALIZATION RULE

> **Response schemas act as strict output filters.** Any property returned by a route handler that is **NOT explicitly declared** in `response[statusCode].properties` will be **automatically stripped** from the outgoing JSON response to prevent accidental data leaks.

### How I Used It
- Defined response schemas for all routes to enable fast-json-stringify serialization
- Added input validation for params, querystring, and body
- Ensured all returned properties are declared in the schema's `required` array
- Added error response schemas (500) for consistent error formatting

---

## 7. Route Definitions

### 7.1 Shorthand Method (`fastify.get`, `fastify.post`)

**File:** `src/greetings-controllser.js` (lines 81-87), `src/books_controller.js` (lines 123-135, 142-155)

```javascript
// GET shorthand
fastify.get("/", { schema: responseSchema }, async (request, reply) => {
  return {
    message: `Hello, world! from ${request.currentLocation}`,
    loggedTime: request.loggedTime,
  };
});

// POST shorthand
fastify.post("/", { schema: postRequestSchema }, async (request, reply) => {
  const book = request.body.book;
  const { query, values } = insertBookQuery(book);
  await fastify.mysql.execute(query, values);
  reply.status(200).send({ message: "Book inserted successfully" });
});
```

- **Registers route** at URL relative to plugin prefix
- Schema passed as second argument
- **Async handler** - direct return preferred over `reply.send()` for success, `reply.status().send()` for explicit status codes

### 7.2 Dynamic Path Parameters

**File:** `src/greetings-controllser.js` (lines 92-108)

```javascript
fastify.get("/:username", { schema: responseSchema }, async (request, reply) => {
  const { username } = request.params; // Auto-parsed by Fastify
  const { loggedTime, currentLocation } = request; // Access decorators

  return {
    message: `Hello, ${username}! from ${currentLocation}`,
    loggedTime: loggedTime,
  };
});
```

- Path parameters available at `request.params`
- Request decorators accessible directly on `request` object

### 7.3 Full Route Declaration (`fastify.route()`)

**File:** `src/greetings-controllser.js` (lines 117-173)

```javascript
fastify.route({
  method: "GET",
  url: "/full/:username",

  schema: {
    params: { /* ... */ },
    querystring: { /* ... */ },
    response: { /* ... */ },
  },

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
```

### What I Learned
- **Shorthand methods** (`get`, `post`, `put`, `delete`, `patch`) are syntactic sugar over `fastify.route()`
- **`fastify.route()`** provides complete control over:
  - Multi-part schema contracts (params, querystring, body, headers, response)
  - Route-level hooks (`preHandler`, `onRequest`)
  - Custom constraints
  - Metadata config

### How I Used It
Demonstrated all approaches:
1. Simple GET with shorthand (`/greetings/`)
2. Dynamic params with shorthand (`/greetings/:username`)
3. Full declaration with complete schema validation (`/greetings/full/:username`)
4. POST with body validation (`/books/`)

---

## 8. Route Prefix & Encapsulation

**File:** `src/index.js` (lines 51-52)

```javascript
fastify.register(greetingController, { prefix: "/greetings" });
fastify.register(books_controller, { prefix: "/books" });
```

### What I Learned
- **Prefix option** automatically prepends to all routes in the plugin
- Routes in `greetingController`:
  - `/` → `/greetings/`
  - `/:username` → `/greetings/:username`
  - `/full/:username` → `/greetings/full/:username`
- Routes in `books_controller`:
  - `/` → `/books/` (GET and POST)
- **Encapsulation** creates a child context - changes don't affect parent
- Plugins registered later inherit decorators from earlier plugins

### How I Used It
Registered plugins with prefixes for clean API namespacing:
- All greeting endpoints under `/greetings`
- All book endpoints under `/books`

---

## 9. Database Integration (`@fastify/mysql`)

**File:** `src/index.js` (lines 17-37), `src/books_controller.js` (lines 16-45, 123-155)

### Plugin Registration

```javascript
fastify.register(fastifyMySQL, {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "BeTheMan@123",
  database: "bookstore",
  promise: true,          // Enables native async/await support
  connectionLimit: 10,    // Max active connections in pool
});
```

### Architecture & Pool Mechanics

| Aspect | Description |
|--------|-------------|
| **Connection Pool** | Passing config object auto-creates MySQL connection pool |
| **Decorator Injection** | `@fastify/mysql` decorates root `fastify` with `fastify.mysql` |
| **Downstream Access** | Available to all child plugins registered AFTER this point |
| **Promise Support** | `promise: true` enables `mysql2/promise` for async/await |

### Parameterized Query Helper

```javascript
const insertBookQuery = (book) => {
  const query = `INSERT INTO books (
      title, author, published_date, url, cover_image_url,
      isbn, genre, page_count, price, description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

  const values = [
    book.title,
    book.author,
    book.published_date || null,
    book.url || null,
    book.cover_image_url || null,
    book.isbn || null,
    book.genre || null,
    book.page_count || null,
    book.price || null,
    book.description || null,
  ];

  return { query, values };
};
```

### SQL Injection Prevention

> **Using positional placeholders (`?`)** ensures MySQL treats incoming data as literal values rather than executable SQL code, completely neutralizing SQL injection attacks.

### Nullish Coalescing / Default Value Mapping

> MySQL drivers often require explicit `null` for omitted optional fields when inserted into nullable columns. Using `|| null` ensures missing properties map cleanly to SQL `NULL` instead of causing `undefined` execution errors.

### Route Integration

```javascript
// GET /books - Fetch all books
fastify.get("/", { schema: responseSchema }, async (request, reply) => {
  try {
    const [books] = await fastify.mysql.execute("SELECT * FROM books");
    return { books: books };
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
  }
});

// POST /books - Insert new book
fastify.post("/", { schema: postRequestSchema }, async (request, reply) => {
  try {
    const book = request.body.book;
    const { query, values } = insertBookQuery(book);
    await fastify.mysql.execute(query, values);
    reply.status(200).send({ message: "Book inserted successfully" });
  } catch (error) {
    fastify.log.error(error);
    reply.status(500).send({ error: "Internal Server Error" });
  }
});
```

---

## 10. Summary of Key Takeaways

| Concept | Key Insight |
|---------|-------------|
| **Plugin Architecture** | Encapsulation via child contexts; prefix for route organization |
| **Decorators** | Define up-front for V8 optimization; scoped to plugin |
| **Hooks** | `onRequest` runs first; async = no `done()` needed |
| **Lifecycle** | 10 phases from `onRequest` to `onClose`; pick the right phase |
| **Schema** | Response schemas = strict output filters (security!) |
| **Serialization** | fast-json-stringify ≈ 2x faster than JSON.stringify |
| **Routes** | Shorthand for simple cases; `route()` for full control |
| **Database** | Connection pool auto-created; parameterized queries prevent SQL injection |
| **Error Handling** | Try/catch in handlers; `onError` hook for global handling |

---

## 11. Running the Project

```bash
# Install dependencies
pnpm install

# Start server
pnpm start       # Runs on port 3000
pnpm dev         # Auto-reload with nodemon
```

### Test Endpoints

```bash
# Greeting endpoints
# Base greeting
curl http://localhost:3000/greetings/

# With username param
curl http://localhost:3000/greetings/John

# Full route with query string
curl "http://localhost:3000/greetings/full/John?lastName=Doe"

# Book endpoints (requires MySQL running with bookstore database)
# Get all books
curl http://localhost:3000/books/

# Insert new book
curl -X POST http://localhost:3000/books/ \
  -H "Content-Type: application/json" \
  -d '{"book": {"title": "The Great Gatsby", "author": "F. Scott Fitzgerald", "genre": "Fiction"}}'
```

---