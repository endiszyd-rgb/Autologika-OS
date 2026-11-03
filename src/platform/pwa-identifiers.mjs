export const PWA_RELATIONS={customer_cloud_id:'customers',vehicle_cloud_id:'vehicles',order_cloud_id:'orders',supplier_cloud_id:'suppliers',order_item_cloud_id:'order_items',inventory_part_cloud_id:'inventory_parts',inspection_cloud_id:'dvi_inspections',repair_operation_cloud_id:'order_repair_operations',repair_part_cloud_id:'repair_parts',dvi_item_cloud_id:'dvi_items',attachment_cloud_id:'attachments',resource_cloud_id:'work_resources',appointment_cloud_id:'appointments',job_part_order_cloud_id:'job_part_orders',procedure_run_cloud_id:'work_procedure_runs',manual_page_cloud_id:'technical_manual_pages',technical_data_cloud_id:'technical_data_entries'}

export function stablePwaLocalId(entity,cloudId){
  const value=`${entity}:${cloudId}`
  let high=0x811c9dc5,low=0x01000193
  for(let index=0;index<value.length;index++){const code=value.charCodeAt(index);high=Math.imul(high^code,0x01000193)>>>0;low=Math.imul(low^(code+index),0x45d9f3b)>>>0}
  return (high&0x1fffff)*0x100000000+low
}
