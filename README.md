# A&A Online Services

A React customer service desk and an Express API for print and Xerox orders, applications, enquiries, order tracking and staff fulfilment. The homepage calculator uses the same browser pricing function as checkout. The API computes the order total and the order number survives a cancelled checkout within the current page.

## Start an isolated shop

Use Node 24. In a new Supabase project run `backend/db/new-supabase.sql` once. It creates the tables, server-only access, private file bucket and starter catalogue. Create a staff record with a unique email, a bcrypt password hash and an active flag using a trusted administrator connection. There is no default staff password.

Set server-only variables `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and a strong random `JWT_SECRET` on the API host. Set `FRONTEND_URLS` to the exact allowed storefront origins, separated by commas. Optional Razorpay checkout uses `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET`. Use test mode for staging and configure the matching webhook at `/api/payments/webhook`. Orders and enquiries can be saved before payment is enabled.

Run `npm ci && npm start` in `backend` and `npm ci && npm run dev` in `frontend`. Vite proxies local API calls to port 5000. For Vercel, select the frontend root, Vite preset and dist output. Set `VITE_API_URL` to the production API URL including /api. Set `VITE_PREVIEW_API_URL` to a dedicated test API for previews. An unconnected Vercel preview blocks API calls before files or customer details are transmitted.

Run `npm test` in backend and `npm run lint && npm run build` in frontend. The workflow test launches the actual Express API against a synthetic HTTP fixture for Supabase and never contacts Razorpay. Before release test a private staging file upload, staff download, paid/failed test payment and signed provider webhook. Verify backup restoration, retention, shop pickup details and operational support with the shop owner before accepting real orders. The delete_at metadata alone does not remove stored files.
