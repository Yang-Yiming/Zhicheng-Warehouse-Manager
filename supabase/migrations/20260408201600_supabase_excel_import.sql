create or replace function public.replace_imported_data(
  p_mode text,
  p_operations jsonb default '[]'::jsonb,
  p_inventory jsonb default '[]'::jsonb,
  p_actor_openid text default '',
  p_actor_name text default ''
)
returns jsonb
language plpgsql
as $$
declare
  op jsonb;
  inv jsonb;
  op_openid text;
  matched_openid text;
  matched_openid_count integer;
  imported_operations integer := 0;
  imported_inventory integer := 0;
  current_time timestamptz := timezone('utc', now());
  current_time_text text := to_char(timezone('asia/shanghai', now()), 'YYYY-MM-DD HH24:MI');
begin
  if p_mode not in ('full', 'old_inventory') then
    raise exception '未知的导入模式: %', p_mode;
  end if;

  delete from public.inventory;
  delete from public.operations;

  if p_mode = 'full' then
    for op in
      select value
      from jsonb_array_elements(coalesce(p_operations, '[]'::jsonb))
    loop
      op_openid := nullif(btrim(coalesce(op->>'operatorOpenid', '')), '');
      if op_openid is null then
        select min(openid), count(*)
          into matched_openid, matched_openid_count
        from public.users
        where display_name = nullif(btrim(coalesce(op->>'operator', '')), '');

        if matched_openid_count = 1 then
          op_openid := matched_openid;
        end if;
      end if;

      if op_openid is null or not exists (select 1 from public.users where openid = op_openid) then
        op_openid := p_actor_openid;
      end if;

      insert into public.operations (
        submit_time,
        item_id,
        item_name,
        operation,
        organization,
        quantity,
        operation_time,
        operator,
        submitter,
        operator_openid
      ) values (
        coalesce(nullif(op->>'submitTime', '')::timestamptz, current_time),
        btrim(coalesce(op->>'itemId', '')),
        btrim(coalesce(op->>'itemName', '')),
        btrim(coalesce(op->>'operation', '')),
        btrim(coalesce(op->>'organization', '')),
        greatest(coalesce((op->>'quantity')::integer, 0), 0),
        btrim(coalesce(op->>'operationTime', '')),
        coalesce(nullif(btrim(coalesce(op->>'operator', '')), ''), p_actor_name),
        coalesce(nullif(btrim(coalesce(op->>'submitter', '')), ''), coalesce(nullif(btrim(coalesce(op->>'operator', '')), ''), p_actor_name)),
        op_openid
      );

      imported_operations := imported_operations + 1;
    end loop;

    for inv in
      select value
      from jsonb_array_elements(coalesce(p_inventory, '[]'::jsonb))
    loop
      insert into public.inventory (
        item_id,
        item_name,
        organization,
        quantity,
        last_operation,
        last_operator,
        last_operation_time,
        notes,
        updated_at
      ) values (
        btrim(coalesce(inv->>'itemId', '')),
        btrim(coalesce(inv->>'itemName', '')),
        btrim(coalesce(inv->>'organization', '')),
        greatest(coalesce((inv->>'quantity')::integer, 0), 0),
        coalesce(nullif(btrim(coalesce(inv->>'lastOperation', '')), ''), '入库'),
        coalesce(nullif(btrim(coalesce(inv->>'lastOperator', '')), ''), p_actor_name),
        coalesce(nullif(btrim(coalesce(inv->>'lastOperationTime', '')), ''), current_time_text),
        coalesce(inv->>'notes', ''),
        current_time
      );

      imported_inventory := imported_inventory + 1;
    end loop;
  elsif p_mode = 'old_inventory' then
    for inv in
      select value
      from jsonb_array_elements(coalesce(p_inventory, '[]'::jsonb))
    loop
      insert into public.inventory (
        item_id,
        item_name,
        organization,
        quantity,
        last_operation,
        last_operator,
        last_operation_time,
        notes,
        updated_at
      ) values (
        btrim(coalesce(inv->>'itemId', '')),
        btrim(coalesce(inv->>'itemName', '')),
        btrim(coalesce(inv->>'organization', '')),
        greatest(coalesce((inv->>'quantity')::integer, 0), 0),
        '入库',
        p_actor_name,
        current_time_text,
        coalesce(inv->>'notes', ''),
        current_time
      );

      insert into public.operations (
        submit_time,
        item_id,
        item_name,
        operation,
        organization,
        quantity,
        operation_time,
        operator,
        submitter,
        operator_openid
      ) values (
        current_time,
        btrim(coalesce(inv->>'itemId', '')),
        btrim(coalesce(inv->>'itemName', '')),
        '入库',
        btrim(coalesce(inv->>'organization', '')),
        greatest(coalesce((inv->>'quantity')::integer, 0), 0),
        current_time_text,
        p_actor_name,
        p_actor_name,
        p_actor_openid
      );

      imported_inventory := imported_inventory + 1;
      imported_operations := imported_operations + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'importedOperations', imported_operations,
    'importedInventory', imported_inventory
  );
end;
$$;
