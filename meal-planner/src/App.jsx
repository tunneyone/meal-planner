import { useState, useEffect, useRef, Fragment } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MEAL_TYPES = ["Breakfast","Lunch","Dinner","Snacks"];
const UNITS = ["whole","g","kg","ml","l","tsp","tbsp","cup","oz","lb","bunch","clove","slice","tin","pack","handful","pinch","sprig","head"];
const PREP_TIMES = [5,10,15,20,30,45,60,90,120];
const MEAL_TAGS = ["Quick","Meal Prep","Leftover","Eating Out","Skip"];
const DIETARY_TAGS = ["Vegetarian","Vegan","Gluten-Free","Dairy-Free","High Protein","Low Carb","Keto"];
const GROCERY_SECTIONS = ["Produce","Meat & Seafood","Dairy & Eggs","Pantry & Dry Goods","Frozen","Bakery & Bread","Beverages","Condiments & Sauces","Snacks","Home","Utility","Bathroom","Other"];
const SECTION_ICONS = {"Produce":"🥦","Meat & Seafood":"🥩","Dairy & Eggs":"🥚","Pantry & Dry Goods":"🫙","Frozen":"❄️","Bakery & Bread":"🍞","Beverages":"🧃","Condiments & Sauces":"🧴","Snacks":"🍿","Home":"🏠","Utility":"🔧","Bathroom":"🧼","Other":"📦"};
const RECIPE_SECTIONS = ["Breakfast","Lunch","Dinner","Snacks","Leftover"];
const TAG_COLORS = {"Vegetarian":"#4caf78","Vegan":"#6bc98a","Gluten-Free":"#e8a44a","Dairy-Free":"#9b7fe8","High Protein":"#e86b5f","Low Carb":"#5ba3e0","Keto":"#d4a843"};
const MEAL_TAG_COLORS = {"Quick":"#4caf78","Meal Prep":"#e8a44a","Leftover":"#9b7fe8","Eating Out":"#5ba3e0","Skip":"#aaa"};
const C = {bg:"#f0f4f8",card:"#ffffff",border:"#cdd8e8",accent:"#2d6be4",dark:"#0f1f3d",light:"#e8f0fc",text:"#1a2840",muted:"#7a8fa8"};

// ── Helpers ───────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2,9);
const emptyMeal = () => ({id:uid(),name:"",servings:2,prepTime:20,tags:[],dietaryTags:[],ingredients:[],steps:[],notes:"",leftoverFrom:"",recipeSection:"Dinner",sourceUrl:""});
const emptyIng = () => ({id:uid(),name:"",qty:1,unit:"whole",section:"Other"});
const emptyStep = () => ({id:uid(),text:"",timerMins:0});
const scaleQty = (qty,base,cur) => base ? Math.round(qty*cur/base*100)/100 : qty;

const getAllMeals = (grid) => {
  const out = [];
  DAYS.forEach(d => MEAL_TYPES.forEach(t => {
    const slot = grid[d]?.[t];
    if (!slot) return;
    if (slot.split) {
      (slot.meals||[]).forEach(m => out.push({meal:m,day:d,type:t}));
    } else {
      out.push({meal:slot,day:d,type:t});
    }
  }));
  return out;
};

const buildEmptyGrid = () => {
  const g = {};
  DAYS.forEach(d => { g[d] = {}; MEAL_TYPES.forEach(t => { g[d][t] = null; }); });
  return g;
};

const buildGrocery = (grid, customItems) => {
  const map = {};
  const leftoverIds = new Set(getAllMeals(grid).filter(({meal:m}) => m.leftoverFrom).map(({meal:m}) => m.id));
  getAllMeals(grid).forEach(({meal,day,type}) => {
    if (leftoverIds.has(meal.id) || meal.tags?.includes("Eating Out") || meal.tags?.includes("Skip")) return;
    (meal.ingredients||[]).forEach(ing => {
      if (!ing.name?.trim()) return;
      const k = `${ing.name.toLowerCase().trim()}||${ing.unit}||${ing.section||"Other"}`;
      const sq = scaleQty(ing.qty, 2, meal.servings);
      if (!map[k]) map[k] = {name:ing.name,qty:0,unit:ing.unit,section:ing.section||"Other",meals:[]};
      map[k].qty = Math.round((map[k].qty + sq)*100)/100;
      map[k].meals.push(meal.name);
    });
  });
  const secs = {};
  GROCERY_SECTIONS.forEach(s => { secs[s] = []; });
  Object.entries(map).forEach(([k,item]) => {
    const s = secs[item.section] ? item.section : "Other";
    secs[s].push({...item, key:k});
  });
  (customItems||[]).forEach(ci => {
    if (!ci.name?.trim()) return;
    const s = secs[ci.section] ? ci.section : "Other";
    secs[s].push({...ci, isCustom:true, key:ci.id});
  });
  return secs;
};

// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = "mealplanner_v6";
const loadState = () => { try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
const saveState = (d) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); } catch {} };

// ── Style helpers ─────────────────────────────────────────────────────────────
const inp = (ex={}) => ({width:"100%",padding:"8px 11px",borderRadius:9,border:`1px solid ${C.border}`,background:C.card,fontSize:14,color:C.text,outline:"none",boxSizing:"border-box",fontFamily:"'Lato',sans-serif",...ex});
const btn = (bg, color, ex={}) => ({background:bg,color,border:`1px solid ${color && color !== "#fff" ? color+"33" : "transparent"}`,borderRadius:9,padding:"7px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Lato',sans-serif",whiteSpace:"nowrap",...ex});
const lbl = () => ({display:"block",fontSize:11,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:.8,marginBottom:5,fontFamily:"'Playfair Display',serif"});

const Field = ({label, children, mt=0}) => (
  <div style={{marginBottom:13, marginTop:mt}}>
    <label style={lbl()}>{label}</label>
    {children}
  </div>
);

const Badge = ({label, color, small}) => (
  <span style={{display:"inline-flex",alignItems:"center",background:`${color}22`,color,border:`1px solid ${color}55`,borderRadius:20,padding:small?"1px 7px":"2px 9px",fontSize:small?10:11,fontWeight:700,whiteSpace:"nowrap",fontFamily:"'Playfair Display',serif"}}>
    {label}
  </span>
);

// ── Claude API call ───────────────────────────────────────────────────────────
const callClaude = async (messages, system) => {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({model:"claude-sonnet-4-20250514", max_tokens:2000, system, messages})
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.find(b => b.type === "text")?.text || "";
  return text.replace(/```json\n?|```/g,"").trim();
};

const RECIPE_SCHEMA = `Return ONLY valid JSON matching this schema exactly, no markdown, no explanation:
{"name":string,"servings":number,"prepTime":number,"dietaryTags":string[],"recipeSection":string,"ingredients":[{"name":string,"qty":number,"unit":string,"section":string}],"steps":[{"text":string,"timerMins":number}],"notes":string,"sourceUrl":string}
recipeSection must be one of: Breakfast,Lunch,Dinner,Snacks,Leftover
dietaryTags from: Vegetarian,Vegan,Gluten-Free,Dairy-Free,High Protein,Low Carb,Keto
unit from: whole,g,kg,ml,l,tsp,tbsp,cup,oz,lb,bunch,clove,slice,tin,pack,handful,pinch,sprig,head
section from: Produce,Meat & Seafood,Dairy & Eggs,Pantry & Dry Goods,Frozen,Bakery & Bread,Beverages,Condiments & Sauces,Snacks,Other
timerMins should be 0 unless the step explicitly involves timed cooking or resting.`;

const parseMeal = (json) => {
  const parsed = JSON.parse(json);
  return {
    ...emptyMeal(),
    ...parsed,
    id: uid(),
    tags: [],
    steps: (parsed.steps||[]).map(s => ({...s, id:uid()})),
    ingredients: (parsed.ingredients||[]).map(i => ({...i, id:uid()}))
  };
};

// ── Recipe Importer (URL + Camera) ────────────────────────────────────────────
const RecipeImporter = ({onImport, onClose}) => {
  const [mode, setMode] = useState("url"); // "url" | "camera" | "file"
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [imageData, setImageData] = useState(null);
  const fileRef = useRef();
  const videoRef = useRef();
  const streamRef = useRef();

  // Clean up camera on unmount
  useEffect(() => {
    return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
  }, []);

  const startCamera = async () => {
    setMode("camera");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError("Camera not available. Try uploading a photo instead.");
      setMode("url");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setMode("url");
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);
    setImageData(dataUrl.split(",")[1]);
    stopCamera();
    setMode("file");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      setImageData(dataUrl.split(",")[1]);
      setMode("file");
    };
    reader.readAsDataURL(file);
  };

  const extractFromUrl = async () => {
    if (!url.trim()) return;
    setLoading(true); setError("");
    try {
      const json = await callClaude(
        [{role:"user", content:`Extract the recipe from this URL: ${url.trim()}\nSet sourceUrl to the provided URL.`}],
        `You extract recipe data from URLs. ${RECIPE_SCHEMA}`
      );
      onImport(parseMeal(json));
    } catch {
      setError("Couldn't extract that recipe. Try a recipe website URL — BBC Good Food, Deliciously Ella, NYT Cooking, Ottolenghi.");
    }
    setLoading(false);
  };

  const extractFromImage = async () => {
    if (!imageData) return;
    setLoading(true); setError("");
    try {
      const json = await callClaude(
        [{role:"user", content:[
          {type:"image", source:{type:"base64", media_type:"image/jpeg", data:imageData}},
          {type:"text", text:"Extract the recipe from this image of a recipe book or recipe card. Include all ingredients with quantities, and all method steps. Set sourceUrl to empty string."}
        ]}],
        `You extract recipe data from photos of recipe books and recipe cards. ${RECIPE_SCHEMA}`
      );
      onImport(parseMeal(json));
    } catch {
      setError("Couldn't read that image. Make sure the photo is clear and well-lit with the full recipe visible.");
    }
    setLoading(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(30,20,10,.65)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"}} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:C.card,borderRadius:20,width:"100%",maxWidth:520,padding:32,boxShadow:"0 24px 64px rgba(0,0,0,.3)"}}>
        <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:C.text,marginBottom:6}}>Import Recipe</h2>
        <p style={{fontSize:13,color:C.muted,marginBottom:20,lineHeight:1.6}}>Import from a website URL, take a photo of your recipe book, or upload a photo.</p>

        {/* Mode tabs */}
        <div style={{display:"flex",gap:6,marginBottom:20}}>
          {[["url","🔗 URL"],["photo","📷 Camera / Photo"]].map(([m,label]) => (
            <button key={m} onClick={() => { setError(""); if (m==="photo") { fileRef.current?.click(); } else { stopCamera(); setMode("url"); } }}
              style={{...btn(mode==="url"&&m==="url"||mode!=="url"&&m==="photo"?C.accent:C.light, mode==="url"&&m==="url"||mode!=="url"&&m==="photo"?"#fff":C.accent, {flex:1,padding:"9px",fontSize:13})}}>
              {label}
            </button>
          ))}
        </div>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFileUpload} style={{display:"none"}} />

        {/* Camera view */}
        {mode === "camera" && (
          <div style={{marginBottom:16}}>
            <video ref={videoRef} autoPlay playsInline style={{width:"100%",borderRadius:12,background:"#000",maxHeight:280,objectFit:"cover"}} />
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={capturePhoto} style={{...btn("linear-gradient(135deg,#2d6be4,#1a52c8)","#fff",{flex:1,border:"none",padding:"11px",fontSize:14,borderRadius:12})}}>📸 Capture</button>
              <button onClick={stopCamera} style={btn("#f0ece6",C.muted)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Image preview */}
        {mode === "file" && preview && (
          <div style={{marginBottom:16}}>
            <img src={preview} alt="Recipe" style={{width:"100%",borderRadius:12,maxHeight:260,objectFit:"cover"}} />
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <button onClick={extractFromImage} disabled={loading} style={{...btn("linear-gradient(135deg,#2d6be4,#1a52c8)","#fff",{flex:1,border:"none",padding:"11px",fontSize:14,borderRadius:12,opacity:loading?.7:1})}}>
                {loading ? "⏳ Reading recipe…" : "✨ Extract Recipe"}
              </button>
              <button onClick={() => { setPreview(null); setImageData(null); setMode("url"); }} style={btn("#f0ece6",C.muted)}>Clear</button>
            </div>
          </div>
        )}

        {/* URL input */}
        {mode === "url" && !preview && (
          <div>
            <Field label="Recipe URL">
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.bbcgoodfood.com/recipes/…"
                style={inp()} onKeyDown={e => e.key === "Enter" && extractFromUrl()} autoFocus />
            </Field>
            <button onClick={extractFromUrl} disabled={loading || !url.trim()} style={{...btn("linear-gradient(135deg,#2d6be4,#1a52c8)","#fff",{width:"100%",border:"none",padding:"12px",fontSize:15,borderRadius:12,opacity:loading||!url.trim()?.7:1})}}>
              {loading ? "⏳ Extracting…" : "✨ Import Recipe"}
            </button>
          </div>
        )}

        {error && <div style={{marginTop:12,background:"#fff0f0",border:"1px solid #fcc",borderRadius:8,padding:"10px 12px",color:"#e86b5f",fontSize:13,lineHeight:1.5}}>{error}</div>}

        <button onClick={onClose} style={{...btn("#f0ece6",C.muted,{width:"100%",marginTop:10,textAlign:"center"})}}>Cancel</button>
      </div>
    </div>
  );
};

// ── Cook Mode ─────────────────────────────────────────────────────────────────
const CookMode = ({meal, onClose}) => {
  const [step, setStep] = useState(0);
  const [servings, setServings] = useState(meal.servings || 2);
  const [timers, setTimers] = useState({});
  const intervals = useRef({});
  const steps = meal.steps || [];

  const fmtTime = s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const startTimer = (id, mins) => {
    setTimers(p => ({...p,[id]:{remaining:mins*60,running:true,done:false}}));
    intervals.current[id] = setInterval(() => {
      setTimers(p => {
        const t = p[id];
        if (!t || t.remaining <= 0) { clearInterval(intervals.current[id]); return {...p,[id]:{...t,running:false,done:true}}; }
        return {...p,[id]:{...t,remaining:t.remaining-1}};
      });
    }, 1000);
  };
  const pauseTimer = id => { clearInterval(intervals.current[id]); setTimers(p => ({...p,[id]:{...p[id],running:false}})); };
  const resetTimer = (id,mins) => { clearInterval(intervals.current[id]); setTimers(p => ({...p,[id]:{remaining:mins*60,running:false,done:false}})); };
  useEffect(() => () => Object.values(intervals.current).forEach(clearInterval), []);

  const scaleIng = ing => ({...ing, qty: scaleQty(ing.qty, meal.servings||2, servings)});

  return (
    <div style={{position:"fixed",inset:0,background:"#1a0f05",zIndex:3000,overflowY:"auto",fontFamily:"'Lato',sans-serif"}}>
      <div style={{maxWidth:780,margin:"0 auto",padding:"0 16px 48px"}}>
        {/* Header */}
        <div style={{position:"sticky",top:0,background:"#1a0f05",padding:"18px 0 14px",zIndex:10,borderBottom:"1px solid rgba(255,255,255,.07)",marginBottom:28}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{fontSize:11,color:C.accent,textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>🍳 Cook Mode</div>
              <h1 style={{fontFamily:"'Playfair Display',serif",color:"#fff",fontSize:24,marginTop:2}}>{meal.name}</h1>
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.06)",borderRadius:10,padding:"6px 12px"}}>
                <span style={{fontSize:12,color:"rgba(255,255,255,.4)"}}>Servings</span>
                <button onClick={() => setServings(s => Math.max(1,s-1))} style={{...btn("rgba(255,255,255,.1)","rgba(255,255,255,.8)",{padding:"2px 8px",border:"none",borderRadius:6})}}>−</button>
                <span style={{color:"#fff",fontWeight:700,minWidth:20,textAlign:"center"}}>{servings}</span>
                <button onClick={() => setServings(s => Math.min(12,s+1))} style={{...btn("rgba(255,255,255,.1)","rgba(255,255,255,.8)",{padding:"2px 8px",border:"none",borderRadius:6})}}>+</button>
              </div>
              <button onClick={onClose} style={{...btn("rgba(255,255,255,.08)","rgba(255,255,255,.6)",{border:"1px solid rgba(255,255,255,.14)"})}}>✕ Exit</button>
            </div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:28}}>
          {/* Ingredients */}
          <div>
            <div style={{color:C.accent,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:14,fontFamily:"'Playfair Display',serif"}}>Ingredients</div>
            {(meal.ingredients||[]).length === 0 && <div style={{color:"rgba(255,255,255,.3)",fontSize:13}}>None listed</div>}
            {(meal.ingredients||[]).map(ing => {
              const si = scaleIng(ing);
              return (
                <div key={ing.id} style={{display:"flex",gap:8,marginBottom:11,alignItems:"baseline"}}>
                  <span style={{color:C.accent,fontWeight:700,fontSize:14,minWidth:34,textAlign:"right",flexShrink:0}}>{si.qty}</span>
                  <span style={{color:"rgba(255,255,255,.4)",fontSize:12,minWidth:26,flexShrink:0}}>{si.unit}</span>
                  <span style={{color:"rgba(255,255,255,.82)",fontSize:13}}>{ing.name}</span>
                </div>
              );
            })}
            {meal.notes && (
              <div style={{marginTop:18,background:"rgba(45,107,228,.1)",border:"1px solid rgba(45,107,228,.18)",borderRadius:10,padding:13}}>
                <div style={{color:C.accent,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6,fontFamily:"'Playfair Display',serif"}}>Notes</div>
                <div style={{color:"rgba(255,255,255,.62)",fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{meal.notes}</div>
              </div>
            )}
            {meal.sourceUrl && <a href={meal.sourceUrl} target="_blank" rel="noreferrer" style={{display:"block",marginTop:12,color:C.accent,fontSize:12,textDecoration:"none",opacity:.55}}>🔗 Original</a>}
          </div>

          {/* Steps */}
          <div>
            <div style={{color:C.accent,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:1,marginBottom:14,fontFamily:"'Playfair Display',serif"}}>
              Method {steps.length > 0 && `· ${step+1} / ${steps.length}`}
            </div>
            {steps.length === 0 && <div style={{color:"rgba(255,255,255,.4)",fontSize:14,lineHeight:1.7}}>No steps added. Check the notes on the left.</div>}
            {steps.map((s,i) => {
              const active = i === step;
              const t = timers[s.id];
              return (
                <div key={s.id} onClick={() => setStep(i)} style={{marginBottom:10,borderRadius:14,padding:"14px 17px",cursor:"pointer",background:active?"rgba(45,107,228,.13)":"rgba(255,255,255,.03)",border:`1.5px solid ${active?C.accent:"rgba(255,255,255,.07)"}`,transition:"all .2s"}}>
                  <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:i<step?"#4caf78":active?C.accent:"rgba(255,255,255,.1)",color:"#fff",fontSize:11,fontWeight:700,flexShrink:0,marginTop:1}}>
                      {i < step ? "✓" : i+1}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{color:active?"#fff":"rgba(255,255,255,.44)",fontSize:14,lineHeight:1.75}}>{s.text}</div>
                      {s.timerMins > 0 && active && (
                        <div style={{marginTop:12,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                          <div style={{fontSize:30,fontWeight:700,fontFamily:"'Playfair Display',serif",color:t?.done?"#4caf78":t?.running?C.accent:"#fff",minWidth:80}}>
                            {t ? fmtTime(t.remaining) : fmtTime(s.timerMins*60)}
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            {!t?.running && !t?.done && <button onClick={e => {e.stopPropagation();startTimer(s.id,s.timerMins);}} style={btn("rgba(45,107,228,.3)",C.accent,{border:"none",padding:"6px 14px"})}>▶ Start</button>}
                            {t?.running && <button onClick={e => {e.stopPropagation();pauseTimer(s.id);}} style={btn("rgba(255,255,255,.1)","#fff",{border:"none",padding:"6px 14px"})}>⏸ Pause</button>}
                            {t && <button onClick={e => {e.stopPropagation();resetTimer(s.id,s.timerMins);}} style={btn("rgba(255,255,255,.05)","rgba(255,255,255,.4)",{border:"none",padding:"6px 10px"})}>↺</button>}
                            {t?.done && <span style={{color:"#4caf78",fontWeight:700,fontSize:14}}>✓ Done!</span>}
                          </div>
                        </div>
                      )}
                      {s.timerMins > 0 && !active && <div style={{marginTop:4,fontSize:11,color:"rgba(255,255,255,.24)"}}>⏱ {s.timerMins} min</div>}
                    </div>
                  </div>
                </div>
              );
            })}
            {steps.length > 0 && (
              <div style={{display:"flex",gap:10,marginTop:14}}>
                <button disabled={step===0} onClick={() => setStep(s => s-1)} style={{...btn("rgba(255,255,255,.07)","rgba(255,255,255,.6)",{border:"1px solid rgba(255,255,255,.1)",flex:1,padding:"10px",opacity:step===0?.35:1})}}>← Prev</button>
                <button disabled={step===steps.length-1} onClick={() => setStep(s => s+1)} style={{...btn(C.accent,"#fff",{border:"none",flex:1,padding:"10px",opacity:step===steps.length-1?.35:1})}}>Next →</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Meal Editor Modal ─────────────────────────────────────────────────────────
const MealEditor = ({meal, day, type, grid, favorites, onSave, onClose, onAddFavorite, onCookNow}) => {
  const [m, setM] = useState({...meal});
  const up = (k,v) => setM(p => ({...p,[k]:v}));
  const updateServings = v => { const ns=Number(v); setM(p => ({...p,servings:ns,ingredients:p.ingredients.map(i=>({...i,qty:scaleQty(i.qty,p.servings,ns)}))})); };
  const addIng = () => up("ingredients",[...m.ingredients,emptyIng()]);
  const removeIng = id => up("ingredients",m.ingredients.filter(i=>i.id!==id));
  const updIng = (id,k,v) => up("ingredients",m.ingredients.map(i=>i.id===id?{...i,[k]:v}:i));
  const addStep = () => up("steps",[...m.steps,emptyStep()]);
  const removeStep = id => up("steps",m.steps.filter(s=>s.id!==id));
  const updStep = (id,k,v) => up("steps",m.steps.map(s=>s.id===id?{...s,[k]:v}:s));
  const toggleTag = (key,tag) => { const c=m[key]; up(key,c.includes(tag)?c.filter(t=>t!==tag):[...c,tag]); };
  const allMealOptions = getAllMeals(grid).filter(({meal:mm}) => mm.id!==m.id && mm.name);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(30,20,10,.62)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(3px)"}} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{background:C.card,borderRadius:20,width:"100%",maxWidth:640,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,.26)",padding:32,fontFamily:"'Lato',sans-serif"}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div style={{flex:1,paddingRight:12}}>
            <div style={{fontSize:11,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:1}}>
              {day === "Library" ? "Recipe Library" : `${day} · ${type}`}
              {meal.label ? <span style={{marginLeft:8,color:"#7a5fc8"}}>· {meal.label}</span> : ""}
            </div>
            <input value={m.name} onChange={e=>up("name",e.target.value)} placeholder="Meal name…"
              style={{...inp(),fontSize:21,fontWeight:700,fontFamily:"'Playfair Display',serif",border:"none",background:"transparent",padding:"4px 0",marginTop:3}} autoFocus />
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            {m.name && <button onClick={() => onCookNow(m)} style={btn(C.dark,"#fff",{border:"none",padding:"7px 12px"})}>🍳 Cook</button>}
            <button onClick={() => onAddFavorite(m)} style={btn(C.light,C.accent)}>★ Save</button>
            <button onClick={onClose} style={btn("#f0ece6",C.muted)}>✕</button>
          </div>
        </div>

        <Field label="Recipe Category">
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {RECIPE_SECTIONS.map(s => (
              <button key={s} onClick={() => up("recipeSection",s)}
                style={{...btn(m.recipeSection===s?C.accent:C.light, m.recipeSection===s?"#fff":C.accent, {padding:"5px 12px",fontSize:12})}}>
                {s}
              </button>
            ))}
          </div>
        </Field>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:4}}>
          <Field label="Servings">
            <input type="number" min={1} max={12} value={m.servings} onChange={e=>updateServings(e.target.value)} style={inp()} />
          </Field>
          <Field label="Prep Time">
            <select value={m.prepTime} onChange={e=>up("prepTime",Number(e.target.value))} style={inp()}>
              {PREP_TIMES.map(t => <option key={t} value={t}>{t} min</option>)}
            </select>
          </Field>
        </div>

        <Field label="Source URL (optional)">
          <input value={m.sourceUrl||""} onChange={e=>up("sourceUrl",e.target.value)} placeholder="https://…" style={inp()} />
        </Field>

        <Field label="Meal Tags">
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {MEAL_TAGS.map(tag => (
              <button key={tag} onClick={() => toggleTag("tags",tag)} style={{borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Lato',sans-serif",background:m.tags.includes(tag)?`${MEAL_TAG_COLORS[tag]}22`:"#f5f0ea",color:m.tags.includes(tag)?MEAL_TAG_COLORS[tag]:"#999",border:`1.5px solid ${m.tags.includes(tag)?MEAL_TAG_COLORS[tag]:"#ddd"}`}}>
                {tag}
              </button>
            ))}
          </div>
        </Field>

        {m.tags.includes("Leftover") && (
          <Field label="Leftover from…">
            <select value={m.leftoverFrom} onChange={e=>up("leftoverFrom",e.target.value)} style={inp()}>
              <option value="">Select meal…</option>
              {allMealOptions.map(({meal:mm,day:d,type:t}) => <option key={mm.id} value={mm.id}>{mm.name} ({d} {t})</option>)}
            </select>
          </Field>
        )}

        <Field label="Dietary Tags">
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {DIETARY_TAGS.map(tag => (
              <button key={tag} onClick={() => toggleTag("dietaryTags",tag)} style={{borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Lato',sans-serif",background:m.dietaryTags.includes(tag)?`${TAG_COLORS[tag]}22`:"#f5f0ea",color:m.dietaryTags.includes(tag)?TAG_COLORS[tag]:"#999",border:`1.5px solid ${m.dietaryTags.includes(tag)?TAG_COLORS[tag]:"#ddd"}`}}>
                {tag}
              </button>
            ))}
          </div>
        </Field>

        {/* Ingredients */}
        <div style={{marginTop:4}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <label style={lbl()}>Ingredients</label>
            <button onClick={addIng} style={btn(C.light,C.accent,{padding:"5px 12px",fontSize:12})}>+ Add</button>
          </div>
          {m.ingredients.length === 0 && <div style={{color:"#ccc",fontSize:13,fontStyle:"italic",textAlign:"center",padding:"6px 0"}}>No ingredients yet</div>}
          {m.ingredients.map(ing => (
            <div key={ing.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1.4fr 20px",gap:5,marginBottom:6,alignItems:"center"}}>
              <input value={ing.name} onChange={e=>updIng(ing.id,"name",e.target.value)} placeholder="Ingredient" style={{...inp(),fontSize:13}} />
              <input type="number" value={ing.qty} onChange={e=>updIng(ing.id,"qty",Number(e.target.value))} style={{...inp(),fontSize:13}} min={0} step={0.25} />
              <select value={ing.unit} onChange={e=>updIng(ing.id,"unit",e.target.value)} style={{...inp(),fontSize:12}}>{UNITS.map(u=><option key={u}>{u}</option>)}</select>
              <select value={ing.section||"Other"} onChange={e=>updIng(ing.id,"section",e.target.value)} style={{...inp(),fontSize:11}}>{GROCERY_SECTIONS.map(s=><option key={s}>{s}</option>)}</select>
              <button onClick={()=>removeIng(ing.id)} style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:16,padding:0}}>×</button>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div style={{marginTop:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <label style={lbl()}>Method Steps</label>
            <button onClick={addStep} style={btn(C.light,C.accent,{padding:"5px 12px",fontSize:12})}>+ Step</button>
          </div>
          {m.steps.length === 0 && <div style={{color:"#ccc",fontSize:13,fontStyle:"italic",textAlign:"center",padding:"6px 0"}}>Add steps to use Cook Mode with timers</div>}
          {m.steps.map((s,i) => (
            <div key={s.id} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:C.light,color:C.accent,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:9}}>{i+1}</div>
              <textarea value={s.text} onChange={e=>updStep(s.id,"text",e.target.value)} placeholder={`Step ${i+1}…`} style={{...inp(),height:52,resize:"none",flex:1,fontSize:13}} />
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>
                <label style={{fontSize:9,color:C.muted,textAlign:"center",lineHeight:1.2}}>Timer<br/>mins</label>
                <input type="number" min={0} value={s.timerMins} onChange={e=>updStep(s.id,"timerMins",Number(e.target.value))} style={{...inp(),width:50,textAlign:"center",fontSize:13,padding:"7px 4px"}} />
              </div>
              <button onClick={()=>removeStep(s.id)} style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:16,marginTop:9}}>×</button>
            </div>
          ))}
        </div>

        <Field label="Notes / Tips" mt={10}>
          <textarea value={m.notes} onChange={e=>up("notes",e.target.value)} placeholder="Tips, substitutions, sauce instructions…" style={{...inp(),height:68,resize:"vertical"}} />
        </Field>

        <button onClick={() => onSave(m)} style={{marginTop:14,width:"100%",padding:"13px",background:"linear-gradient(135deg,#2d6be4,#1a52c8)",color:"#fff",border:"none",borderRadius:12,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"'Playfair Display',serif",boxShadow:"0 4px 16px rgba(200,99,42,.3)"}}>
          Save Meal
        </button>
      </div>
    </div>
  );
};

// ── Meal Card ─────────────────────────────────────────────────────────────────

const SPLIT_LABELS = ["Adults","Kids","Work","Home","Doug","Rachel","Custom…"];

const SingleCard = ({meal, onEdit, onClear, onCookNow, compact=false}) => {
  if (!meal || !meal.name) return null;
  const pd = meal.dietaryTags?.[0];
  const cc = pd ? TAG_COLORS[pd] : C.accent;
  const isSkip = meal.tags?.includes("Skip");
  return (
    <div style={{borderRadius:8,padding:compact?"6px 8px":"8px 10px",background:isSkip?"#f5f5f5":C.card,border:`1.5px solid ${isSkip?"#ddd":cc+"44"}`,borderLeft:`3px solid ${isSkip?"#bbb":cc}`,position:"relative",opacity:isSkip?.5:1,fontFamily:"'Lato',sans-serif",transition:"box-shadow .15s",cursor:"pointer"}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 3px 10px rgba(0,0,0,.08)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
      <button onClick={e=>{e.stopPropagation();onClear();}} style={{position:"absolute",top:3,right:5,background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:13,padding:1,lineHeight:1}}>×</button>
      {!compact && <button onClick={e=>{e.stopPropagation();onCookNow(meal);}} title="Cook now" style={{position:"absolute",bottom:3,right:6,background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:10,padding:0,lineHeight:1}}>🍳</button>}
      <div onClick={()=>onEdit(meal)}>
        {meal.label && <div style={{fontSize:9,fontWeight:800,color:C.accent,textTransform:"uppercase",letterSpacing:.8,marginBottom:2}}>{meal.label}</div>}
        <div style={{fontSize:compact?11:12,fontWeight:700,color:C.text,paddingRight:16,lineHeight:1.3,fontFamily:"'Playfair Display',serif"}}>{meal.name}</div>
        {!compact && <div style={{display:"flex",flexWrap:"wrap",gap:2,marginTop:3}}>
          {meal.tags?.slice(0,1).map(t=><Badge key={t} label={t} color={MEAL_TAG_COLORS[t]} small/>)}
          {meal.dietaryTags?.slice(0,1).map(t=><Badge key={t} label={t} color={TAG_COLORS[t]} small/>)}
        </div>}
        <div style={{fontSize:9,color:C.muted,marginTop:2}}>{meal.servings} srv · {meal.prepTime}min</div>
      </div>
    </div>
  );
};

const MealCard = ({slot, day, type, onEditSingle, onClearSlot, onClearSub, onSplitAdd, onQuickFill, onCookNow, favorites}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const menuRef = useRef();

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) { setShowMenu(false); setShowSplitPicker(false); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isSplit = slot?.split === true;
  const isEmpty = !slot || (!isSplit && !slot.name);

  const addSplit = (label) => {
    const lbl = label === "Custom…" ? (customLabel.trim() || "Custom") : label;
    onSplitAdd(lbl);
    setShowSplitPicker(false);
    setShowMenu(false);
    setCustomLabel("");
  };

  if (isEmpty) return (
    <div style={{position:"relative"}} ref={menuRef}>
      <div onClick={()=>setShowMenu(f=>!f)}
        style={{minHeight:52,border:`1.5px dashed ${C.border}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:12,cursor:"pointer",background:C.card,fontFamily:"'Lato',sans-serif",transition:"border-color .15s"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
        onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
        + Add meal
      </div>
      {showMenu && (
        <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.12)",overflow:"hidden",marginTop:4}}>
          {favorites.length>0 && <div style={{padding:"5px 10px",fontSize:10,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:1,borderBottom:`1px solid ${C.border}`}}>Quick Fill</div>}
          {favorites.map(fav=>(
            <div key={fav.id} onClick={()=>{onQuickFill(fav);setShowMenu(false);}}
              style={{padding:"8px 12px",fontSize:13,cursor:"pointer",color:C.text,borderBottom:`1px solid ${C.border}`,fontFamily:"'Lato',sans-serif"}}
              onMouseEnter={e=>e.currentTarget.style.background=C.light}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              {fav.name}
            </div>
          ))}
          <div onClick={()=>{onEditSingle(emptyMeal());setShowMenu(false);}} style={{padding:"8px 12px",fontSize:13,cursor:"pointer",color:C.accent,fontWeight:700,fontFamily:"'Lato',sans-serif",borderBottom:`1px solid ${C.border}`}}>
            + New meal…
          </div>
          <div onClick={()=>setShowSplitPicker(true)} style={{padding:"8px 12px",fontSize:13,cursor:"pointer",color:"#7a5fc8",fontWeight:700,fontFamily:"'Lato',sans-serif"}}>
            ⊕ Split meal (different meals for different people)
          </div>
          {showSplitPicker && (
            <div style={{padding:"8px 12px",borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:.7}}>First group label</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {SPLIT_LABELS.filter(l=>l!=="Custom…").map(l=>(
                  <button key={l} onClick={()=>addSplit(l)} style={{...btn(C.light,C.accent,{padding:"4px 10px",fontSize:11,borderRadius:16})}}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <input value={customLabel} onChange={e=>setCustomLabel(e.target.value)} placeholder="Custom label…" style={{...inp(),fontSize:12,flex:1}} onKeyDown={e=>e.key==="Enter"&&addSplit("Custom…")} />
                <button onClick={()=>addSplit("Custom…")} style={btn(C.accent,"#fff",{border:"none",padding:"6px 12px",fontSize:12})}>Add</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Split slot
  if (isSplit) {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {(slot.meals||[]).map((m,i) => (
          <SingleCard key={m.id} meal={m} compact onEdit={meal=>onEditSingle(meal,i)} onClear={()=>onClearSub(i)} onCookNow={onCookNow} />
        ))}
        <div style={{position:"relative"}} ref={showSplitPicker?menuRef:null}>
          <button onClick={()=>setShowSplitPicker(f=>!f)} style={{width:"100%",background:"none",border:`1px dashed ${C.border}`,borderRadius:8,padding:"4px 0",fontSize:11,color:C.accent,fontWeight:700,cursor:"pointer",fontFamily:"'Lato',sans-serif"}}>
            + Add another
          </button>
          {showSplitPicker && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:50,background:C.card,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.12)",padding:"10px 12px",marginTop:4}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:.7}}>Group label</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {SPLIT_LABELS.filter(l=>l!=="Custom…").map(l=>(
                  <button key={l} onClick={()=>addSplit(l)} style={{...btn(C.light,C.accent,{padding:"4px 10px",fontSize:11,borderRadius:16})}}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:6,marginTop:8}}>
                <input value={customLabel} onChange={e=>setCustomLabel(e.target.value)} placeholder="Custom label…" style={{...inp(),fontSize:12,flex:1}} onKeyDown={e=>e.key==="Enter"&&addSplit("Custom…")} />
                <button onClick={()=>addSplit("Custom…")} style={btn(C.accent,"#fff",{border:"none",padding:"6px 12px",fontSize:12})}>Add</button>
              </div>
            </div>
          )}
        </div>
        <button onClick={onClearSlot} style={{background:"none",border:"none",color:"#ccc",cursor:"pointer",fontSize:10,padding:"2px 0",fontFamily:"'Lato',sans-serif",textAlign:"center"}}>Clear all</button>
      </div>
    );
  }

  // Normal single meal
  return (
    <div style={{position:"relative"}}>
      <SingleCard meal={slot} onEdit={onEditSingle} onClear={onClearSlot} onCookNow={onCookNow} />
    </div>
  );
};

// ── Grocery List ──────────────────────────────────────────────────────────────
const GroceryList = ({groceryData, customItems, setCustomItems, checkedItems, setCheckedItems, alreadyHave, setAlreadyHave}) => {
  const [expanded, setExpanded] = useState(GROCERY_SECTIONS.reduce((a,s) => ({...a,[s]:true}), {}));
  const addCustom = () => setCustomItems(p => [...p, {...emptyIng(),isCustom:true}]);
  const removeCustom = id => setCustomItems(p => p.filter(i => i.id!==id));
  const updCustom = (id,k,v) => setCustomItems(p => p.map(i => i.id===id?{...i,[k]:v}:i));

  let total=0, checked=0;
  GROCERY_SECTIONS.forEach(s => (groceryData[s]||[]).forEach(item => { if (!alreadyHave[item.key||item.id]) { total++; if (checkedItems[item.key||item.id]) checked++; } }));

  const copyList = () => {
    const lines = ["🛒 GROCERY LIST\n"];
    GROCERY_SECTIONS.forEach(sec => {
      const items = (groceryData[sec]||[]).filter(i => !alreadyHave[i.key||i.id]);
      if (!items.length) return;
      lines.push(`\n${sec.toUpperCase()}`);
      items.forEach(item => lines.push(`${checkedItems[item.key||item.id]?"✓":"○"} ${item.name} — ${item.qty} ${item.unit}`));
    });
    navigator.clipboard.writeText(lines.join("\n")).then(() => alert("Copied!")).catch(() => {});
  };

  return (
    <div style={{fontFamily:"'Lato',sans-serif"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,fontSize:22,fontFamily:"'Playfair Display',serif",color:C.text}}>🛒 Grocery List</h2>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>{checked} of {total} items checked</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={copyList} style={btn(C.dark,"#fff",{border:"none"})}>📋 Copy List</button>
          <button onClick={addCustom} style={btn(C.light,C.accent)}>+ Custom Item</button>
        </div>
      </div>

      {GROCERY_SECTIONS.map(sec => {
        const items = groceryData[sec] || [];
        if (!items.length) return null;
        const activeCount = items.filter(i => !alreadyHave[i.key||i.id]).length;
        return (
          <div key={sec} style={{marginBottom:13}}>
            <div onClick={() => setExpanded(p => ({...p,[sec]:!p[sec]}))} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"8px 12px",background:"#e8f0fc",borderRadius:10,marginBottom:expanded[sec]?6:0,userSelect:"none"}}>
              <span style={{fontSize:18}}>{SECTION_ICONS[sec]}</span>
              <span style={{fontWeight:700,fontSize:14,color:C.text,flex:1,fontFamily:"'Playfair Display',serif"}}>{sec}</span>
              <span style={{fontSize:12,color:C.muted}}>{activeCount} items</span>
              <span style={{fontSize:11,color:"#ccc"}}>{expanded[sec]?"▲":"▼"}</span>
            </div>
            {expanded[sec] && items.map(item => {
              const key = item.key||item.id;
              const isHave = alreadyHave[key];
              const isChecked = checkedItems[key];
              return (
                <div key={key} style={{display:"flex",gap:10,alignItems:"center",padding:"9px 12px",borderRadius:8,marginBottom:3,background:isHave?"#f5f5f0":isChecked?"#f5fcf5":C.card,border:`1px solid ${isHave?"#eee":isChecked?"#c8e6c9":C.border}`,opacity:isHave?.5:1,transition:"all .15s"}}>
                  <input type="checkbox" checked={isChecked||false} onChange={() => setCheckedItems(p=>({...p,[key]:!p[key]}))} style={{accentColor:C.accent,cursor:"pointer",width:16,height:16,flexShrink:0}} />
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:isChecked?400:600,color:C.text,textDecoration:isChecked?"line-through":"none"}}>{item.name}</div>
                    <div style={{fontSize:11,color:C.muted}}>{item.qty} {item.unit}{item.meals?.length>0&&` · ${item.meals.slice(0,2).join(", ")}${item.meals.length>2?"…":""}`}</div>
                  </div>
                  <button onClick={() => setAlreadyHave(p=>({...p,[key]:!p[key]}))} style={{background:isHave?"#e8f5e9":"#f5f5f5",border:"none",borderRadius:6,padding:"3px 9px",fontSize:11,cursor:"pointer",color:isHave?"#4caf78":"#bbb",fontWeight:700}}>
                    {isHave?"✓ Have":"Have?"}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}

      {customItems.length > 0 && (
        <div style={{marginTop:20}}>
          <div style={{fontWeight:700,fontSize:12,color:C.accent,textTransform:"uppercase",letterSpacing:1,marginBottom:8,fontFamily:"'Playfair Display',serif"}}>Extra Items</div>
          {customItems.map(ci => (
            <div key={ci.id} style={{display:"grid",gridTemplateColumns:"1fr 80px 1fr 20px",gap:6,marginBottom:6,alignItems:"center"}}>
              <input value={ci.name} onChange={e=>updCustom(ci.id,"name",e.target.value)} placeholder="Item" style={{...inp(),fontSize:13}} />
              <input value={ci.qty} onChange={e=>updCustom(ci.id,"qty",e.target.value)} placeholder="Qty" style={{...inp(),fontSize:13}} />
              <select value={ci.section} onChange={e=>updCustom(ci.id,"section",e.target.value)} style={{...inp(),fontSize:12}}>{GROCERY_SECTIONS.map(s=><option key={s}>{s}</option>)}</select>
              <button onClick={()=>removeCustom(ci.id)} style={{background:"none",border:"none",color:"#ddd",cursor:"pointer",fontSize:16}}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Recipe Library ────────────────────────────────────────────────────────────
const RecipeLibrary = ({recipes, onDelete, onCookNow, onImport, onEdit, onAddManual}) => {
  const [filter, setFilter] = useState("All");
  const filtered = filter === "All" ? recipes : recipes.filter(r => r.recipeSection === filter);
  return (
    <div style={{fontFamily:"'Lato',sans-serif"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,fontSize:22,fontFamily:"'Playfair Display',serif",color:C.text}}>📖 Recipe Library</h2>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>{recipes.length} saved recipes</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button onClick={onAddManual} style={btn(C.light,C.accent,{padding:"9px 16px",fontSize:13,borderRadius:10})}>
            + Add Manually
          </button>
          <button onClick={onImport} style={btn("linear-gradient(135deg,#2d6be4,#1a52c8)","#fff",{border:"none",padding:"9px 18px",fontSize:13,borderRadius:10})}>
            ✨ Import Recipe
          </button>
        </div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:20}}>
        {["All",...RECIPE_SECTIONS].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{...btn(filter===s?C.accent:C.light,filter===s?"#fff":C.accent,{padding:"5px 14px",fontSize:12,borderRadius:20})}}>
            {s}
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
          <div style={{fontSize:36}}>📖</div>
          <div style={{marginTop:10,fontSize:15}}>No recipes yet</div>
          <div style={{fontSize:13,marginTop:6}}>Import from a URL or photo of a recipe book, or save any planned meal</div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
        {filtered.map(r => (
          <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,.04)"}}>
            <div style={{fontSize:11,color:C.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:4,fontFamily:"'Playfair Display',serif"}}>{r.recipeSection}</div>
            <div style={{fontWeight:700,fontSize:15,color:C.text,fontFamily:"'Playfair Display',serif",lineHeight:1.3,marginBottom:5}}>{r.name}</div>
            <div style={{fontSize:12,color:C.muted,marginBottom:7}}>{r.servings} srv · {r.prepTime}min · {r.ingredients?.length||0} ingredients · {r.steps?.length||0} steps</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>{r.dietaryTags?.slice(0,3).map(t=><Badge key={t} label={t} color={TAG_COLORS[t]} small/>)}</div>
            {r.sourceUrl && <div style={{fontSize:11,color:C.accent,marginBottom:10,opacity:.55,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>🔗 {r.sourceUrl}</div>}
            <div style={{display:"flex",gap:6}}>
              <button onClick={() => onCookNow(r)} style={btn(C.dark,"#fff",{border:"none",flex:1,fontSize:12,padding:"7px"})}>🍳 Cook</button>
              <button onClick={() => onEdit(r)} style={btn(C.light,C.accent,{flex:1,fontSize:12,padding:"7px"})}>✏️ Edit</button>
              <button onClick={() => onDelete(r.id)} style={btn("#fef0f0","#e86b5f",{fontSize:12,padding:"7px 10px"})}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Meal Prep ─────────────────────────────────────────────────────────────────
const MealPrep = ({grid}) => {
  // useState MUST come before any conditional returns
  const [checked, setChecked] = useState({});

  const prep = getAllMeals(grid)
    .filter(({meal:m}) => m.name && Array.isArray(m.tags) && m.tags.includes("Meal Prep"))
    .sort((a,b) => (b.meal.prepTime||0) - (a.meal.prepTime||0));

  const total = prep.reduce((s,{meal:m}) => s + (m.prepTime||0), 0);

  if (prep.length === 0) {
    return (
      <div style={{textAlign:"center",padding:"60px 20px",color:C.muted,fontFamily:"'Lato',sans-serif"}}>
        <div style={{fontSize:36}}>🍳</div>
        <div style={{marginTop:10,fontSize:15}}>No meals tagged "Meal Prep" yet</div>
        <div style={{fontSize:13,marginTop:6,opacity:.7}}>Tag a meal as "Meal Prep" in the planner to see it here</div>
      </div>
    );
  }

  return (
    <div style={{fontFamily:"'Lato',sans-serif"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:22,fontFamily:"'Playfair Display',serif",color:C.text}}>🍳 Meal Prep</h2>
        <div style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 14px",fontSize:13,fontWeight:700,color:C.accent}}>Total: {total} min</div>
      </div>
      <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Cook longest first — tick off as you go:</div>
      {prep.map(({meal:m,day,type},i) => (
        <div key={m.id} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"14px 16px",borderRadius:12,marginBottom:10,background:checked[m.id]?"#f5fcf5":C.card,border:`1px solid ${checked[m.id]?"#c8e6c9":C.border}`,transition:"all .15s"}}>
          <input type="checkbox" checked={!!checked[m.id]} onChange={() => setChecked(p => ({...p,[m.id]:!p[m.id]}))} style={{accentColor:C.accent,cursor:"pointer",width:18,height:18,marginTop:2}} />
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14,color:C.text,fontFamily:"'Playfair Display',serif",textDecoration:checked[m.id]?"line-through":"none"}}>{i+1}. {m.name}</div>
            <div style={{fontSize:12,color:C.muted,marginTop:2}}>{day} · {type} · {m.servings} srv</div>
          </div>
          <div style={{background:C.light,border:`1px solid ${C.border}`,borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:700,color:C.accent,whiteSpace:"nowrap"}}>{m.prepTime} min</div>
        </div>
      ))}
    </div>
  );
};

// ── Receipt Tracker ───────────────────────────────────────────────────────────
const ReceiptTracker = () => {
  const [receipts, setReceipts] = useState(() => { try { const s=localStorage.getItem("receipts_v2"); return s?JSON.parse(s):[]; } catch { return []; } });
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  useEffect(() => { try { localStorage.setItem("receipts_v2",JSON.stringify(receipts)); } catch {} }, [receipts]);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzing(true); setError("");
    try {
      const b64 = await new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
      const json = await callClaude(
        [{role:"user",content:[{type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:b64}},{type:"text",text:"Extract the shopping receipt data from this image."}]}],
        `Extract shopping receipt data. Return ONLY valid JSON:
{"store":string,"date":string,"total":number,"items":[{"name":string,"qty":number,"price":number,"section":string}]}
section from: Produce,Meat & Seafood,Dairy & Eggs,Pantry & Dry Goods,Frozen,Bakery & Bread,Beverages,Condiments & Sauces,Snacks,Home,Utility,Bathroom,Other`
      );
      const parsed = JSON.parse(json);
      setReceipts(p => [{id:uid(),uploadedAt:new Date().toISOString(),fileName:file.name,...parsed},...p]);
    } catch {
      setError("Couldn't read that receipt. Try a clear, well-lit photo of the full receipt (JPEG or PNG).");
    }
    setAnalyzing(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const totalSpent = receipts.reduce((s,r) => s+(r.total||0), 0);
  const bySection = {};
  receipts.forEach(r => (r.items||[]).forEach(i => { const s=i.section||"Other"; bySection[s]=(bySection[s]||0)+(i.price||0); }));
  const byStore = {};
  receipts.forEach(r => { if (r.store) byStore[r.store]=(byStore[r.store]||0)+(r.total||0); });
  const topSection = Object.entries(bySection).sort((a,b) => b[1]-a[1])[0];
  const avgWeekly = receipts.length ? totalSpent / Math.max(1,Math.ceil(receipts.length/4)) : 0;

  return (
    <div style={{fontFamily:"'Lato',sans-serif"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,fontSize:22,fontFamily:"'Playfair Display',serif",color:C.text}}>🧾 Receipt Tracker</h2>
          <div style={{fontSize:13,color:C.muted,marginTop:2}}>{receipts.length} receipts · track spending over time</div>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{display:"none"}} />
          <button onClick={() => fileRef.current?.click()} disabled={analyzing} style={btn("linear-gradient(135deg,#2d6be4,#1a52c8)","#fff",{border:"none",padding:"9px 18px",fontSize:13,borderRadius:10,opacity:analyzing?.7:1})}>
            {analyzing ? "⏳ Reading…" : "📸 Upload Receipt"}
          </button>
        </div>
      </div>

      {error && <div style={{background:"#fff0f0",border:"1px solid #fcc",borderRadius:10,padding:"12px 16px",color:"#e86b5f",fontSize:13,marginBottom:16}}>{error}</div>}

      {receipts.length > 0 && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:24}}>
            {[{label:"Total Spent",value:`£${totalSpent.toFixed(2)}`,icon:"💷"},{label:"Avg Weekly",value:`£${avgWeekly.toFixed(2)}`,icon:"📅"},{label:"Top Category",value:topSection?`${SECTION_ICONS[topSection[0]]||""} ${topSection[0]}`:"—",icon:"🏆"},{label:"Shops",value:Object.keys(byStore).length,icon:"🏪"}].map(s=>(
              <div key={s.label} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:22}}>{s.icon}</div>
                <div style={{fontWeight:700,fontSize:18,color:C.text,marginTop:4,fontFamily:"'Playfair Display',serif"}}>{s.value}</div>
                <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:.5}}>{s.label}</div>
              </div>
            ))}
          </div>
          {Object.keys(bySection).length > 0 && (
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20,marginBottom:24}}>
              <div style={{fontWeight:700,fontSize:14,fontFamily:"'Playfair Display',serif",color:C.text,marginBottom:14}}>Spending by Category</div>
              {Object.entries(bySection).sort((a,b)=>b[1]-a[1]).map(([sec,amt]) => {
                const pct = Math.round(amt/totalSpent*100)||0;
                return (
                  <div key={sec} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                      <span style={{color:C.text}}>{SECTION_ICONS[sec]||""} {sec}</span>
                      <span style={{color:C.accent,fontWeight:700}}>£{amt.toFixed(2)} <span style={{color:C.muted,fontWeight:400,fontSize:11}}>({pct}%)</span></span>
                    </div>
                    <div style={{height:5,background:"#f0e8d8",borderRadius:3}}>
                      <div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${C.accent},#e8a44a)`,borderRadius:3}} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {receipts.length === 0 && (
        <div style={{textAlign:"center",padding:"60px 20px",color:C.muted}}>
          <div style={{fontSize:36}}>🧾</div>
          <div style={{marginTop:10,fontSize:15}}>No receipts yet</div>
          <div style={{fontSize:13,marginTop:6}}>Upload a photo — Claude reads it automatically and tracks your spending</div>
        </div>
      )}

      {receipts.map(r => (
        <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:16,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <div>
              <div style={{fontWeight:700,fontSize:15,color:C.text,fontFamily:"'Playfair Display',serif"}}>{r.store||"Unknown Store"}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{r.date||"Date unknown"} · {r.items?.length||0} items · <span style={{fontWeight:700,color:C.accent}}>£{(r.total||0).toFixed(2)}</span></div>
            </div>
            <button onClick={() => setReceipts(p => p.filter(x => x.id!==r.id))} style={btn("#fef0f0","#e86b5f",{fontSize:12,padding:"5px 10px"})}>Delete</button>
          </div>
          {(r.items||[]).length > 0 && (
            <div style={{maxHeight:160,overflowY:"auto"}}>
              {r.items.map((item,i) => (
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #f5f0ea",fontSize:13}}>
                  <span style={{color:C.text}}>{item.name}</span>
                  <span style={{color:C.accent,fontWeight:600}}>£{(item.price||0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const saved = loadState();
  const [grid, setGrid] = useState(saved?.grid || buildEmptyGrid());
  const [favorites, setFavorites] = useState(saved?.favorites || []);
  const [recipes, setRecipes] = useState(saved?.recipes || []);
  const [customItems, setCustomItems] = useState(saved?.customItems || []);
  const [checkedItems, setCheckedItems] = useState({});
  const [alreadyHave, setAlreadyHave] = useState({});
  const [tab, setTab] = useState("planner");
  const [editing, setEditing] = useState(null);
  const [cookingMeal, setCookingMeal] = useState(null);
  const [showImporter, setShowImporter] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => saveState({grid,favorites,recipes,customItems}), [grid,favorites,recipes,customItems]);

  const groceryData = buildGrocery(grid, customItems);

  const setSlot = (day,type,slot) => setGrid(g => ({...g,[day]:{...g[day],[type]:slot}}));
  const clearSlot = (day,type) => setSlot(day,type,null);

  // Single meal edit — works for both plain and split slots
  // editingCtx stores {day,type,subIdx} so saveEdit knows where to write back
  const openEditor = (day,type,meal,subIdx=null) => setEditing({meal:meal||emptyMeal(),day,type,subIdx});

  const saveEdit = (m) => {
    const {day,type,subIdx} = editing;
    if (subIdx !== null && subIdx !== undefined) {
      // Writing back into a split slot
      setGrid(g => {
        const slot = g[day][type];
        const meals = [...(slot.meals||[])];
        meals[subIdx] = m;
        return {...g,[day]:{...g[day],[type]:{...slot,meals}}};
      });
    } else {
      setSlot(day,type,m);
    }
    saveRecipe(m);
    setEditing(null);
  };

  const addFavorite = (meal) => { if (!meal.name) return; setFavorites(p => p.find(f=>f.name===meal.name)?p:[...p,{...meal,id:uid()}]); };

  // Quick-fill a plain slot with a favourite
  const quickFill = (day,type,fav) => setSlot(day,type,{...fav,id:uid()});

  // Start a split slot with the first sub-meal (blank, labelled)
  const splitAdd = (day,type,label) => {
    const slot = grid[day][type];
    if (slot?.split) {
      // Add another sub-meal to existing split
      const newMeal = {...emptyMeal(), label};
      setSlot(day,type,{...slot,meals:[...(slot.meals||[]),newMeal]});
      setEditing({meal:newMeal,day,type,subIdx:(slot.meals||[]).length});
    } else {
      // Convert plain (or empty) slot to split
      const existing = slot && slot.name ? [{...slot,label:""}] : [];
      const newMeal = {...emptyMeal(), label};
      setSlot(day,type,{split:true,meals:[...existing,newMeal]});
      setEditing({meal:newMeal,day,type,subIdx:existing.length});
    }
  };

  // Clear one sub-meal from a split slot; collapse to plain if only one remains
  const clearSub = (day,type,subIdx) => {
    const slot = grid[day][type];
    if (!slot?.split) return;
    const meals = (slot.meals||[]).filter((_,i)=>i!==subIdx);
    if (meals.length <= 1) {
      setSlot(day,type,meals[0]||null);
    } else {
      setSlot(day,type,{...slot,meals});
    }
  };
  const saveRecipe = (meal) => { if (!meal.name) return; setRecipes(p => [{...meal,id:uid()},...p.filter(r=>r.name!==meal.name)]); };
  const handleImport = (meal) => { setShowImporter(false); saveRecipe(meal); setTab("recipes"); };
  const handleEditRecipe = (r) => setEditing({meal:r,day:"Library",type:r.recipeSection});
  const handleAddManual = () => setEditing({meal:emptyMeal(),day:"Library",type:"Dinner"});

  const onDragStart = (day,type,meal) => { dragRef.current = {day,type,meal}; };
  const onDrop = (td,tt) => {
    if (!dragRef.current) return;
    const {day,type,meal} = dragRef.current;
    if (day===td && type===tt) return;
    const target = grid[td][tt];
    setGrid(g => ({...g,[td]:{...g[td],[tt]:meal},[day]:{...g[day],[type]:target||null}}));
    dragRef.current = null;
  };

  const named = getAllMeals(grid).filter(m => m.meal.name);
  const eatingOut = named.filter(m => m.meal.tags?.includes("Eating Out")).length;
  const leftovers = named.filter(m => m.meal.tags?.includes("Leftover")).length;
  const prepTime = named.reduce((s,m) => s+(m.meal.tags?.includes("Eating Out")?0:(m.meal.prepTime||0)), 0);

  const TABS = [
    {id:"planner",label:"📅 Planner"},
    {id:"grocery",label:"🛒 Grocery"},
    {id:"prep",label:"🍳 Prep"},
    {id:"recipes",label:"📖 Recipes"},
    {id:"receipts",label:"🧾 Receipts"},
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Lato:wght@300;400;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#b8c8dc; border-radius:3px; }
        input, select, textarea { font-family:'Lato',sans-serif; }
        input:focus, select:focus, textarea:focus { border-color:#2d6be4 !important; box-shadow:0 0 0 2px rgba(45,107,228,.12) !important; }
      `}</style>

      <div style={{minHeight:"100vh",background:C.bg}}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${C.dark} 0%,#1e3a6e 100%)`,color:"#fff",padding:"0 20px"}}>
          <div style={{maxWidth:1400,margin:"0 auto"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",flexWrap:"wrap",gap:10}}>
              <div>
                <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700}}>🍽️ Weekly Meal Planner</h1>
                <div style={{fontSize:11,opacity:.45,marginTop:1}}>Plan · Shop · Cook</div>
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                {[{l:"Planned",v:`${named.length}/${DAYS.length*MEAL_TYPES.length}`},{l:"Out",v:eatingOut},{l:"Leftovers",v:leftovers},{l:"Prep",v:`${prepTime}m`}].map(s => (
                  <div key={s.l} style={{textAlign:"center",background:"rgba(255,255,255,.07)",borderRadius:10,padding:"5px 12px"}}>
                    <div style={{fontSize:16,fontWeight:700,fontFamily:"'Playfair Display',serif"}}>{s.v}</div>
                    <div style={{fontSize:9,opacity:.45,textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
                  </div>
                ))}
                <button onClick={() => {if(window.confirm("Clear all meals for the week?"))setGrid(buildEmptyGrid());}} style={{...btn("rgba(255,255,255,.07)","rgba(255,255,255,.7)",{border:"1px solid rgba(255,255,255,.13)"})}}>Clear Week</button>
              </div>
            </div>
            <div style={{display:"flex",gap:0,borderTop:"1px solid rgba(255,255,255,.07)"}}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{background:"none",border:"none",color:tab===t.id?"#7eb8f7":"rgba(255,255,255,.4)",padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer",borderBottom:tab===t.id?"2px solid #7eb8f7":"2px solid transparent",transition:"all .15s",fontFamily:"'Lato',sans-serif"}}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{maxWidth:1400,margin:"0 auto",padding:"22px 16px"}}>

          {tab === "planner" && (
            <div style={{overflowX:"auto"}}>
              <div style={{display:"grid",gridTemplateColumns:"68px repeat(7,1fr)",gap:6,minWidth:800}}>
                {/* Day headers */}
                <div />
                {DAYS.map(day => (
                  <div key={day} style={{textAlign:"center",fontWeight:700,fontSize:12,color:C.text,padding:"6px 4px",borderBottom:`2px solid ${C.border}`,fontFamily:"'Playfair Display',serif"}}>
                    {day}
                  </div>
                ))}
                {/* Meal rows — use Fragment with key to avoid the keyed-fragment bug */}
                {MEAL_TYPES.map(type => (
                  <Fragment key={type}>
                    <div style={{display:"flex",alignItems:"flex-start",paddingTop:8,fontSize:10,fontWeight:700,color:C.accent,textTransform:"uppercase",letterSpacing:.5,fontFamily:"'Playfair Display',serif"}}>
                      {type}
                    </div>
                    {DAYS.map(day => (
                      <div key={`${day}-${type}`}
                        draggable={!!(grid[day]?.[type]?.name && !grid[day]?.[type]?.split)}
                        onDragStart={() => { const s=grid[day]?.[type]; if(s?.name && !s?.split) onDragStart(day,type,s); }}
                        onDragOver={e => e.preventDefault()}
                        onDrop={() => onDrop(day,type)}
                        style={{padding:2}}>
                        <MealCard
                          slot={grid[day]?.[type]}
                          day={day} type={type}
                          favorites={favorites}
                          onEditSingle={(meal,subIdx) => openEditor(day,type,meal,subIdx)}
                          onClearSlot={() => clearSlot(day,type)}
                          onClearSub={(subIdx) => clearSub(day,type,subIdx)}
                          onSplitAdd={(label) => splitAdd(day,type,label)}
                          onQuickFill={fav => quickFill(day,type,fav)}
                          onCookNow={meal => setCookingMeal(meal)}
                        />
                      </div>
                    ))}
                  </Fragment>
                ))}
              </div>
            </div>
          )}

          {tab === "grocery" && (
            <GroceryList
              groceryData={groceryData} customItems={customItems} setCustomItems={setCustomItems}
              checkedItems={checkedItems} setCheckedItems={setCheckedItems}
              alreadyHave={alreadyHave} setAlreadyHave={setAlreadyHave}
            />
          )}

          {tab === "prep" && <MealPrep grid={grid} />}

          {tab === "recipes" && (
            <RecipeLibrary
              recipes={recipes}
              onDelete={id => setRecipes(p => p.filter(r => r.id!==id))}
              onCookNow={meal => setCookingMeal(meal)}
              onImport={() => setShowImporter(true)}
              onEdit={handleEditRecipe}
              onAddManual={handleAddManual}
            />
          )}

          {tab === "receipts" && <ReceiptTracker />}
        </div>
      </div>

      {/* Modals */}
      {editing && (
        <MealEditor
          meal={editing.meal} day={editing.day} type={editing.type}
          grid={grid} favorites={favorites}
          onSave={saveEdit}
          onClose={() => setEditing(null)}
          onAddFavorite={addFavorite}
          onCookNow={meal => { setEditing(null); setCookingMeal(meal); }}
        />
      )}

      {cookingMeal && <CookMode meal={cookingMeal} onClose={() => setCookingMeal(null)} />}
      {showImporter && <RecipeImporter onImport={handleImport} onClose={() => setShowImporter(false)} />}
    </>
  );
}
