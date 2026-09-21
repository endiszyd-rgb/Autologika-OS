function deriveOrderReadiness(raw={}){
 const diagnosis_documented=Boolean(raw.diagnosis_documented)
 const customer_approved=diagnosis_documented&&Boolean(raw.customer_approved)
 const parts_documented=customer_approved&&Boolean(raw.parts_documented)
 const work_logged=parts_documented&&Boolean(raw.work_logged)
 const qc_done=work_logged&&Boolean(raw.qc_done)
 const billedTotal=Math.max(0,Number(raw.billed_total)||0)
 const paidTotal=Math.max(0,Number(raw.paid_total)||0)
 const paymentCovered=paidTotal+0.01>=billedTotal
 const payment_checked=qc_done&&paymentCovered
 const release_notes_done=payment_checked&&Boolean(raw.release_notes_done)

 return {
  customer_approved,
  diagnosis_documented,
  parts_documented,
  work_logged,
  qc_done,
  payment_checked,
  release_notes_done
 }
}

module.exports={deriveOrderReadiness}
