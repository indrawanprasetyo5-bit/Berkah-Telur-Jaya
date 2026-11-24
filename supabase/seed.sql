-- Data contoh 7 hari. Jalankan setelah schema.sql.
-- Akun demo (password demo1234): owner@berkahtelurjaya.demo, staff@berkahtelurjaya.demo

do $$
declare
  v_owner_id uuid := '11111111-1111-4111-8111-111111111111';
  v_staff_id uuid := '22222222-2222-4222-8222-222222222222';

  v_egg_negeri uuid := 'aaaa1111-1111-4111-8111-111111111111';
  v_egg_omega  uuid := 'aaaa2222-2222-4222-8222-222222222222';
  v_egg_kampung uuid := 'aaaa3333-3333-4333-8333-333333333333';
  v_egg_bebek  uuid := 'aaaa4444-4444-4444-8444-444444444444';

  v_day_offset int;
  v_sale_id uuid;
  v_today_wib date := (now() at time zone 'Asia/Jakarta')::date;
  v_base_ts timestamptz;
  v_closing_date date;
  v_cash_sales numeric(12, 2);
  v_qris_sales numeric(12, 2);
  v_transfer_sales numeric(12, 2);
  v_total_rev numeric(12, 2);
  v_total_cost numeric(12, 2);
  v_total_exp numeric(12, 2);
  v_total_loss numeric(12, 2);
begin
  -- Akun demo
  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  values
    (
      v_owner_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'owner@berkahtelurjaya.demo',
      crypt('demo1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Pak Budi Santoso"}'::jsonb,
      now() - interval '30 days',
      now(),
      '', '', '', ''
    ),
    (
      v_staff_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'staff@berkahtelurjaya.demo',
      crypt('demo1234', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Lala"}'::jsonb,
      now() - interval '30 days',
      now(),
      '', '', '', ''
    )
  on conflict (id) do nothing;

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values
    (
      v_owner_id,
      v_owner_id,
      'owner@berkahtelurjaya.demo',
      jsonb_build_object('sub', v_owner_id::text, 'email', 'owner@berkahtelurjaya.demo'),
      'email',
      now(),
      now() - interval '30 days',
      now()
    ),
    (
      v_staff_id,
      v_staff_id,
      'staff@berkahtelurjaya.demo',
      jsonb_build_object('sub', v_staff_id::text, 'email', 'staff@berkahtelurjaya.demo'),
      'email',
      now(),
      now() - interval '30 days',
      now()
    )
  on conflict do nothing;

  insert into public.profiles (id, full_name, role, whatsapp_number)
  values
    (v_owner_id, 'Pak Budi Santoso', 'owner', '6281234567801'),
    (v_staff_id, 'Lala', 'staff', '6281234567802')
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = excluded.role,
        whatsapp_number = excluded.whatsapp_number;

  -- Hapus data lama supaya seed bisa dijalankan ulang.
  delete from public.daily_closings;
  delete from public.expenses;
  delete from public.stock_losses;
  delete from public.restock_deliveries;
  delete from public.sales;

  -- Jenis telur
  insert into public.egg_types (
    id, name, price_per_kg, cost_per_kg, stock_kg, min_stock_kg, kg_per_peti, distributor_wa, is_active
  )
  values
    (v_egg_negeri,  'Telur Ayam Negeri',  28500, 25500, 180.00, 30.00, 15.00, '6281390001122', true),
    (v_egg_omega,   'Telur Omega 3',      34000, 29500,  90.00, 20.00, 15.00, '6281390001122', true),
    (v_egg_kampung, 'Telur Ayam Kampung', 48000, 41000,  35.00, 10.00, 10.00, '6281390003344', true),
    (v_egg_bebek,   'Telur Bebek Mentah', 38000, 32500,  55.00, 15.00, 15.00, '6281390003344', true)
  on conflict (id) do update
    set name = excluded.name,
        price_per_kg = excluded.price_per_kg,
        cost_per_kg = excluded.cost_per_kg,
        min_stock_kg = excluded.min_stock_kg,
        kg_per_peti = excluded.kg_per_peti,
        distributor_wa = excluded.distributor_wa,
        is_active = excluded.is_active;

  -- Kiriman restock
  insert into public.restock_deliveries (
    egg_type_id, peti_count, qty_kg, cost_per_kg, supplier_name, driver_name, broken_kg, notes, received_by, created_at
  )
  values
    (
      v_egg_negeri, 6, 90.00, 25000, 'Agen Telur Blitar Jaya', 'Mas Slamet', 0.75,
      'Kiriman pagi, setengah kilo lebih retak di peti paling bawah.', v_staff_id,
      ((v_today_wib - 6)::timestamp + interval '07 hours 15 minutes') at time zone 'Asia/Jakarta'
    ),
    (
      v_egg_omega, 3, 45.00, 29500, 'Agen Telur Blitar Jaya', 'Mas Slamet', 0.25,
      'Kondisi bagus, cangkang bersih.', v_staff_id,
      ((v_today_wib - 4)::timestamp + interval '08 hours 05 minutes') at time zone 'Asia/Jakarta'
    ),
    (
      v_egg_negeri, 5, 75.00, 25500, 'Peternakan Kendal Makmur', 'Pak Darto', 0.50,
      'Harga modal naik Rp 500/kg dari minggu lalu.', v_owner_id,
      ((v_today_wib - 2)::timestamp + interval '07 hours 40 minutes') at time zone 'Asia/Jakarta'
    );

  -- Penjualan 7 hari terakhir
  for v_day_offset in reverse 6..0 loop
    v_base_ts := ((v_today_wib - v_day_offset)::timestamp) at time zone 'Asia/Jakarta';

    v_sale_id := gen_random_uuid();
    insert into public.sales (id, cashier_id, total_amount, total_cost, payment_method, cash_received, change_amount, created_at)
    values (v_sale_id, v_staff_id, 28500, 25500, 'cash', 50000, 21500, v_base_ts + interval '07 hours 35 minutes');

    insert into public.sale_items (sale_id, egg_type_id, qty_kg, unit_label, is_cracked, price_per_kg, cost_per_kg, subtotal)
    values (v_sale_id, v_egg_negeri, 1.00, '1 kg', false, 28500, 25500, 28500);

    v_sale_id := gen_random_uuid();
    insert into public.sales (id, cashier_id, total_amount, total_cost, payment_method, cash_received, change_amount, created_at)
    values (v_sale_id, v_staff_id, 20000, 17850, 'cash', 20000, 0, v_base_ts + interval '08 hours 50 minutes');

    insert into public.sale_items (sale_id, egg_type_id, qty_kg, unit_label, is_cracked, price_per_kg, cost_per_kg, subtotal)
    values (v_sale_id, v_egg_negeri, 0.70, 'Rp 20rb', false, 28500, 25500, 20000);

    v_sale_id := gen_random_uuid();
    insert into public.sales (id, cashier_id, total_amount, total_cost, payment_method, cash_received, change_amount, created_at)
    values (v_sale_id, v_staff_id, 85200, 73600, 'qris', 0, 0, v_base_ts + interval '10 hours 40 minutes');

    insert into public.sale_items (sale_id, egg_type_id, qty_kg, unit_label, is_cracked, price_per_kg, cost_per_kg, subtotal)
    values
      (v_sale_id, v_egg_omega,   1.80, '1 Tray (~1.8 kg)', false, 34000, 29500, 61200),
      (v_sale_id, v_egg_kampung, 0.50, '1/2 kg',           false, 48000, 41000, 24000);

    -- Pembelian per peti cuma di hari genap supaya grafiknya bervariasi.
    if v_day_offset % 2 = 0 then
      v_sale_id := gen_random_uuid();
      insert into public.sales (id, cashier_id, total_amount, total_cost, payment_method, cash_received, change_amount, created_at)
      values (v_sale_id, v_owner_id, 427500, 382500, 'transfer', 0, 0, v_base_ts + interval '13 hours 15 minutes');

      insert into public.sale_items (sale_id, egg_type_id, qty_kg, unit_label, is_cracked, price_per_kg, cost_per_kg, subtotal)
      values (v_sale_id, v_egg_negeri, 15.00, '1 Peti (15 kg)', false, 28500, 25500, 427500);
    else
      v_sale_id := gen_random_uuid();
      insert into public.sales (id, cashier_id, total_amount, total_cost, payment_method, cash_received, change_amount, created_at)
      values (v_sale_id, v_staff_id, 133000, 116000, 'cash', 150000, 17000, v_base_ts + interval '13 hours 30 minutes');

      insert into public.sale_items (sale_id, egg_type_id, qty_kg, unit_label, is_cracked, price_per_kg, cost_per_kg, subtotal)
      values
        (v_sale_id, v_egg_negeri, 2.00, '2 kg', false, 28500, 25500, 57000),
        (v_sale_id, v_egg_bebek,  2.00, '2 kg', false, 38000, 32500, 76000);
    end if;

    v_sale_id := gen_random_uuid();
    insert into public.sales (id, cashier_id, total_amount, total_cost, payment_method, cash_received, change_amount, created_at)
    values (v_sale_id, v_staff_id, 20000, 25500, 'cash', 20000, 0, v_base_ts + interval '16 hours 20 minutes');

    insert into public.sale_items (sale_id, egg_type_id, qty_kg, unit_label, is_cracked, price_per_kg, cost_per_kg, subtotal)
    values (v_sale_id, v_egg_negeri, 1.00, 'Retak (1 kg)', true, 20000, 25500, 20000);

    insert into public.expenses (amount, category, notes, recorded_by, created_at)
    values
      (12000, 'plastik',  'Plastik kresek ukuran sedang 1 pack', v_staff_id, v_base_ts + interval '09 hours 15 minutes'),
      ( 5000, 'parkir',   'Retribusi kebersihan & parkir toko', v_staff_id, v_base_ts + interval '14 hours 00 minutes');

    if v_day_offset in (5, 2, 0) then
      insert into public.expenses (amount, category, notes, recorded_by, created_at)
      values (18000, 'konsumsi', 'Makan siang & es teh staff kasir', v_staff_id, v_base_ts + interval '12 hours 30 minutes');
    end if;
  end loop;

  -- Telur pecah/busuk
  insert into public.stock_losses (egg_type_id, qty_kg, cost_loss, reason, recorded_by, created_at)
  values
    (v_egg_negeri,  0.50, 12750, 'pecah_lapak', v_staff_id, ((v_today_wib - 5)::timestamp + interval '15 hours 10 minutes') at time zone 'Asia/Jakarta'),
    (v_egg_omega,   0.30,  8850, 'pecah_lapak', v_staff_id, ((v_today_wib - 3)::timestamp + interval '11 hours 45 minutes') at time zone 'Asia/Jakarta'),
    (v_egg_kampung, 0.25, 10250, 'busuk',       v_owner_id, ((v_today_wib - 1)::timestamp + interval '16 hours 05 minutes') at time zone 'Asia/Jakarta');

  -- Tutup kasir, hari ini sengaja belum ditutup
  for v_day_offset in reverse 6..1 loop
    v_closing_date := (v_today_wib - v_day_offset);

    select
      coalesce(sum(case when payment_method = 'cash' then total_amount else 0 end), 0),
      coalesce(sum(case when payment_method = 'qris' then total_amount else 0 end), 0),
      coalesce(sum(case when payment_method = 'transfer' then total_amount else 0 end), 0),
      coalesce(sum(total_amount), 0),
      coalesce(sum(total_cost), 0)
    into v_cash_sales, v_qris_sales, v_transfer_sales, v_total_rev, v_total_cost
    from public.sales
    where (created_at at time zone 'Asia/Jakarta')::date = v_closing_date;

    select coalesce(sum(amount), 0)
    into v_total_exp
    from public.expenses
    where (created_at at time zone 'Asia/Jakarta')::date = v_closing_date;

    select coalesce(sum(cost_loss), 0)
    into v_total_loss
    from public.stock_losses
    where (created_at at time zone 'Asia/Jakarta')::date = v_closing_date;

    insert into public.daily_closings (
      closing_date,
      expected_cash,
      actual_cash,
      total_expenses,
      qris_total,
      transfer_total,
      total_revenue,
      total_profit,
      notes,
      closed_by,
      created_at
    )
    values (
      v_closing_date,
      v_cash_sales - v_total_exp,
      case when v_day_offset = 3 then (v_cash_sales - v_total_exp - 2000) else (v_cash_sales - v_total_exp) end,
      v_total_exp,
      v_qris_sales,
      v_transfer_sales,
      v_total_rev,
      v_total_rev - v_total_cost - v_total_exp - v_total_loss,
      case when v_day_offset = 3 then 'Selisih kurang Rp 2.000 (kembalian receh).' else 'Laci cocok 100%.' end,
      v_staff_id,
      (v_closing_date::timestamp + interval '17 hours 30 minutes') at time zone 'Asia/Jakarta'
    )
    on conflict (closing_date) do update
      set expected_cash = excluded.expected_cash,
          actual_cash = excluded.actual_cash,
          total_expenses = excluded.total_expenses,
          qris_total = excluded.qris_total,
          transfer_total = excluded.transfer_total,
          total_revenue = excluded.total_revenue,
          total_profit = excluded.total_profit,
          notes = excluded.notes,
          closed_by = excluded.closed_by;
  end loop;

  -- Ayam Negeri sengaja di bawah minimum supaya banner stok kritis muncul.
  update public.egg_types set stock_kg = 22.50 where id = v_egg_negeri;
  update public.egg_types set stock_kg = 42.00 where id = v_egg_omega;
  update public.egg_types set stock_kg = 11.50 where id = v_egg_kampung;
  update public.egg_types set stock_kg = 26.00 where id = v_egg_bebek;
end $$;
