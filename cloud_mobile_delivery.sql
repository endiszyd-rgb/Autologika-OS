-- Jednorazowo uruchom w Supabase SQL Editor jako właściciel projektu.
-- Wymaga istniejącej tabeli public.sync_records z cloud_schema_supabase.sql.
-- Cała dostawa (stany i historia) jest zatwierdzana w jednej transakcji.
create or replace function public.import_mobile_delivery(p_hash text,p_document jsonb,p_file jsonb,p_device text default 'ios')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
 owner_id uuid:=auth.uid(); item jsonb; existing public.sync_records; history public.sync_records;
 part_id text; code text; part_name text; quantity numeric; cost numeric; old_stock numeric; old_cost numeric;
 stock numeric; next_payload jsonb; line_count integer:=0; total_quantity numeric:=0; created_count integer:=0; updated_count integer:=0;
 doc_no text:=trim(coalesce(p_document->>'document_no','')); supplier text:=trim(coalesce(p_document->>'supplier_name',''));
 normalized text; match_count integer; result jsonb; stamp timestamptz:=clock_timestamp();
begin
 if owner_id is null then raise exception 'Zaloguj się do warsztatu.'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Nieprawidłowy identyfikator zdjęcia.'; end if;
 if coalesce(p_file->>'storage_bucket','')<>'order-files' or coalesce(p_file->>'storage_path','') not like owner_id::text||'/%' then raise exception 'Plik musi należeć do tego warsztatu.'; end if;
 if jsonb_typeof(p_document->'items') is distinct from 'array' then raise exception 'Brak pozycji dostawy.'; end if;
 if jsonb_array_length(p_document->'items') not between 1 and 200 then raise exception 'Dozwolone od 1 do 200 pozycji.'; end if;
 -- Dwie dostawy z telefonu nie mogą równolegle zmienić tego samego stanu.
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text||':mobile-delivery',0));
 stamp:=clock_timestamp();
 select * into history from public.sync_records where workshop_id=owner_id and entity_type='delivery_document_imports' and cloud_id='pwa-delivery:'||p_hash;
 if found then
  if history.deleted_at is not null then raise exception 'Ta dostawa została usunięta. Skontaktuj się z administratorem przed ponownym importem.';end if;
  return coalesce(history.payload->'import_result',jsonb_build_object('item_count',history.payload->'item_count','quantity',history.payload->'quantity','created',0,'updated',0,'supplier_name',history.payload->>'supplier_name'))||jsonb_build_object('already_imported',true);
 end if;
 if doc_no<>'' and exists(select 1 from public.sync_records where workshop_id=owner_id and entity_type='delivery_document_imports' and deleted_at is null and coalesce((payload->>'item_count')::integer,0)>0 and lower(trim(payload->>'document_no'))=lower(doc_no) and lower(trim(payload->>'supplier_name'))=lower(supplier)) then raise exception 'Dokument tego dostawcy został już przyjęty. Sprawdź historię dostaw.'; end if;
 for item in select value from jsonb_array_elements(p_document->'items') loop
  if item->>'enabled'='false' then continue;end if;
  code:=upper(trim(coalesce(item->>'part_no',''))); part_name:=trim(coalesce(item->>'name',''));
  quantity:=(item->>'qty')::numeric; cost:=(item->>'unit_cost')::numeric;
  if code='' or length(code)>150 or part_name='' or length(part_name)>1000 or quantity is null or quantity::text in ('NaN','Infinity','-Infinity') or quantity<=0 or quantity<>trunc(quantity) or quantity>100000 or cost is null or cost::text in ('NaN','Infinity','-Infinity') or cost<0 or cost>100000000 then raise exception 'Nieprawidłowy numer części, nazwa, ilość lub cena.';end if;
  normalized:=regexp_replace(code,'[^A-Z0-9]','','g');
  if normalized='' then raise exception 'Numer katalogowy nie zawiera liter ani cyfr.';end if;
  select count(*) into match_count from public.sync_records where workshop_id=owner_id and entity_type='inventory_parts' and deleted_at is null and regexp_replace(upper(payload->>'part_no'),'[^A-Z0-9]','','g')=normalized;
  if match_count>1 then raise exception 'W magazynie są powielone numery katalogowe: %. Uporządkuj je przed importem.',code;end if;
  select * into existing from public.sync_records where workshop_id=owner_id and entity_type='inventory_parts' and deleted_at is null and regexp_replace(upper(payload->>'part_no'),'[^A-Z0-9]','','g')=normalized for update;
  if found then
   part_id:=existing.cloud_id;old_stock:=coalesce((existing.payload->>'stock')::numeric,0);old_cost:=coalesce((existing.payload->>'unit_cost')::numeric,0);
   if old_stock<0 or old_stock<>trunc(old_stock) or old_stock::text in ('NaN','Infinity','-Infinity') or old_cost<0 or old_cost::text in ('NaN','Infinity','-Infinity') then raise exception 'Nieprawidłowy zapisany stan lub koszt części %.',code;end if;
   stock:=old_stock+quantity;
   next_payload:=existing.payload||jsonb_build_object('stock',stock,'unit_cost',round((old_stock*old_cost+quantity*cost)/stock,2));
   update public.sync_records set payload=next_payload,version=version+1,updated_at=stamp,device_id=p_device where id=existing.id;
   updated_count:=updated_count+1;
  else
   part_id:='pwa-part:'||md5(normalized);stock:=quantity;
   next_payload:=jsonb_build_object('part_no',code,'name',part_name,'category','Części samochodowe','stock',stock,'min_stock',0,'unit_cost',cost,'sell_price',round(cost*(1+case when cost<50 then .45 when cost<200 then .35 when cost<500 then .28 else .22 end),2),'notes','Dostawa '||doc_no,'created_at',stamp);
   insert into public.sync_records(workshop_id,entity_type,cloud_id,payload,updated_at,version,device_id) values(owner_id,'inventory_parts',part_id,next_payload,stamp,1,p_device);
   created_count:=created_count+1;
  end if;
  line_count:=line_count+1;total_quantity:=total_quantity+quantity;
 end loop;
 if line_count=0 then raise exception 'Wybierz przynajmniej jedną pozycję.';end if;
 result:=jsonb_build_object('item_count',line_count,'quantity',total_quantity,'created',created_count,'updated',updated_count,'supplier_name',supplier,'already_imported',false);
 next_payload:=p_file||jsonb_build_object('source','PWA_DELIVERY','source_hash',p_hash,'supplier_name',supplier,'document_no',doc_no,'document_date',p_document->>'document_date','gross_total',p_document->'gross_total','item_count',line_count,'quantity',total_quantity,'items',p_document->'items','raw_text',left(coalesce(p_document->>'raw_text',''),100000),'created_at',stamp,'import_result',result);
 insert into public.sync_records(workshop_id,entity_type,cloud_id,payload,updated_at,version,device_id) values(owner_id,'delivery_document_imports','pwa-delivery:'||p_hash,next_payload,stamp,1,p_device);
 return result;
end $$;
revoke all on function public.import_mobile_delivery(text,jsonb,jsonb,text) from public,anon;
grant execute on function public.import_mobile_delivery(text,jsonb,jsonb,text) to authenticated;
