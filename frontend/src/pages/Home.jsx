import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, ChevronDown, Copy, FileCheck2, Layers, MessageCircle, Minus, Plus, Printer, ScanLine, Search } from "lucide-react";
import { calculateDocumentPrice } from "../lib/printPricing";
import "./desk.css";

const tasks = [
  { title: "Document printing", detail: "PDFs, photos and project reports", to: "/print", Icon: Printer, colour: "mint" },
  { title: "Xerox copies", detail: "Black & white or colour copies", to: "/print?service=xerox", Icon: Copy, colour: "peach" },
  { title: "Online applications", detail: "Jobs, scholarships and form assistance", to: "/services#applications", Icon: FileCheck2, colour: "lilac" },
  { title: "Ask the desk", detail: "Booking help or a custom request", to: "/enquiry", Icon: MessageCircle, colour: "sky" },
];

function Estimator() {
  const [service, setService] = useState("printing");
  const [colour, setColour] = useState("bw");
  const [sides, setSides] = useState("single");
  const [pages, setPages] = useState("5");
  const count = Number(pages);
  const valid = Number.isInteger(count) && count >= 1 && count <= 9999;
  const price = valid && calculateDocumentPrice({ pages: count, copies: 1, service_type: service, color_mode: colour, sides });
  const options = new URLSearchParams({ service, colour, sides: service === "xerox" ? "single" : sides });
  return <section className="quote-panel" aria-labelledby="quote-title" id="estimate">
    <div className="quote-intro"><span className="desk-icon mint"><Layers /></span><div><h2 id="quote-title">Price estimate</h2><p>One document, one copy. Finishing is extra.</p></div></div>
    <div className="quote-fields">
      <label>Service<select value={service} onChange={e => setService(e.target.value)}><option value="printing">Printing</option><option value="xerox">Xerox</option></select></label>
      <label>Ink<select value={colour} onChange={e => setColour(e.target.value)}><option value="bw">Black &amp; white</option><option value="color">Colour</option></select></label>
      {service === "printing" && <label>Sides<select value={sides} onChange={e => setSides(e.target.value)}><option value="single">Single-sided</option><option value="double">Double-sided</option></select></label>}
      <label>Pages<span className="stepper"><button type="button" aria-label="One fewer page" disabled={!valid || count === 1} onClick={() => setPages(String(count-1))}><Minus size={14}/></button><input aria-label="Page count" inputMode="numeric" type="number" min="1" max="9999" value={pages} onChange={e=>setPages(e.target.value)} /><button type="button" aria-label="One more page" disabled={!valid || count === 9999} onClick={() => setPages(String(count+1))}><Plus size={14}/></button></span></label>
    </div>
    <div className="quote-total"><div aria-live="polite"><small>Estimated total</small><strong>{valid ? "₹" + price.toLocaleString("en-IN") : "Enter 1–9,999 pages"}</strong></div><Link to={"/print?" + options}>Use these options <ArrowRight size={16}/></Link></div>
  </section>;
}

export default function Home() {
  return <div className="service-desk">
    <a className="desk-skip" href="#desk-main">Skip to services</a>
    <header className="desk-nav"><Link to="/" className="desk-brand"><span className="brand-tile"><Layers/></span><span>A&amp;A <b>Online Services</b></span></Link>
      <nav aria-label="Main navigation"><Link to="/services">Services</Link><a href="#estimate">Pricing</a><Link to="/enquiry">Enquiries</Link></nav><Link className="desk-track" to="/track"><ScanLine size={17}/> Track order</Link></header>
    <main id="desk-main" className="desk-container">
      <section className="desk-hero">
        <div className="hero-copy"><h1>Your print &amp;<br/><em>service desk.</em></h1><p>Send files for printing or Xerox, get help with applications, and track your request through to collection.</p>
          <div className="hero-actions"><Link className="primary-action" to="/print"><Printer size={18}/> Start a print order <ArrowRight size={17}/></Link><a className="quiet-action" href="#tasks">Explore services <ChevronDown size={16}/></a></div>
        </div>
        <div className="proof-scene" aria-hidden="true"><div className="proof-shadow"/><div className="proof-sheet sheet-back"/><div className="proof-sheet sheet-face"><div className="proof-top"><b>A&amp;A</b><span>PRINT STUDIO</span></div><div className="proof-art"/><div className="proof-bottom"><b>Colour study</b><span>CMYK</span></div></div><div className="proof-swatch"><i/><i/><i/><i/></div></div>
      </section>
      <section className="desk-tasks" id="tasks"><div className="section-heading"><div><h2>What do you need?</h2><p>Choose a service to get started.</p></div><Link to="/services">Full directory <ArrowUpRight size={16}/></Link></div>
        <div className="task-grid">{tasks.map(({title,detail,to,Icon,colour})=><Link key={title} to={to} className="task-card"><span className={'desk-icon '+colour}><Icon size={23}/></span><strong>{title}</strong><span>{detail}</span><ArrowUpRight className="card-arrow" size={17}/></Link>)}</div>
      </section>
      <Estimator/>
      <section className="track-strip"><Search/><div><h2>Already placed a request?</h2><p>Use your reference number and the phone number you submitted.</p></div><Link to="/track">Track a request <ArrowRight size={16}/></Link></section>
    </main>
    <footer className="desk-footer"><span>A&amp;A Online Services</span><Link to="/enquiry">Contact the desk</Link><Link to="/admin/login">Staff sign-in</Link></footer>
  </div>;
}
