import test from 'node:test'
import assert from 'node:assert/strict'
import {PWA_RELATIONS,stablePwaLocalId} from '../src/platform/pwa-identifiers.mjs'

test('PWA maps cloud UUIDs to stable safe numeric identifiers expected by the desktop UI',()=>{
  const cloud='e863c0a2-34a4-4f6f-9e82-95129396a1b8',first=stablePwaLocalId('orders',cloud)
  assert.equal(first,stablePwaLocalId('orders',cloud))
  assert.equal(Number.isSafeInteger(first),true)
  assert.equal(first>0,true)
  assert.notEqual(first,stablePwaLocalId('vehicles',cloud))
})

test('PWA relation map covers the workshop links used by synchronized modules',()=>{
  assert.equal(PWA_RELATIONS.order_cloud_id,'orders')
  assert.equal(PWA_RELATIONS.vehicle_cloud_id,'vehicles')
  assert.equal(PWA_RELATIONS.inventory_part_cloud_id,'inventory_parts')
  assert.equal(PWA_RELATIONS.repair_operation_cloud_id,'order_repair_operations')
  assert.equal(PWA_RELATIONS.resource_cloud_id,'work_resources')
})
