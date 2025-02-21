import { prepareStatements } from "../tools";

const apiSearch = () => {
  return {
    path: "search",
    method: "GET",
    handler: async (request: Request, env: Env, ctx: ExecutionContext) => {
      const startTimeCache = Date.now();

      const { searchParams } = new URL(request.url);
      const q = searchParams.get("q");
      const table = searchParams.get("table");
      const categoryId = searchParams.get("categoryId");
      const sortBy = searchParams.get("sortBy");
      const sortOrder = searchParams.get("sortOrder") || "asc"; // default to ascending order
      const itemsPerPage = 50;

      const cacheKey = `search:${q}:${categoryId}:${sortBy}:${sortOrder}`;
      const cached = await env.PRODUCT_SEARCH_CACHE.get(cacheKey);
      if (cached) {
        const cachedResults = JSON.parse(cached);
        return {
          items: cachedResults.length,
          stats: {
            overallTimeMs: Date.now() - startTimeCache,
          },
          results: cachedResults,
        };
      }

      let query = "";
      let params: (string | number)[] = [itemsPerPage, `%${q}%`];

      if (table === "products") {
        query =
          "SELECT Id, ProductName, SupplierId, CategoryId, QuantityPerUnit, UnitPrice, UnitsInStock, UnitsOnOrder, ReorderLevel, Discontinued FROM Product WHERE ProductName LIKE ?2";
        if (categoryId) {
          query += " AND CategoryId = ?3";
          params.push(Number(categoryId));
        }
        if (sortBy) {
          query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
        }
        query += " LIMIT ?1";
      } else {
        query =
          "SELECT Id, CompanyName, ContactName, ContactTitle, Address, City, Region, PostalCode, Country, Phone, Fax FROM Customer WHERE CompanyName LIKE ?2 OR ContactName LIKE ?2 OR ContactTitle LIKE ?2 OR Address LIKE ?2";
        if (sortBy) {
          query += ` ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;
        }
        query += " LIMIT ?1";
      }

      const [stmts, sql] = prepareStatements(env.DB, false, [query], [params]);

      let errorMessage = "";

      for (let i = 0; i < 5; i++) {
        try {
          const search = await (stmts[0] as D1PreparedStatement).all();

          ctx.waitUntil(
            env.PRODUCT_SEARCH_CACHE.put(
              cacheKey,
              JSON.stringify(search.results),
              { expirationTtl: 300 }
            )
          );

          return {
            items: search.results.length,
            stats: {
              overallTimeMs: Date.now() - startTimeCache,
            },
            results: search.results,
          };
        } catch (e: any) {
          errorMessage = e.toString();
          await new Promise((r) => setTimeout(r, 100));
        }
      }
      return { error: 500, msg: errorMessage };
    },
  };
};

export { apiSearch };
