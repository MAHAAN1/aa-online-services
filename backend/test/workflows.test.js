import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";

test("customer and staff workflows with isolated PostgREST and Storage", async t => {
  const rows = { orders: [], service_applications: [], order_documents: [], enquiries: [],
    admin_users: [{ id: randomUUID(), name: "Test staff", email: "staff@example.test", active: true, password_hash: await bcrypt.hash("fixture-password", 4) }] };
  const stub = http.createServer(async (req,res) => {
    const url = new URL(req.url,"http://localhost");
    res.setHeader("content-type","application/json");
    const chunks=[]; for await (const chunk of req) chunks.push(chunk);
    if (url.pathname.startsWith("/storage/v1/")) return res.end('{"Key":"fixture"}');
    const table = rows[url.pathname.split("/").pop()];
    if (!table) {res.writeHead(404); return res.end("{}");}
    let matches = table.filter(r => [...url.searchParams].every(([key,val]) => !val.startsWith("eq.") || String(r[key])===val.slice(3)));
    if(req.method==="POST"){
      const input=JSON.parse(Buffer.concat(chunks)); matches=[input].flat().map(x=>({id:randomUUID(), ...x}));
      table.push(...matches); res.statusCode=201;
    } else if(req.method==="PATCH") {
      const patch=JSON.parse(Buffer.concat(chunks)); matches.forEach(r=>Object.assign(r,patch));
    }
    const fields=url.searchParams.get("select");
    const result=matches.map(r => fields && fields!=="*" ? Object.fromEntries(fields.split(",").filter(k=>k in r).map(k=>[k,r[k]])) : r);
    res.end(JSON.stringify(req.headers.accept?.includes("pgrst.object") ? result[0] : result));
  });
  stub.listen(0,"127.0.0.1"); await once(stub,"listening"); t.after(()=>stub.close());
  const socket=http.createServer();socket.listen(0,"127.0.0.1");await once(socket,"listening");
  const port=socket.address().port; await new Promise(r=>socket.close(r));
  const secret=randomUUID();
  const child=spawn(process.execPath,["src/server.js"],{env:{PATH:process.env.PATH,PORT:String(port),JWT_SECRET:randomUUID(),SUPABASE_URL:"http://127.0.0.1:"+stub.address().port,SUPABASE_SERVICE_ROLE_KEY:"test-only",RAZORPAY_WEBHOOK_SECRET:secret},stdio:["ignore","ignore","inherit"]});
  t.after(()=>child.kill());
  const base="http://127.0.0.1:"+port+"/api";
  for(let i=0;i<100;i++){try{if((await fetch(base+"/health")).ok)break;}catch{} await new Promise(r=>setTimeout(r,50));}
  async function send(path,method="GET",body,headers={}) {
    const form=body instanceof FormData;
    const response=await fetch(base+path,{method,headers:{...(!form&&body?{"Content-Type":"application/json"}:{}),...headers},body:form?body:JSON.stringify(body)});
    return [response.status,await response.json()];
  }
  const customer={customer_name:"Fixture",phone:"9999999999"};
  const pdf=await PDFDocument.create();pdf.addPage();const bytes=await pdf.save();
  const upload=()=>{const f=new FormData(); for(const [k,v] of Object.entries(customer)) f.set(k,v); f.append("documents",new Blob([bytes],{type:"application/pdf"}),"fixture.pdf");return f;};
  let [status,print]=await send("/orders/create","POST",upload());assert.equal(status,201,JSON.stringify(print));assert.equal(print.order.amount,2);
  const application=upload();application.set("application_type","job");application.set("application_name","Fixture vacancy");
  let [as,app]=await send("/applications/create","POST",application);assert.equal(as,201,JSON.stringify(app));assert.equal(app.order.amount,100);
  const track=(group,order_number)=>send("/"+group+"/track","POST",{order_number,phone:customer.phone});
  const [,tracked]=await track("applications",app.order.order_number); assert.equal(tracked.application.application_status,"documents_received");assert.equal(tracked.order.document_path,undefined);assert.equal(tracked.application.customer_details,undefined);
  const [,enq]=await send("/enquiries","POST",{...customer,category:"Printing",subject:"Copies",message:"Need two copies"});assert.ok(enq.enquiry?.enquiry_number);
  assert.equal((await send("/enquiries/track","POST",{phone:customer.phone,enquiry_number:enq.enquiry.enquiry_number}))[1].enquiry.status,"new");
  assert.equal((await send("/orders/admin/all"))[0],401);
  const [,login]=await send("/admin/login","POST",{email:"staff@example.test",password:"fixture-password"});assert.ok(login.token);
  const auth={Authorization:"Bearer "+login.token};
  assert.equal((await send("/orders/admin/all","GET",undefined,auth))[0],200);
  assert.equal((await send("/orders/admin/"+print.order.id+"/status","PATCH",{status:"ready"},auth))[0],200);
  assert.equal((await track("orders",print.order.order_number))[1].order.status,"ready");
  assert.equal((await send("/payments/create","POST",{order_id:print.order.id}))[0],503);
  const event={event:"fixture.ignored"};const sig=createHmac("sha256",secret).update(JSON.stringify(event)).digest("hex");
  assert.equal((await send("/payments/webhook","POST",event,{"x-razorpay-signature":sig}))[0],200);
  assert.equal((await send("/payments/webhook","POST",event,{"x-razorpay-signature":"invalid"}))[0],400);
});
