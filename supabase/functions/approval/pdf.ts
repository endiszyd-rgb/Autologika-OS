import {PDFDocument,rgb} from 'https://esm.sh/pdf-lib@1.17.1'
import fontkit from 'https://esm.sh/@pdf-lib/fontkit@1.1.1'

const PAGE_W=595.28,PAGE_H=841.89,MARGIN=42,CONTENT_W=PAGE_W-MARGIN*2
const ink=rgb(.10,.12,.11),muted=rgb(.39,.43,.40),lineColor=rgb(.78,.80,.78),soft=rgb(.955,.965,.955),red=rgb(.68,.055,.075),green=rgb(.28,.50,.30)
const fontFiles=Promise.all([
 Deno.readFile(new URL('./assets/NotoSans-Regular.ttf',import.meta.url)),
 Deno.readFile(new URL('./assets/NotoSans-Bold.ttf',import.meta.url))
])
const safeText=(value:any)=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').replace(/[–—]/g,'-')
const money=(value:any)=>`${Number(value||0).toFixed(2).replace('.',',')} PLN`

function wrapped(value:any,font:any,size:number,maxWidth:number){
 const result:string[]=[]
 for(const paragraph of safeText(value).split(/\n/)){
  const words=paragraph.trim().split(/\s+/).filter(Boolean);let current=''
  for(const word of words){
   const candidate=current?`${current} ${word}`:word
   if(font.widthOfTextAtSize(candidate,size)<=maxWidth){current=candidate;continue}
   if(current)result.push(current)
   if(font.widthOfTextAtSize(word,size)<=maxWidth){current=word;continue}
   let chunk='';for(const char of word){const next=chunk+char;if(font.widthOfTextAtSize(next,size)>maxWidth&&chunk){result.push(chunk);chunk=char}else chunk=next}current=chunk
  }
  if(current)result.push(current);if(!words.length)result.push('')
 }
 return result
}

export async function approvalPdf(snapshot:any,evidence:{approvalId:string;signedAt:string;snapshotHash:string;signatureHash:string;signatureBytes:Uint8Array}){
 const pdf=await PDFDocument.create(),[regularBytes,boldBytes]=await fontFiles;pdf.registerFontkit(fontkit)
 const regular=await pdf.embedFont(regularBytes,{subset:true}),bold=await pdf.embedFont(boldBytes,{subset:true}),signature=await pdf.embedPng(evidence.signatureBytes)
 pdf.setTitle(`Potwierdzenie akceptacji ${safeText(snapshot.approvalDocumentNo||snapshot.documentNo||'')}`);pdf.setAuthor('AutoLogika');pdf.setSubject('Elektroniczna akceptacja zakresu i kosztów naprawy')
 const documentNo=safeText(snapshot.approvalDocumentNo||snapshot.documentNo||`AL-${snapshot.orderId}`),signedAt=new Date(evidence.signedAt).toLocaleString('pl-PL',{timeZone:'Europe/Warsaw'})
 let page:any,y=0
 const addPage=()=>{page=pdf.addPage([PAGE_W,PAGE_H]);page.drawRectangle({x:0,y:PAGE_H-8,width:PAGE_W,height:8,color:red});page.drawText('AUTOLOGIKA',{x:MARGIN,y:PAGE_H-47,size:18,font:bold,color:ink});page.drawText('POTWIERDZENIE AKCEPTACJI NAPRAWY',{x:MARGIN,y:PAGE_H-66,size:9,font:bold,color:red});const width=bold.widthOfTextAtSize(documentNo,10);page.drawText(documentNo,{x:PAGE_W-MARGIN-width,y:PAGE_H-49,size:10,font:bold,color:ink});page.drawLine({start:{x:MARGIN,y:PAGE_H-78},end:{x:PAGE_W-MARGIN,y:PAGE_H-78},thickness:.8,color:lineColor});y=PAGE_H-104}
 const ensure=(height=60)=>{if(y-height<62)addPage()}
 const drawText=(value:any,x=MARGIN,size=9,font=regular,color=ink)=>{page.drawText(safeText(value),{x,y,size,font,color});y-=size+5}
 const paragraph=(value:any,size=9,maxWidth=CONTENT_W,color=ink)=>{for(const row of wrapped(value,regular,size,maxWidth)){ensure(size+8);drawText(row,MARGIN,size,regular,color)}}
 const section=(label:string)=>{ensure(40);y-=5;page.drawRectangle({x:MARGIN,y:y-18,width:CONTENT_W,height:23,color:soft});page.drawRectangle({x:MARGIN,y:y-18,width:4,height:23,color:red});page.drawText(safeText(label),{x:MARGIN+12,y:y-11,size:9,font:bold,color:ink});y-=31}
 const fact=(label:string,value:any,x:number,width:number)=>{page.drawText(safeText(label).toUpperCase(),{x,y,size:7,font:bold,color:muted});const rows=wrapped(value,regular,9,width);rows.slice(0,2).forEach((row,index)=>page.drawText(row,{x,y:y-13-index*12,size:9,font:regular,color:ink}))}
 const separator=()=>{page.drawLine({start:{x:MARGIN,y},end:{x:PAGE_W-MARGIN,y},thickness:.6,color:lineColor});y-=12}
 const itemHeader=()=>{page.drawRectangle({x:MARGIN,y:y-18,width:CONTENT_W,height:22,color:rgb(.15,.17,.16)});for(const [label,x] of [['POZYCJA',MARGIN+8],['ILOSC',350],['CENA',414],['WARTOSC',485]] as [string,number][])page.drawText(label,{x,y:y-13,size:7,font:bold,color:rgb(1,1,1)});y-=28}

 addPage()
 section('DANE DOKUMENTU')
 fact('Zlecenie',snapshot.documentNo||snapshot.orderId,MARGIN,220);fact('Approval ID',evidence.approvalId,310,243);y-=31
 fact('Data i godzina decyzji',signedAt,MARGIN,220);fact('Wersja zgody',snapshot.terms?.version||'',310,243);y-=34
 section('KLIENT I POJAZD')
 fact('Klient',snapshot.customer?.name||snapshot.customer?.company||'Nie podano',MARGIN,220);fact('Pojazd',`${snapshot.vehicle?.make||''} ${snapshot.vehicle?.model||''}`.trim(),310,243);y-=31
 fact('Numer rejestracyjny',snapshot.vehicle?.plate||'brak',MARGIN,220);fact('VIN',snapshot.vehicle?.vin||'brak',310,243);y-=34
 if(snapshot.additionalScope){section('PODSUMOWANIE DODATKOWEGO ZAKRESU');const cards=[['WCZEŚNIEJ ZAAKCEPTOWANO',snapshot.previouslyApprovedTotal],['DODATKOWY ZAKRES',snapshot.additionalTotal],['NOWA ŁĄCZNA WARTOŚĆ',snapshot.newCombinedTotal]];cards.forEach(([label,value],index)=>{const x=MARGIN+index*(CONTENT_W/3+4),width=CONTENT_W/3-8;page.drawRectangle({x,y:y-44,width,height:50,color:index===2?rgb(.91,.95,.88):soft,borderColor:index===2?green:lineColor,borderWidth:.6});page.drawText(String(label),{x:x+8,y:y-15,size:6.6,font:bold,color:muted});page.drawText(money(value),{x:x+8,y:y-34,size:12,font:bold,color:index===2?green:ink})});y-=63}
 section(snapshot.additionalScope?'DODATKOWY ZAKRES PRAC':'ZAKRES PRAC');itemHeader()
 for(const item of snapshot.items||[]){
  const title=wrapped(`${item.position}. ${item.name}${item.variant?` - ${item.variant}`:''}`,bold,8.5,292),description=item.description?wrapped(item.description,regular,7.5,292):[],height=Math.max(30,12*(title.length+description.length)+10)
  if(y-height<70){addPage();section('ZAKRES PRAC - CIĄG DALSZY');itemHeader()}
  const top=y;title.forEach((row,index)=>page.drawText(row,{x:MARGIN+8,y:top-10-index*11,size:8.5,font:bold,color:ink}));description.forEach((row,index)=>page.drawText(row,{x:MARGIN+8,y:top-10-title.length*11-index*10,size:7.5,font:regular,color:muted}));page.drawText(`${item.quantity} ${safeText(item.unit)}`,{x:350,y:top-10,size:8,font:regular,color:ink});page.drawText(money(item.unitPrice),{x:414,y:top-10,size:8,font:regular,color:ink});const value=money(item.value),valueWidth=bold.widthOfTextAtSize(value,8);page.drawText(value,{x:PAGE_W-MARGIN-8-valueWidth,y:top-10,size:8,font:bold,color:ink});y-=height;separator()
 }
 ensure(90);page.drawRectangle({x:310,y:y-55,width:243,height:62,color:rgb(.985,.955,.955),borderColor:red,borderWidth:1});page.drawText(snapshot.additionalScope?'DODATKOWY ZAKRES':'RAZEM',{x:324,y:y-18,size:8,font:bold,color:muted});const total=money(snapshot.additionalScope?snapshot.additionalTotal:snapshot.totals?.gross),totalWidth=bold.widthOfTextAtSize(total,17);page.drawText(total,{x:PAGE_W-MARGIN-12-totalWidth,y:y-43,size:17,font:bold,color:red});y-=75
 section(`TREŚĆ ZGODY - ${snapshot.terms?.version||''}`);paragraph(snapshot.terms?.text||'',9,CONTENT_W,ink);y-=10
 ensure(155);section('PODPIS KLIENTA');page.drawRectangle({x:MARGIN,y:y-105,width:300,height:112,color:rgb(1,1,1),borderColor:lineColor,borderWidth:.8});const dims=signature.scaleToFit(280,90);page.drawImage(signature,{x:MARGIN+10,y:y-95+(90-dims.height)/2,width:dims.width,height:dims.height});page.drawText(safeText(`Podpisano: ${signedAt}`),{x:360,y:y-18,size:8,font:bold,color:ink});page.drawText('Decyzja: ZAAKCEPTOWANO',{x:360,y:y-35,size:8,font:bold,color:green});page.drawText('Podpis stanowi element dowodu',{x:360,y:y-65,size:7,font:regular,color:muted});page.drawText('elektronicznej akceptacji.',{x:360,y:y-76,size:7,font:regular,color:muted});y-=126
 section('INTEGRALNOŚĆ DOKUMENTU');paragraph(`SHA-256 snapshotu: ${evidence.snapshotHash}`,7.5);paragraph(`SHA-256 podpisu: ${evidence.signatureHash}`,7.5);y-=5;paragraph('Dokument stanowi zapis elektronicznej akceptacji zakresu i kosztów naprawy. Nie jest kwalifikowanym podpisem elektronicznym.',7.5,CONTENT_W,muted)
 const pages=pdf.getPages();pages.forEach((sheet,index)=>{sheet.drawLine({start:{x:MARGIN,y:43},end:{x:PAGE_W-MARGIN,y:43},thickness:.5,color:lineColor});sheet.drawText(`AutoLogika - ${documentNo}`,{x:MARGIN,y:28,size:7,font:regular,color:muted});const number=`Strona ${index+1} z ${pages.length}`,width=regular.widthOfTextAtSize(number,7);sheet.drawText(number,{x:PAGE_W-MARGIN-width,y:28,size:7,font:regular,color:muted})})
 return await pdf.save({useObjectStreams:false})
}
