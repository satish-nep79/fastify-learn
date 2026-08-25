/**
 * Database Helper: Parameterized Query Construction
 *
 * SQL Injection Prevention:
 * Using positional placeholders (`?`) ensures MySQL treats incoming data as literal values
 * rather than executable SQL code, completely neutralizing SQL injection attacks.
 *
 * Nullish Coalescing / Default Value Mapping:
 * MySQL drivers often require explicit `null` for omitted optional fields when inserted into
 * nullable columns. Using `|| null` ensures missing properties map cleanly to SQL `NULL`
 * instead of causing `undefined` execution errors.
 *
 * @param {Object} book - Book entity object from request payload.
 * @returns {{ query: string, values: Array }} Prepared SQL statement and ordered parameters.
 */
const insertBookQuery = (book) => {
  const query = `INSERT INTO books (
      title,
      author,
      published_date,
      url,
      cover_image_url,
      isbn,
      genre,
      page_count,
      price,
      description
    )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

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

/**
 * Fastify Controller Plugin: Books Resource
 *
 * Handles HTTP operations for book entities (`GET /`, `POST /`).
 * Demonstrates MySQL pool integration (`@fastify/mysql`), schema contracts,
 * and try-catch async error handling.
 */
const books_controller = (fastify, options, done) => {
  /**
   * Schema: GET Response Definition
   *
   * Fastify uses fast-json-stringify for rapid response serialization.
   * Defining response schemas ensures high throughput and prevents data leaks by
   * stripping unlisted object properties.
   */
  const responseSchema = {
    response: {
      200: {
        type: "object",
        properties: {
          books: { type: "array" },
        },
        required: ["books"],
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

  /**
   * Schema: POST Payload & Response Validation
   *
   * 1. `body` validation is powered by Ajv. Malformed incoming payloads fail automatically
   *    with HTTP 400 Bad Request before hitting the route handler.
   * 2. `response` schema guarantees structural integrity of outcoming message contracts.
   */
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

  /**
   * Route: Fetch All Books (`GET /`)
   *
   * `@fastify/mysql` Integration:
   * Decorates `fastify` with `fastify.mysql` (a MySQL connection pool).
   * `.execute()` uses prepared statements under the hood for faster query plan execution.
   */
  fastify.get("/", { schema: responseSchema }, async (request, reply) => {
    try {
      // MySQL `execute` returns a tuple `[rows, fields]`. We destructure to extract rows array.
      const [books] = await fastify.mysql.execute("SELECT * FROM books");
      
      // Returning JS object triggers fast-json-stringify automatically
      return { books: books };
    } catch (error) {
      // Fastify built-in Pino logger handles error stack tracing
      fastify.log.error(error);
      reply.status(500).send({ error: "Internal Server Error" });
    }
  });

  /**
   * Route: Insert New Book (`POST /`)
   *
   * Consumes validated request body payload and executes parameterized insert.
   */
  fastify.post("/", { schema: postRequestSchema }, async (request, reply) => {
    try {
      const book = request.body.book;
      const { query, values } = insertBookQuery(book);

      // Execute parameter substitution securely
      await fastify.mysql.execute(query, values);
      
      reply.status(200).send({ message: "Book inserted successfully" });
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: "Internal Server Error" });
    }
  });

  // Signals completion of synchronous plugin registration
  done();
};

export default books_controller;