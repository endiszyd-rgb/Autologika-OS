import {PDFDocument,StandardFonts,rgb} from 'https://esm.sh/pdf-lib@1.17.1'

const ascii=(value:any)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[–—]/g,'-').replace(/[^\x20-\x7E\n]/g,'')
const money=(value:any)=>`${Number(value||0).toFixed(2).replace('.',',')} PLN`
function wrap(text:string,max=88){const words=ascii(text).split(/\s+/),lines:string[]=[];let line='';for(const word of words){if((line+' '+word).trim().length>max){if(line)lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines}

export async function approvalPdf(snapshot:any,evidence:{approvalId:string;signedAt:string;snapshotHash:string;signatureHash:string;signatureBytes:Uint8Array}){
 const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),signature=await pdf.embedPng(evidence.signatureBytes)
 let page=pdf.addPage([595.28,841.89]),y=790
 const text=(value:any,size=10,font=regular,color=rgb(.12,.14,.13))=>{page.drawText(ascii(value),{x:50,y,size,font,color});y-=size+6}
 const line=()=>{page.drawLine({start:{x:50,y},end:{x:545,y},thickness:.6,color:rgb(.72,.75,.72)});y-=14}
 const ensure=(height=70)=>{if(y-height<45){page=pdf.addPage([595.28,841.89]);y=790}}
 const paragraph=(value:any,size=9)=>{for(const row of wrap(value)){ensure(20);text(row,size)}}
 text('AUTOLOGIKA',18,bold,rgb(.68,.08,.08));text('POTWIERDZENIE AKCEPTACJI NAPRAWY',15,bold);text(snapshot.approvalDocumentNo||snapshot.documentNo||'',10,bold);line()
 text(`Zlecenie: ${snapshot.documentNo||snapshot.orderId}`);text(`Approval ID: ${evidence.approvalId}`);text(`Data akceptacji: ${new Date(evidence.signedAt).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'})}`);line()
 text('KLIENT I POJAZD',11,bold);text(`Klient: ${snapshot.customer?.name||snapshot.customer?.company||'Nie podano'}`);text(`Pojazd: ${snapshot.vehicle?.make||''} ${snapshot.vehicle?.model||''}`);text(`Rejestracja: ${snapshot.vehicle?.plate||'brak'}    VIN: ${snapshot.vehicle?.vin||'brak'}`);line()
 if(snapshot.additionalScope){text('WCZESNIEJ ZAAKCEPTOWANO',10,bold);text(money(snapshot.previouslyApprovedTotal),13,bold);text('DODATKOWY ZAKRES',10,bold)}else text('ZAKRES PRAC',11,bold)
 for(const item of snapshot.items||[]){ensure(45);text(`${item.position}. ${item.name}${item.variant?` - ${item.variant}`:''}`,10,bold);text(`${item.quantity} ${item.unit} x ${money(item.unitPrice)}                                      ${money(item.value)}`,9);if(item.description)paragraph(item.description,8);y-=3}
 line();text(snapshot.additionalScope?`DODATKOWY ZAKRES: ${money(snapshot.additionalTotal)}`:`RAZEM: ${money(snapshot.totals?.gross)}`,14,bold,rgb(.58,.08,.08));if(snapshot.additionalScope)text(`NOWA LACZNA WARTOSC: ${money(snapshot.newCombinedTotal)}`,14,bold);line()
 text(`TRESC ZGODY (${snapshot.terms?.version||''})`,10,bold);paragraph(snapshot.terms?.text||'');y-=8
 ensure(145);text('PODPIS KLIENTA',10,bold);const dims=signature.scaleToFit(260,95);page.drawImage(signature,{x:50,y:y-dims.height,width:dims.width,height:dims.height});y-=dims.height+18;line()
 text('INTEGRALNOSC DOKUMENTU',10,bold);paragraph(`SHA-256 snapshotu: ${evidence.snapshotHash}`,8);paragraph(`SHA-256 podpisu: ${evidence.signatureHash}`,8);paragraph('Dokument stanowi zapis elektronicznej akceptacji zakresu i kosztow naprawy. Nie jest kwalifikowanym podpisem elektronicznym.',8)
 return await pdf.save({useObjectStreams:false})
}
