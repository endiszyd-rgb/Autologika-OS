export function createConfirmationQueue(){
 const subscribers=new Set(),waiting=[]
 return {
  request(options){return new Promise(resolve=>{const request={options:typeof options==='string'?{message:options}:options||{},resolve},subscriber=[...subscribers][0];if(subscriber)subscriber(request);else waiting.push(request)})},
  subscribe(receive){subscribers.add(receive);if(waiting.length)waiting.splice(0).forEach(receive);return()=>subscribers.delete(receive)},
  pending(){return waiting.length}
 }
}

export const confirmationQueue=createConfirmationQueue()
export const confirmAction=options=>confirmationQueue.request(options)
