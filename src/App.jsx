import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const categories = [
  { id: "services", label: "خدمات" },
  { id: "alerts", label: "تنبيهات" },
  { id: "market", label: "سوق" },
  { id: "talk", label: "سوالف" },
  { id: "travel", label: "بين المدن" }
];

const PATHS = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3z",
  comp: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.5 5.5-2.2 6.3-6.3 2.2 2.2-6.3z",
  plus: "M12 5v14M5 12h14",
  heart: "M12 21s-7-4.6-9.5-9C.7 8.6 2.6 5 6 5c2 0 3.2 1 4 2.2C10.8 6 12 5 14 5c3.4 0 5.3 3.6 3.5 7-2.5 4.4-9.5 9-9.5 9z",
  comment: "M21 12a8 8 0 0 1-8 8H4l1.5-3A8 8 0 1 1 21 12z",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  flag: "M5 3v18M5 4h12l-2 4 2 4H5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5z",
  shield: "M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z",
  out: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35",
  refresh: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  mark: "M6 2h12v20l-6-4-6 4z"
};

function Icon({ n, s = 24, f = false }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={f ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[n]} />
    </svg>
  );
}

function timeAgo(t) {
  const s = (Date.now() - new Date(t)) / 1000;
  if (s < 60) return "الآن";
  if (s < 3600) return Math.floor(s / 60) + " د";
  if (s < 86400) return Math.floor(s / 3600) + " س";
  return Math.floor(s / 86400) + " يوم";
}

function avaLetter(n) { const s = String(n || "").replace(/^ال/, ""); return s[0] || "؟"; }

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setLoading(false); });
    loadCities();
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session?.user) loadProfile(session.user.id);
    else setProfile(null);
  }, [session]);

  async function loadCities() {
    const { data } = await supabase.from("cities").select("*").order("name", { ascending: true });
    setCities(data || []);
  }
  async function loadProfile(userId) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data || null);
  }

  if (loading) return <div className="center">جاري التحميل...</div>;
  if (!session) return <Auth cities={cities} />;
  if (!profile) return <SetupProfile user={session.user} cities={cities} onDone={() => loadProfile(session.user.id)} />;
  return <Feed profile={profile} cities={cities} />;
}

function Auth({ cities }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [cityId, setCityId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    } else {
      if (!username || !cityId) { setMessage("يجب اختيار اسم مستخدم ومدينة."); setBusy(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setMessage(error.message); setBusy(false); return; }
      if (data.user) {
        const { error: pe } = await supabase.from("profiles").insert({ id: data.user.id, username, city_id: Number(cityId) });
        if (pe) setMessage(pe.message);
        else { setMessage("تم إنشاء الحساب بنجاح."); await supabase.auth.signInWithPassword({ email, password }); }
      }
    }
    setBusy(false);
  }

  return (
    <div className="center">
      <div className="authcard">
        <h2>لَمّة</h2>
        <p className="muted" style={{ textAlign: "center" }}>مجتمع مدينتك في ليبيا</p>
        <div className="chips" style={{ justifyContent: "center" }}>
          <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>تسجيل دخول</button>
          <button className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>حساب جديد</button>
        </div>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={{ marginTop: 8 }} />
          {mode === "register" && (
            <>
              <input type="text" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30} style={{ marginTop: 8 }} />
              <select value={cityId} onChange={(e) => setCityId(e.target.value)} required style={{ marginTop: 8 }}>
                <option value="">اختر مدينتك</option>
                {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </>
          )}
          <button className="btn1" disabled={busy}>{busy ? "لحظة..." : mode === "login" ? "دخول" : "إنشاء حساب"}</button>
          {message && <div className="error">{message}</div>}
        </form>
      </div>
    </div>
  );
}

function SetupProfile({ user, cities, onDone }) {
  const [username, setUsername] = useState("");
  const [cityId, setCityId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    const { error } = await supabase.from("profiles").insert({ id: user.id, username, city_id: Number(cityId) });
    if (error) setMessage(error.message); else onDone();
    setBusy(false);
  }
  return (
    <div className="center">
      <div className="authcard">
        <h2>أكمل ملفك</h2>
        <form onSubmit={save}>
          <input type="text" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30} />
          <select value={cityId} onChange={(e) => setCityId(e.target.value)} required style={{ marginTop: 8 }}>
            <option value="">اختر مدينتك</option>
            {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
          <button className="btn1" disabled={busy}>{busy ? "لحظة..." : "حفظ"}</button>
          {message && <div className="error">{message}</div>}
        </form>
      </div>
    </div>
  );
}


function Sheet({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="shandle" />
        <div className="shead"><b>{title}</b><button className="ibtn" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

function PostCard({ post, voted, useful, comments, onLike, onComments, onShare, onReport, city, cat, saved, onSave }) {
  const [boom, setBoom] = useState(false);
  function dbl() {
    if (!voted) onLike(post.id);
    setBoom(true);
    setTimeout(() => setBoom(false), 800);
  }
  return (
    <article className="post">
      <div className="phead">
        <span className="ava sm">{avaLetter(post.profiles?.username)}</span>
        <div className="pwho">
          <b>@{post.profiles?.username}</b>
          <span>{city(post.city_id)} • {timeAgo(post.created_at)}</span>
        </div>
        <span className="badge2">{cat(post.category)}</span>
      </div>
      {post.image_url && (
        <div className="pimg" onDoubleClick={dbl}>
          <img src={post.image_url} alt="" />
          {boom && <span className="boom">♥</span>}
        </div>
      )}
      <div className="pacts">
        <button className={"ibtn " + (voted ? "liked" : "")} onClick={() => onLike(post.id)}><Icon n="heart" f={voted} /></button>
        <button className="ibtn" onClick={onComments}><Icon n="comment" /></button>
        <button className="ibtn" onClick={onShare}><Icon n="send" /></button>
        <button className="ibtn" onClick={onSave}><Icon n="mark" f={saved} /></button>
        <span className="sp" />
        <button className="ibtn" onClick={onReport}><Icon n="flag" /></button>
      </div>
      <div className="pcap">
        <b>{useful} مفيد</b> · <b>@{post.profiles?.username}</b> {post.title} — {post.body}
        {comments > 0 && <div className="muted">عرض كل التعليقات ({comments})</div>}
      </div>
    </article>
  );
}

function Feed({ profile, cities }) {
  const [tab, setTab] = useState("home");
  const [selectedCityId, setSelectedCityId] = useState(profile.city_id);
  const [posts, setPosts] = useState([]);
  const [votedIds, setVotedIds] = useState(new Set());
  const [follows, setFollows] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [notice, setNotice] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("services");
  const [imageFile, setImageFile] = useState(null);
  const [imgPrev, setImgPrev] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cList, setCList] = useState([]);
  const [cText, setCText] = useState("");
  const [rText, setRText] = useState("");
  const [unread, setUnread] = useState(0);
  const [savedIds, setSavedIds] = useState(new Set());
  const [nList, setNList] = useState([]);
  const [svList, setSvList] = useState([]);
  const [dark, setDark] = useState(localStorage.getItem("lamma-dark") === "1");
  const [skel, setSkel] = useState(false);
  const [pull, setPull] = useState(0);
  const [startY, setStartY] = useState(null);
  const [sQ, setSQ] = useState("");
  const [sRes, setSRes] = useState([]);
  const [sBusy, setSBusy] = useState(false);

  useEffect(() => { loadFollows(); loadUnread(); loadSaves(); const t = setInterval(loadUnread, 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("lamma-dark", dark ? "1" : "0");
  }, [dark]);
  useEffect(() => { if (tab === "home" || tab === "follows") loadPosts(); }, [selectedCityId, tab, follows]);
  useEffect(() => { if (sheet && sheet.type === "comments") loadComments(sheet.post.id); }, [sheet]);

  async function loadFollows() {
    const { data } = await supabase.from("city_follows").select("city_id").eq("user_id", profile.id);
    setFollows((data || []).map((x) => x.city_id));
  }
  async function loadPosts() {
    const sel = "*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count), comments!comments_post_id_fkey(count)";
    setSkel(true);
    let q = supabase.from("posts").select(sel).order("created_at", { ascending: false }).limit(100);
    if (tab === "home") q = q.eq("city_id", selectedCityId);
    else if (tab === "follows") q = follows.length ? q.in("city_id", follows) : null;
    if (!q) { setPosts([]); setSkel(false); return; }
    const { data, error } = await q;
    if (error) setMessage("خطأ جلب: " + error.message);
    else setPosts(data || []);
    const { data: v } = await supabase.from("useful_votes").select("post_id").eq("user_id", profile.id);
    setVotedIds(new Set((v || []).map((x) => x.post_id)));
    setSkel(false);
  }
  async function loadComments(postId) {
    const { data } = await supabase.from("comments").select("*, profiles!comments_user_id_fkey(username)").eq("post_id", postId).order("created_at", { ascending: true });
    setCList(data || []);
  }
  async function toggleFollow(cityId) {
    if (follows.includes(cityId)) {
      await supabase.from("city_follows").delete().eq("user_id", profile.id).eq("city_id", cityId);
    } else {
      if (follows.length >= 2) { setNotice("يمكنك متابعة مدينتين فقط كحد أقصى"); return; }
      await supabase.from("city_follows").insert({ user_id: profile.id, city_id: cityId });
    }
    loadFollows();
  }
  function pickImage(f) {
    setImageFile(f);
    if (f) { const r = new FileReader(); r.onload = () => setImgPrev(r.result); r.readAsDataURL(f); }
    else setImgPrev(null);
  }
  async function createPost() {
    setBusy(true); setMessage("");
    let imageUrl = null;
    if (imageFile) {
      const path = profile.id + "/" + Date.now() + "_" + imageFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const { error: ue } = await supabase.storage.from("post-images").upload(path, imageFile, { contentType: imageFile.type });
      if (ue) { setMessage("فشل رفع الصورة: " + ue.message); setBusy(false); return; }
      imageUrl = supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("posts").insert({ user_id: profile.id, city_id: selectedCityId, category, title, body, image_url: imageUrl });
    if (error) setMessage("خطأ نشر: " + error.message);
    else {
      setTitle(""); setBody(""); setImageFile(null); setImgPrev(null);
      setSheet(null); setNotice("تم النشر بنجاح ✅"); loadPosts();
    }
    setBusy(false);
  }
  async function toggleUseful(postId) {
    if (votedIds.has(postId)) {
      await supabase.from("useful_votes").delete().eq("post_id", postId).eq("user_id", profile.id);
      const n = new Set(votedIds); n.delete(postId); setVotedIds(n);
    } else {
      await supabase.from("useful_votes").insert({ post_id: postId, user_id: profile.id });
      const n = new Set(votedIds); n.add(postId); setVotedIds(n);
      const owner = posts.find((x) => x.id === postId)?.user_id || (sheet && sheet.post && sheet.post.id === postId ? sheet.post.user_id : null);
      if (owner && owner !== profile.id) await supabase.from("notifications").insert({ user_id: owner, actor_id: profile.id, type: "like", post_id: postId });
    }
    loadPosts();
  }
  async function addComment(postId) {
    const text = cText.trim();
    if (!text) return;
    await supabase.from("comments").insert({ post_id: postId, user_id: profile.id, body: text });
    const owner = posts.find((x) => x.id === postId)?.user_id || (sheet && sheet.post ? sheet.post.user_id : null);
    if (owner && owner !== profile.id) await supabase.from("notifications").insert({ user_id: owner, actor_id: profile.id, type: "comment", post_id: postId });
    setCText("");
    loadComments(postId);
    loadPosts();
  }
  async function sendReport(postId) {
    if (!rText.trim()) return;
    await supabase.from("reports").insert({ post_id: postId, user_id: profile.id, reason: rText.trim() });
    setRText(""); setSheet(null); setNotice("تم إرسال البلاغ إلى الإدارة ✔");
  }
  async function sharePost(post) {
    const text = "📱 لَمّة | " + categoryLabel(post.category) + "\n🏙 " + cityName(post.city_id) + "\n📌 " + post.title + "\n📝 " + post.body + "\n— @" + (post.profiles?.username || "") + "\n👍 " + usefulCount(post);
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); setNotice("تم نسخ بطاقة المنشور ✔ الصقها في واتساب"); } catch (e) { setNotice(text); }
  }
  async function doSearch() {
    if (!sQ.trim()) { setSRes([]); return; }
    setSBusy(true);
    const term = "%" + sQ.trim() + "%";
    const { data } = await supabase.from("posts")
      .select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count), comments!comments_post_id_fkey(count)")
      .or("title.ilike." + term + ",body.ilike." + term)
      .order("created_at", { ascending: false }).limit(20);
    setSRes(data || []);
    setSBusy(false);
  }
  function ts(e) { if (window.scrollY <= 0) setStartY(e.touches[0].clientY); }
  function tm(e) { if (startY != null && window.scrollY <= 0) { const dy = e.touches[0].clientY - startY; if (dy > 0) setPull(Math.min(dy, 90)); } }
  function te() { if (pull > 60) { loadPosts(); setNotice("تم التحديث ✔"); } setPull(0); setStartY(null); }
  async function loadUnread() {
    const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("read", false);
    setUnread(count || 0);
  }
  async function loadSaves() {
    const { data } = await supabase.from("saves").select("post_id").eq("user_id", profile.id);
    setSavedIds(new Set((data || []).map((x) => x.post_id)));
  }
  async function openNotif() {
    const { data } = await supabase.from("notifications").select("*, profiles!notifications_actor_id_fkey(username), posts(title)").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(30);
    setNList(data || []);
    setSheet({ type: "notif" });
    await supabase.from("notifications").update({ read: true }).eq("user_id", profile.id).eq("read", false);
    setUnread(0);
  }
  async function openSaves() {
    const ids = Array.from(savedIds);
    if (!ids.length) { setSvList([]); setSheet({ type: "saves" }); return; }
    const { data } = await supabase.from("posts").select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count), comments!comments_post_id_fkey(count)").in("id", ids).order("created_at", { ascending: false });
    setSvList(data || []);
    setSheet({ type: "saves" });
  }
  async function toggleSave(post) {
    if (savedIds.has(post.id)) {
      await supabase.from("saves").delete().eq("user_id", profile.id).eq("post_id", post.id);
      const n = new Set(savedIds); n.delete(post.id); setSavedIds(n);
    } else {
      await supabase.from("saves").insert({ user_id: profile.id, post_id: post.id });
      const n = new Set(savedIds); n.add(post.id); setSavedIds(n);
    }
  }
  async function logout() { await supabase.auth.signOut(); }
  function cityName(id) { return cities.find((c) => c.id === Number(id))?.name || ""; }
  function categoryLabel(id) { return categories.find((i) => i.id === id)?.label || id; }
  function usefulCount(p) { return p.useful_votes?.[0]?.count || 0; }
  function commentCount(p) { return p.comments?.[0]?.count || 0; }

  const cardProps = (p) => ({
    post: p, voted: votedIds.has(p.id), useful: usefulCount(p), comments: commentCount(p),
    onLike: toggleUseful, onComments: () => setSheet({ type: "comments", post: p }),
    onShare: () => sharePost(p), onReport: () => setSheet({ type: "report", post: p }),
    saved: savedIds.has(p.id), onSave: () => toggleSave(p),
    city: cityName, cat: categoryLabel
  });

  return (
    <div className="app">
      <header className="topbar2">
        <div className="logo">لَمّة</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="ibtn" onClick={openNotif} style={{ position: "relative" }}>
            <Icon n="bell" />
            {unread > 0 && <span className="nbadge">{unread}</span>}
          </button>
          <button className="ibtn" onClick={() => setSheet({ type: "search" })}><Icon n="search" /></button>
          <button className="ibtn" onClick={() => setDark(!dark)}><Icon n="moon" /></button>
          {profile.is_admin && <button className="ibtn" onClick={() => setTab("admin")}><Icon n="shield" /></button>}
          <button className="ibtn" onClick={logout}><Icon n="out" /></button>
        </div>
      </header>

      {notice && <div className="notice">{notice}</div>}

      {tab === "home" && (
        <div onTouchStart={ts} onTouchMove={tm} onTouchEnd={te}>
          <div className={"pull " + (pull > 10 ? "on" : "")}><Icon n="refresh" s={20} /></div>
          <div className="stories">
            {cities.map((c) => (
              <button key={c.id} className={"story " + (c.id === selectedCityId ? "on" : "")} onClick={() => setSelectedCityId(c.id)}>
                <span className="ring"><span className="ava">{avaLetter(c.name)}</span></span>
                <span className="sname">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="cityline">
            <b>منشورات {cityName(selectedCityId)}</b>
            {selectedCityId !== profile.city_id && (
              <button className="chip" onClick={() => toggleFollow(selectedCityId)}>
                {follows.includes(selectedCityId) ? "✓ متابَعة" : "+ متابعة"}
              </button>
            )}
          </div>
          {skel && [1, 2, 3].map((i) => (<div className="skpost" key={i}><div className="sk head" /><div className="sk img" /></div>))}
          {posts.length === 0 && !skel && <div className="empty">لا منشورات بعد في {cityName(selectedCityId)}.<br />كن أول من ينشر!</div>}
          {posts.map((p) => (<PostCard key={p.id} {...cardProps(p)} />))}
        </div>
      )}

      {tab === "pulse" && <Pulse profile={profile} cities={cities} onOpen={(p) => setSheet({ type: "post", post: p })} />}
      {tab === "follows" && (
        <>
          {follows.length === 0 && <div className="empty">لم تتابع أي مدينة بعد.<br />من تبويب المدينة اضغط "+ متابعة".</div>}
          {posts.map((p) => (<PostCard key={p.id} {...cardProps(p)} />))}
        </>
      )}
      {tab === "admin" && profile.is_admin && <Admin />}
      {tab === "me" && <Me profile={profile} cities={cities} onInvite={shareApp} onSaves={openSaves} />}

      <nav className="bottom">
        <button className={tab === "home" ? "on" : ""} onClick={() => setTab("home")}><Icon n="home" /></button>
        <button className={tab === "pulse" ? "on" : ""} onClick={() => setTab("pulse")}><Icon n="comp" /></button>
        <button className="addbtn" onClick={() => setSheet({ type: "compose" })}><Icon n="plus" /></button>
        <button className={tab === "follows" ? "on" : ""} onClick={() => setTab("follows")}><Icon n="heart" /></button>
        <button className={tab === "me" ? "on" : ""} onClick={() => setTab("me")}><Icon n="user" /></button>
      </nav>

      {sheet && sheet.type === "search" && (
        <Sheet title="بحث في كل المدن" onClose={() => setSheet(null)}>
          <input placeholder="ابحث عن منشور..." value={sQ} onChange={(e) => setSQ(e.target.value)} />
          <button className="btn1" onClick={doSearch}>{sBusy ? "جاري البحث..." : "بحث"}</button>
          {sRes.map((p) => (<PostCard key={p.id} {...cardProps(p)} />))}
          {sRes.length === 0 && sQ && !sBusy && <div className="empty">لا نتائج.</div>}
        </Sheet>
      )}
      {sheet && sheet.type === "notif" && (
        <Sheet title="الإشعارات" onClose={() => setSheet(null)}>
          {nList.map((n) => (
            <div className="comment" key={n.id}>
              <span className="ava sm">{avaLetter(n.profiles?.username)}</span>
              <div>{n.type === "comment" ? "💬 علّق" : "♥ أعجب"} <b>@{n.profiles?.username}</b> على: {n.posts?.title || "منشور"}<div className="muted">{timeAgo(n.created_at)}</div></div>
            </div>
          ))}
          {nList.length === 0 && <div className="empty">لا إشعارات بعد.</div>}
        </Sheet>
      )}
      {sheet && sheet.type === "saves" && (
        <Sheet title="محفوظاتي" onClose={() => setSheet(null)}>
          {svList.map((p) => (<PostCard key={p.id} {...cardProps(p)} />))}
          {svList.length === 0 && <div className="empty">لا منشورات محفوظة.</div>}
        </Sheet>
      )}
      {sheet && sheet.type === "compose" && (
        <Sheet title="منشور جديد" onClose={() => setSheet(null)}>
          <div className="chips">{categories.map((c) => (<button key={c.id} className={category === c.id ? "on" : ""} onClick={() => setCategory(c.id)}>{c.label}</button>))}</div>
          <input placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <textarea placeholder="اكتب التفاصيل..." value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} style={{ marginTop: 8 }} />
          <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files[0] || null)} style={{ marginTop: 8 }} />
          {imgPrev && <img className="imgprev" src={imgPrev} alt="" />}
          <div className="muted">سيُنشر في: {cityName(selectedCityId)}</div>
          <button className="btn1" disabled={busy || !title || !body} onClick={createPost}>نشر</button>
          {message && <div className="error">{message}</div>}
        </Sheet>
      )}

      {sheet && sheet.type === "comments" && (
        <Sheet title={"التعليقات (" + cList.length + ")"} onClose={() => setSheet(null)}>
          {cList.map((c) => (
            <div className="comment" key={c.id}>
              <span className="ava sm">{avaLetter(c.profiles?.username)}</span>
              <div><b>@{c.profiles?.username}</b> {c.body}</div>
            </div>
          ))}
          {cList.length === 0 && <div className="empty">لا تعليقات بعد. كن أول من يعلّق!</div>}
          <div className="crow">
            <input placeholder="أضف تعليقًا..." value={cText} onChange={(e) => setCText(e.target.value)} />
            <button onClick={() => addComment(sheet.post.id)}>إرسال</button>
          </div>
        </Sheet>
      )}

      {sheet && sheet.type === "report" && (
        <Sheet title="إبلاغ عن المنشور" onClose={() => setSheet(null)}>
          <input placeholder="سبب البلاغ" value={rText} onChange={(e) => setRText(e.target.value)} />
          <button className="btn1" onClick={() => sendReport(sheet.post.id)}>إرسال البلاغ</button>
          <button className="btn2" onClick={() => setSheet(null)}>إلغاء</button>
        </Sheet>
      )}

      {sheet && sheet.type === "post" && (
        <Sheet title="منشور" onClose={() => setSheet(null)}>
          <PostCard {...cardProps(sheet.post)} />
        </Sheet>
      )}
    </div>
  );
}

async function shareApp() {
  const text = "📱 انضم إلى تطبيق لَمّة - مجتمع مدينتك في ليبيا:\nhttps://github.com/abdo15542/lamma/releases";
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) {}
  try { await navigator.clipboard.writeText(text); } catch (e) {}
}


function Pulse({ profile, cities, onOpen }) {
  const [items, setItems] = useState([]);
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count)")
      .order("created_at", { ascending: false }).limit(100);
    const list = (data || [])
      .map((p) => ({ ...p, vc: p.useful_votes?.[0]?.count || 0 }))
      .filter((p) => p.vc > 0 && p.city_id !== profile.city_id)
      .sort((a, b) => b.vc - a.vc)
      .slice(0, 30);
    setItems(list);
  }
  function cityName(id) { return cities.find((c) => c.id === Number(id))?.name || ""; }
  return (
    <div>
      <div className="cityline"><b>🔥 نبض المدن</b><span className="muted">الأكثر فائدة خارج مدينتك</span></div>
      {items.length === 0 && <div className="empty">لا يوجد نبض بعد.</div>}
      <div className="grid3">
        {items.map((p) => (
          <button key={p.id} className="gcell" onClick={() => onOpen(p)}>
            {p.image_url ? <img src={p.image_url} alt="" /> : <span className="gtxt">{p.title}</span>}
            {p.image_url && <span className="gtxt">♥ {p.vc}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Admin() {
  const [reports, setReports] = useState([]);
  const [confirmId, setConfirmId] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from("reports").select("*, posts(title, body), profiles!reports_user_id_fkey(username)").order("created_at", { ascending: false });
    setReports(data || []);
    const [u, p, c] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("comments").select("*", { count: "exact", head: true })
    ]);
    setStats({ u: u.count || 0, p: p.count || 0, c: c.count || 0 });
  }
  async function deletePost(postId) { await supabase.from("posts").delete().eq("id", postId); setConfirmId(null); load(); }
  async function dismiss(id) { await supabase.from("reports").delete().eq("id", id); load(); }
  return (
    <div>
      <div className="cityline"><b>👑 لوحة الإدارة</b><span className="muted">{reports.length} بلاغ</span></div>
      {stats && <div className="stats"><span>👥 {stats.u} مستخدم</span><span>📝 {stats.p} منشور</span><span>💬 {stats.c} تعليق</span></div>}
      {reports.length === 0 && <div className="empty">لا بلاغات. المجتمع نظيف ✔</div>}
      {reports.map((r) => (
        <div className="card2" key={r.id}>
          <span className="badge2">🚨 {r.reason}</span>
          <div className="pcap" style={{ padding: "8px 0 0" }}><b>{r.posts?.title || "(محذوف)"}</b> {r.posts?.body}</div>
          <div className="muted">المبلِّغ: @{r.profiles?.username}</div>
          {r.posts && (confirmId === r.post_id
            ? <button className="btn1" onClick={() => deletePost(r.post_id)}>⚠️ تأكيد الحذف نهائيًا</button>
            : <button className="btn2" onClick={() => setConfirmId(r.post_id)}>🗑 حذف المنشور</button>)}
          <button className="btn2" onClick={() => dismiss(r.id)}>تجاهل البلاغ</button>
        </div>
      ))}
    </div>
  );
}

function Me({ profile, cities, onInvite, onSaves }) {
  const [copied, setCopied] = useState(false);
  function cityName(id) { return cities.find((c) => c.id === Number(id))?.name || ""; }
  async function invite() { await onInvite(); setCopied(true); setTimeout(() => setCopied(false), 2500); }
  return (
    <div>
      <div className="mehead">
        <span className="ava">{avaLetter(profile.username)}</span>
        <b style={{ fontSize: 18 }}>@{profile.username} {profile.is_admin ? "👑" : ""}</b>
        <span className="muted">{cityName(profile.city_id)}</span>
      </div>
      <div className="stats">
        <span>ليبي 100%</span><span>بدون إعلانات</span><span>مجتمع حقيقي</span>
      </div>
      <div className="card2">
        <h3>عن لَمّة</h3>
        <p className="muted">شبكة اجتماعية ليبية بسيطة تجمع أهل المدينة الواحدة: خدمات، تنبيهات، سوق، سوالف، وتواصل بين المدن.</p>
        <span className="badge2">الإصدار 2.0 — تصميم جديد</span>
      </div>
      <div className="card2">
        <h3>شروط الاستخدام</h3>
        <ul>
          <li>الاحترام أولًا: لا سبّ ولا قذف ولا خطاب كراهية.</li>
          <li>لا لنشر الشائعات: تحقق قبل نشر أي خبر خدمي أو أمني.</li>
          <li>المنشورات مسؤولية أصحابها، وللإدارة حذف أي محتوى مخالف.</li>
          <li>البلاغات سرية وتراجعها الإدارة فقط.</li>
        </ul>
      </div>
      <div className="card2">
        <button className="btn2" onClick={onSaves}>🔖 محفوظاتي</button>
      </div>
      <div className="card2">
        <button className="btn1" onClick={invite}>{copied ? "تم النسخ ✔" : "📤 دعوة جيرانك"}</button>
      </div>
    </div>
  );
}
