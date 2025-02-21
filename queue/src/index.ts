export interface Env {
	northwind_inventory_queue: Queue<any>;
	DB: D1Database;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const corsHeaders = getCorsHeaders();
		if (handleOptionsRequest(request, corsHeaders)) {
			return new Response('OK', {
				headers: corsHeaders,
			});
		}
		const { pathname } = new URL(request.url);
		if (pathname !== '/') {
			return Response.json('Not found', { status: 404, headers: { ...corsHeaders } });
		}

		try {
			let body = (await request.json()) as
				| { updateInventoryBy: number; productId: number }
				| { updateInventoryBy: number; productId: number }[];
			if (!Array.isArray(body)) {
				body = [body];
			}
			let productUpdates = body.map((update) => {
				return {
					body: {
						updateInventoryBy: update.updateInventoryBy,
						productId: update.productId,
					},
				};
			});

			await env.northwind_inventory_queue.sendBatch(productUpdates);
			return Response.json('Success', { headers: { ...corsHeaders } });
		} catch (e) {
			return Response.json('Error', { status: 500, headers: { ...corsHeaders } });
		}
	},

	async queue(batch, env): Promise<void> {
		const start = Date.now();

		const updates = batch.messages.reduce((acc, message) => {
			const body = message.body as { updateInventoryBy: number; productId: number };
			const { updateInventoryBy, productId } = body;
			const retryCount = message.attempts;
			// console.log(`Processing product ID: ${productId}, update inventory by ${updateInventoryBy}. Attempt count: ${retryCount}`);
			if (!acc[productId]) {
				acc[productId] = 0;
			}
			acc[productId] += updateInventoryBy;
			return acc;
		}, {} as Record<number, number>);

		const stmt = env.DB.prepare(`UPDATE Product SET UnitsInStock = max(UnitsInStock + ?, 0) WHERE Id = ?`);

		const statements = Object.entries(updates).map(([productId, totalUpdate]) => stmt.bind(totalUpdate, productId));

		await env.DB.batch(statements);

		const end = Date.now();

		console.log(`Batch size: ${batch.messages.length}, Updates size: ${Object.keys(updates).length}, Time taken: ${end - start}ms`);
	},
} satisfies ExportedHandler<Env>;

function getCorsHeaders() {
	return {
		'Access-Control-Allow-Headers': '*',
		'Access-Control-Allow-Methods': 'POST',
		'Access-Control-Allow-Origin': '*',
	};
}

function handleOptionsRequest(request: Request, corsHeaders: HeadersInit): boolean {
	if (request.method === 'OPTIONS') {
		return true;
	}
	return false;
}
