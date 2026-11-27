-- Bootstrap an EMPTY, dedicated Supabase project. Existing shop databases need a reviewed migration.
begin;
create table public.admin_users (
 id uuid primary key default gen_random_uuid(), email text unique not null,
 name text not null, password_hash text not null, active boolean not null default true
);
create table public.services (
 id uuid primary key default gen_random_uuid(), name text not null, category text not null,
 description text, pricing_type text, price numeric(12,2), unit text, active boolean default true,
 created_at timestamptz not null default now()
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), order_number text unique not null, customer_name text not null,
 phone text not null, customer_email text, service_id uuid references public.services(id), service text,
 copies integer, color_mode text, sides text, binding text, lamination boolean, spiral_binding boolean,
 notes text, status text not null default 'received', payment_status text not null default 'pending',
 amount numeric(12,2) not null check(amount>=0), paid_amount numeric(12,2), paid_at timestamptz,
 razorpay_order_id text, razorpay_payment_id text unique, document_path text, delete_at timestamptz,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.service_applications (
 id uuid primary key default gen_random_uuid(), order_id uuid unique not null references public.orders on delete cascade,
 application_type text not null, application_name text not null, notification_number text, notification_pdf_url text,
 application_start_date date, application_end_date date, government_fee numeric(12,2), service_fee numeric(12,2),
 total_amount numeric(12,2), application_status text, customer_details jsonb, admin_notes text, submitted_at timestamptz,
 completed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now()
);
create table public.order_documents (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders on delete cascade,
 application_id uuid references public.service_applications on delete cascade, original_name text not null, storage_path text unique not null,
 file_type text, file_size bigint, pages integer, copies integer, service_type text, service_name text, color_mode text,
 sides text, amount numeric(12,2), required_document_name text, document_category text, is_application_document boolean default false,
 delete_at timestamptz, created_at timestamptz default now()
);
create index on public.order_documents(order_id);
create table public.enquiries (
 id uuid primary key default gen_random_uuid(), enquiry_number text unique not null, customer_name text not null, phone text not null,
 email text, category text, subject text, message text, status text default 'new', admin_reply text,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.admin_users enable row level security;
alter table public.services enable row level security;
alter table public.orders enable row level security;
alter table public.service_applications enable row level security;
alter table public.order_documents enable row level security;
alter table public.enquiries enable row level security;
revoke all on public.admin_users,public.services,public.orders,public.service_applications,public.order_documents,public.enquiries from anon,authenticated;
grant select,insert,update,delete on public.admin_users,public.services,public.orders,public.service_applications,public.order_documents,public.enquiries to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('aa-order-documents','aa-order-documents',false,10485760);
insert into public.services(name,category,description,pricing_type,price,unit) values
 ('Document printing','printing','Black & white and colour document printing','per_unit',2,'page'),
 ('Xerox copies','xerox','Black & white and colour photocopies','per_unit',5,'first page'),
 ('Application assistance','applications','Job and scholarship application assistance','fixed',100,'application');
commit;
