import { useEffect, useState, useRef, memo, Component } from "react";
import { supabase } from "./lib/supabase";

const BUILD_SHA = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "dev";

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
  mark: "M6 2h12v20l-6-4-6 4z",
  pin: "M12 2 4 8h3v6l-3 3 8-3 8 3-3-3V8h3z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 4 8 5 8-5",
  chart: "M3 3v18h18M7 15l4-4 4 4 5-5",
  edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  trash: "M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14",
  expand: "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
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
function activityBadge(n) {
  if (n >= 100) return "🏆 أسطورة لَمّة";
  if (n >= 30) return "🥇 عضو مخضرم";
  if (n >= 10) return "🥈 عضو نشط";
  return "🌱 عضو جديد";
}
function hashTags(text) {
  if (!text) return text;
  const parts = String(text).split(/(#\w+)/g);
  return parts.map((p, i) => (/^#\w+$/.test(p) ? <span key={i} className="hash">{p}</span> : p));
}

function LazyImage({ src, alt, className }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { rootMargin: "200px" });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className="pimg">
      {inView && <img src={src} alt={alt} className={(className || "") + (loaded ? " loaded" : "")} onLoad={() => setLoaded(true)} loading="lazy" />}
    </div>
  );
}

function AppInner() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setLoading(false); });
    loadCities();
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session?.user) loadProfile(session.user.id); else setProfile(null); }, [session]);
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

const PostCard = memo(function PostCard({ post, voted, useful, comments, onLike, onComments, onShare, onReport, city, cat, saved, onSave, onPin, onMessage, canPin, onDelete, onOpenProfile, onZoom, onEdit, myVotes, votePoll, onSeller }) {
  const [boom, setBoom] = useState(false);
  function dbl() { if (!voted) onLike(post.id); setBoom(true); setTimeout(() => setBoom(false), 800); }
  return (
    <article className={"post " + (post.is_pinned ? "pinned" : "")}>
      <div className="phead">
        <button className="pwho-btn" onClick={onOpenProfile}>
          <span className="ava sm">{avaLetter(post.profiles?.username)}</span>
          <div className="pwho">
            <b>{post.is_pinned && <span className="pinned-label">📌 مثبّت</span>}@{post.profiles?.username}{post.profiles?.is_admin && <span style={{ color: "#0f766e" }}> ✓</span>}</b>
            <span>{city(post.city_id)} • {timeAgo(post.created_at)}</span>
          </div>
        </button>
        <span className="badge2">{cat(post.category)}</span>
        {post.price && <span className="badge2">💰 {post.price}</span>}
      </div>
      {post.image_url && (
        <div onDoubleClick={dbl} style={{ position: "relative" }}>
          <LazyImage src={post.image_url} alt="" />
          {boom && <span className="boom">♥</span>}
          <button className="zoombtn" onClick={onZoom}><Icon n="expand" s={18} /></button>
        </div>
      )}
      {(post.poll_options || []).length > 0 && (
        <div style={{ padding: "0 14px 8px" }}>
          {(post.poll_options || []).slice().sort((a, b) => a.position - b.position).map((o) => {
            const total = (post.poll_options || []).reduce((t, x) => t + (x.poll_votes?.[0]?.count || 0), 0) || 0;
            const c = o.poll_votes?.[0]?.count || 0;
            const pct = total ? Math.round((c / total) * 100) : 0;
            const mine = myVotes.has(o.id);
            return (
              <button key={o.id} className="pollopt" onClick={() => votePoll(o.id, post.id)} style={{ display: "block", width: "100%", textAlign: "right", margin: "6px 0", padding: "8px 12px", borderRadius: 12, border: mine ? "2px solid #0f766e" : "1px solid #dbdbdb", background: "#fff", position: "relative", overflow: "hidden" }}>
                <span style={{ position: "absolute", inset: 0, width: pct + "%", background: "rgba(15,118,110,.12)" }} />
                <span style={{ position: "relative" }}>{o.label} {mine && "✓"} <b style={{ float: "left" }}>{total > 0 ? pct + "%" : ""}</b></span>
              </button>
            );
          })}
          <div className="muted">{(post.poll_options || []).reduce((t, x) => t + (x.poll_votes?.[0]?.count || 0), 0)} صوت</div>
        </div>
      )}
      <div className="pacts">
        <button className={"ibtn " + (voted ? "liked liked-pop" : "")} onClick={() => onLike(post.id)}><Icon n="heart" f={voted} /></button>
        <button className="ibtn" onClick={onComments}><Icon n="comment" /></button>
        <button className="ibtn" onClick={onShare}><Icon n="send" /></button>
        <button className="ibtn" onClick={onSave}><Icon n="mark" f={saved} /></button>
        <span className="sp" />
        {onEdit && <button className="ibtn" onClick={onEdit}><Icon n="edit" /></button>}
        {onDelete && <button className="ibtn" onClick={onDelete}><Icon n="trash" /></button>}
        {canPin && <button className="ibtn" onClick={onPin}><Icon n="pin" f={post.is_pinned} /></button>}
        {onMessage && <button className="ibtn" onClick={onMessage}><Icon n="mail" /></button>}
        <button className="ibtn" onClick={onReport}><Icon n="flag" /></button>
      </div>
      <div className="pcap">
        <b>{useful} مفيد</b> · <b>@{post.profiles?.username}</b> <b>{hashTags(post.title)}</b> — {hashTags(post.body)}
        {onSeller && <div><button className="chip" style={{ marginTop: 6 }} onClick={onSeller}>🤝 تواصل مع البائع</button></div>}
        {comments > 0 && <div className="muted">عرض كل التعليقات ({comments})</div>}
      </div>
    </article>
  );
});

function Feed({ profile, cities }) {
  const [tab, setTab] = useState("home");
  const [selectedCityId, setSelectedCityId] = useState(profile.city_id);
  const [posts, setPosts] = useState([]);
  const [votedIds, setVotedIds] = useState(new Set());
  const [optimisticLiked, setOptimisticLiked] = useState(new Set());
  const [follows, setFollows] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [sortBy, setSortBy] = useState("new");
  const [evTitle, setEvTitle] = useState("");
  const [evBody, setEvBody] = useState("");
  const [evLoc, setEvLoc] = useState("");
  const [evDate, setEvDate] = useState("");
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
  const [optimisticSaved, setOptimisticSaved] = useState(new Set());
  const [nList, setNList] = useState([]);
  const [svList, setSvList] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [bioDraft, setBioDraft] = useState(profile.bio || "");
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [inbox, setInbox] = useState([]);
  const [delId, setDelId] = useState(null);
  const [online, setOnline] = useState(true);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [skel, setSkel] = useState(false);
  const [pull, setPull] = useState(0);
  const [startY, setStartY] = useState(null);
  const [sQ, setSQ] = useState("");
  const [sRes, setSRes] = useState([]);
  const [sBusy, setSBusy] = useState(false);
  const debounceTimer = useRef(null);
  const [catFilter, setCatFilter] = useState(null);
  const [showTop, setShowTop] = useState(false);
  const [profView, setProfView] = useState(null);
  const [cLikesMine, setCLikesMine] = useState([]);
  const [cLikesCount, setCLikesCount] = useState({});
  const [followInfo, setFollowInfo] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [blockedIds, setBlockedIds] = useState(new Set());
  const [myVotes, setMyVotes] = useState(new Set());
  const [addPoll, setAddPoll] = useState(false);
  const [pollOpts, setPollOpts] = useState(["", "", "", ""]);
  const [peopleRes, setPeopleRes] = useState([]);
  const [storyGroups, setStoryGroups] = useState([]);
  const [storyView, setStoryView] = useState(null);
  const [storySeen, setStorySeen] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem("lamma-seen") || "[]")); } catch (e) { return new Set(); } });
  const [price, setPrice] = useState("");
  const [storyBody, setStoryBody] = useState("");
  const [tour, setTour] = useState(localStorage.getItem("lamma-tour") !== "1");
  const [editBody, setEditBody] = useState("");
  let noticeTimer = null;

  useEffect(() => {
    loadFollows(); loadUnread(); loadSaves(); loadMsgs(); loadBlocks();
    const t = setInterval(loadUnread, 30000);
    const t2 = setInterval(loadMsgs, 30000);
    return () => { clearInterval(t); clearInterval(t2); };
  }, []);
  useEffect(() => {
    document.body.classList.toggle("dark", localStorage.getItem("lamma-dark") === "1");
  }, []);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => { if (tab === "home" || tab === "follows") loadPosts(); }, [selectedCityId, tab, follows, catFilter]);
  useEffect(() => { if (sheet && sheet.type === "comments") loadComments(sheet.post.id); }, [sheet]);
  useEffect(() => { loadEvents(); }, [selectedCityId]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const ch = supabase.channel("lamma-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (p) => {
        if (tab === "home" && p.new.city_id === selectedCityId) { loadPosts(); flashNotice("📡 منشور جديد وصل الآن"); }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (m) => {
        if (m.new.to_id === profile.id) {
          loadMsgs();
          if (sheet && sheet.type === "chat" && sheet.peerId === m.new.from_id) setSheet((prev) => ({ ...prev, messages: [...(prev.messages || []), m.new] }));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tab, selectedCityId, sheet]);
  useEffect(() => {
    if (!storyView) return;
    const t = setTimeout(() => {
      setStoryView((v) => (v && v.i < v.all.length - 1 ? { ...v, i: v.i + 1 } : null));
    }, 5000);
    return () => clearTimeout(t);
  }, [storyView]);
  function flashNotice(msg) {
    setNotice(msg);
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => setNotice(""), 2000);
  }
  function closeSheet() { setSheet(null); setSheetLoading(false); }
  function cityName(id) { return cities.find((c) => c.id === Number(id))?.name || ""; }
  function categoryLabel(id) { return categories.find((i) => i.id === id)?.label || id; }
  function usefulCount(p) { return p.useful_votes?.[0]?.count || 0; }
  function commentCount(p) { return p.comments?.[0]?.count || 0; }

  async function loadFollows() {
    const { data } = await supabase.from("city_follows").select("city_id").eq("user_id", profile.id);
    setFollows((data || []).map((x) => x.city_id));
  }
  async function loadPosts() {
    setSkel(true);
    const sel = "*, profiles!posts_user_id_fkey(username, is_admin), useful_votes!useful_votes_post_id_fkey(count), comments!comments_post_id_fkey(count), poll_options(id, label, position, poll_votes(count))";
    let q = supabase.from("posts").select(sel).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(100);
    if (tab === "home") q = q.eq("city_id", selectedCityId);
    if (catFilter) q = q.eq("category", catFilter);
    else if (tab === "follows") q = follows.length ? q.in("city_id", follows) : null;
    if (!q) { setPosts([]); setSkel(false); return; }
    const { data, error } = await q;
    if (error) setMessage("خطأ جلب: " + error.message);
    else setPosts(data || []);
    const { data: v } = await supabase.from("useful_votes").select("post_id").eq("user_id", profile.id);
    setVotedIds(new Set((v || []).map((x) => x.post_id)));
    const optIds = (data || []).flatMap((p) => (p.poll_options || []).map((x) => x.id));
    if (optIds.length) {
      const mv = await supabase.from("poll_votes").select("option_id").in("option_id", optIds).eq("user_id", profile.id);
      setMyVotes(new Set((mv.data || []).map((x) => x.option_id)));
    } else setMyVotes(new Set());
    setSkel(false);
  }
  async function loadComments(postId) {
    const { data } = await supabase.from("comments").select("*, profiles!comments_user_id_fkey(username)").eq("post_id", postId).order("created_at", { ascending: true });
    setCList(data || []);
    const ids = (data || []).map((c) => c.id);
    if (ids.length) {
      const [all, mine] = await Promise.all([
        supabase.from("comment_likes").select("comment_id").in("comment_id", ids),
        supabase.from("comment_likes").select("comment_id").in("comment_id", ids).eq("user_id", profile.id)
      ]);
      const cnt = {};
      (all.data || []).forEach((x) => { cnt[x.comment_id] = (cnt[x.comment_id] || 0) + 1; });
      setCLikesCount(cnt);
      setCLikesMine((mine.data || []).map((x) => x.comment_id));
    } else { setCLikesCount({}); setCLikesMine([]); }
  }
  async function loadUnread() {
    const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("user_id", profile.id).eq("read", false);
    setUnread(count || 0);
  }
  async function loadSaves() {
    const { data } = await supabase.from("saves").select("post_id").eq("user_id", profile.id);
    setSavedIds(new Set((data || []).map((x) => x.post_id)));
  }
  async function loadMsgs() {
    const { count } = await supabase.from("messages").select("*", { count: "exact", head: true }).eq("to_id", profile.id).eq("read", false);
    setUnreadMsgs(count || 0);
  }
  async function openNotif() {
    setSheet({ type: "notif" }); setSheetLoading(true);
    const { data } = await supabase.from("notifications").select("*, profiles!notifications_actor_id_fkey(username), posts(title)").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(30);
    setNList(data || []); setSheetLoading(false);
    await supabase.from("notifications").update({ read: true }).eq("user_id", profile.id).eq("read", false);
    setUnread(0);
  }
  async function openInbox() {
    setSheet({ type: "inbox" }); setSheetLoading(true);
    const raw = await supabase.from("messages").select("*, profiles!messages_from_id_fkey(username)").eq("to_id", profile.id).order("created_at", { ascending: false }).limit(50);
    const out = await supabase.from("messages").select("*, profiles!messages_to_id_fkey(username)").eq("from_id", profile.id).order("created_at", { ascending: false }).limit(50);
    const all = [...(raw.data || []), ...(out.data || [])];
    const grouped = {};
    all.forEach((m) => {
      const k = m.from_id === profile.id ? m.to_id : m.from_id;
      if (!grouped[k]) grouped[k] = { peer: k, peerName: m.profiles?.username, last: m, unread: 0 };
      if (m.to_id === profile.id && !m.read) grouped[k].unread++;
      if (new Date(m.created_at) > new Date(grouped[k].last.created_at)) grouped[k].last = m;
    });
    setInbox(Object.values(grouped)); setSheetLoading(false);
    await supabase.from("messages").update({ read: true }).eq("to_id", profile.id).eq("read", false);
    loadMsgs();
  }
  async function openChatWith(peerId, peerName) {
    setSheet({ type: "chat", peerId, peerName, messages: [], text: "" }); setSheetLoading(true);
    const { data } = await supabase.from("messages").select("*").or("and(from_id.eq." + profile.id + ",to_id.eq." + peerId + "),and(from_id.eq." + peerId + ",to_id.eq." + profile.id + ")").order("created_at", { ascending: true });
    setSheet({ type: "chat", peerId, peerName, messages: data || [], text: "" }); setSheetLoading(false);
  }
  async function sendMessage(peerId, txt) {
    if (!txt.trim()) return;
    await supabase.from("messages").insert({ from_id: profile.id, to_id: peerId, body: txt.trim() });
    const { data } = await supabase.from("messages").select("*").or("and(from_id.eq." + profile.id + ",to_id.eq." + peerId + "),and(from_id.eq." + peerId + ",to_id.eq." + profile.id + ")").order("created_at", { ascending: true });
    setSheet((prev) => ({ ...prev, messages: data || [], text: "" }));
  }
  async function loadMyStats() {
    const [p, c, l, f] = await Promise.all([
      supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.from("useful_votes").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      supabase.from("city_follows").select("*", { count: "exact", head: true }).eq("user_id", profile.id)
    ]);
    setMyStats({ posts: p.count || 0, comments: c.count || 0, likes: l.count || 0, follows: f.count || 0 });
  }
  async function toggleFollow(cityId) {
    if (follows.includes(cityId)) await supabase.from("city_follows").delete().eq("user_id", profile.id).eq("city_id", cityId);
    else {
      if (follows.length >= 2) { flashNotice("يمكنك متابعة مدينتين فقط كحد أقصى"); return; }
      await supabase.from("city_follows").insert({ user_id: profile.id, city_id: cityId });
    }
    loadFollows();
  }
  function pickImage(f) {
    setImageFile(f);
    if (f) { const r = new FileReader(); r.onload = () => setImgPrev(r.result); r.readAsDataURL(f); }
    else setImgPrev(null);
  }
  function compressImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1280;
        let w = img.width, h = img.height;
        if (w > max || h > max) { const r = Math.min(max / w, max / h); w = Math.round(w * r); h = Math.round(h * r); }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob((b) => resolve(b || file), "image/jpeg", 0.8);
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  }
  async function createPost() {
    setBusy(true); setMessage("");
    let imageUrl = null;
    if (imageFile) {
      const blob = await compressImage(imageFile);
      const path = profile.id + "/" + Date.now() + ".jpg";
      const { error: ue } = await supabase.storage.from("post-images").upload(path, blob, { contentType: "image/jpeg" });
      if (ue) { setMessage("فشل رفع الصورة: " + ue.message); setBusy(false); return; }
      imageUrl = supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
    }
    const { data: newPost, error } = await supabase.from("posts").insert({ user_id: profile.id, city_id: selectedCityId, category, title, body, image_url: imageUrl, price: price || null }).select();
    if (error) setMessage("خطأ نشر: " + error.message);
    else {
      if (newPost && addPoll) {
        const opts = pollOpts.map((t, i) => ({ t: t.trim(), i })).filter((x) => x.t);
        if (opts.length >= 2) await supabase.from("poll_options").insert(opts.map((x) => ({ post_id: newPost.id, label: x.t, position: x.i })));
      }
      setTitle(""); setBody(""); setImageFile(null); setImgPrev(null); setAddPoll(false); setPrice(""); try { localStorage.removeItem("lamma-draft"); } catch (e2) {} setPollOpts(["", "", "", ""]); closeSheet(); flashNotice("تم النشر بنجاح ✅"); loadPosts();
    }
    setBusy(false);
  }
  async function toggleUseful(postId) {
    const was = votedIds.has(postId) || optimisticLiked.has(postId);
    if (was) {
      const o = new Set(optimisticLiked); o.delete(postId); setOptimisticLiked(o);
      await supabase.from("useful_votes").delete().eq("post_id", postId).eq("user_id", profile.id);
      const n = new Set(votedIds); n.delete(postId); setVotedIds(n);
    } else {
      const o = new Set(optimisticLiked); o.add(postId); setOptimisticLiked(o);
      if (navigator.vibrate) navigator.vibrate(12);
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
    loadComments(postId); loadPosts();
  }
  async function deleteComment(commentId) {
    await supabase.from("comments").delete().eq("id", commentId);
    if (sheet && sheet.type === "comments") loadComments(sheet.post.id);
    flashNotice("تم حذف التعليق 🗑");
  }
  async function deletePost(postId) {
    await supabase.from("posts").delete().eq("id", postId);
    setDelId(null); flashNotice("تم حذف المنشور 🗑"); loadPosts();
  }
  async function togglePin(postId, current) {
    await supabase.from("posts").update({ is_pinned: !current, pinned_at: current ? null : new Date().toISOString() }).eq("id", postId);
    loadPosts();
  }
  async function toggleSave(post) {
    const was = savedIds.has(post.id) || optimisticSaved.has(post.id);
    if (was) {
      const o = new Set(optimisticSaved); o.delete(post.id); setOptimisticSaved(o);
      await supabase.from("saves").delete().eq("user_id", profile.id).eq("post_id", post.id);
      const n = new Set(savedIds); n.delete(post.id); setSavedIds(n);
    } else {
      const o = new Set(optimisticSaved); o.add(post.id); setOptimisticSaved(o);
      await supabase.from("saves").insert({ user_id: profile.id, post_id: post.id });
      const n = new Set(savedIds); n.add(post.id); setSavedIds(n);
    }
  }
  async function sendReport(postId) {
    if (!rText.trim()) return;
    await supabase.from("reports").insert({ post_id: postId, user_id: profile.id, reason: rText.trim() });
    setRText(""); closeSheet(); flashNotice("تم إرسال البلاغ إلى الإدارة ✔");
  }
  async function sharePost(post) {
    const text = "📱 لَمّة | " + categoryLabel(post.category) + "\n🏙 " + cityName(post.city_id) + "\n📌 " + post.title + "\n📝 " + post.body + "\n— @" + (post.profiles?.username || "") + "\n👍 " + usefulCount(post);
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) {}
    try { await navigator.clipboard.writeText(text); flashNotice("تم نسخ بطاقة المنشور ✔ الصقها في واتساب"); } catch (e) { setNotice(text); }
  }
  async function doSearch(q) {
    if (!q || !q.trim()) { setSRes([]); return; }
    setSBusy(true);
    const term = "%" + q.trim() + "%";
    const { data } = await supabase.from("posts").select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count), comments!comments_post_id_fkey(count)").or("title.ilike." + term + ",body.ilike." + term).order("created_at", { ascending: false }).limit(20);
    setSRes(data || []); setSBusy(false);
  }
  function ts(e) { if (window.scrollY <= 0) setStartY(e.touches[0].clientY); }
  function tm(e) { if (startY != null && window.scrollY <= 0) { const dy = e.touches[0].clientY - startY; if (dy > 0) setPull(Math.min(dy, 90)); } }
  function te() { if (pull > 60) { loadPosts(); flashNotice("تم التحديث ✔"); } setPull(0); setStartY(null); }
  async function openProfile(userId) {
    setSheet({ type: "profile", userId });
    setSheetLoading(true);
    const [pr, ps, cc] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("posts").select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count), comments!comments_post_id_fkey(count)").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("user_id", userId)
    ]);
    const [fc, fme, myf] = await Promise.all([
      supabase.from("user_follows").select("*", { count: "exact", head: true }).eq("target_id", userId),
      supabase.from("user_follows").select("*").eq("target_id", profile.id).eq("user_id", userId).maybeSingle(),
      supabase.from("user_follows").select("*").eq("user_id", profile.id).eq("target_id", userId).maybeSingle()
    ]);
    setFollowInfo({ followers: fc.count || 0, followsMe: !!fme.data, iFollow: !!myf.data });
    setProfView({ pr: pr.data, ps: ps.data || [], cCount: cc.count || 0 });
    setSheetLoading(false);
  }
  async function openPostById(postId) {
    const { data } = await supabase.from("posts").select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count), comments!comments_post_id_fkey(count)").eq("id", postId).maybeSingle();
    if (data) setSheet({ type: "post", post: data });
    else flashNotice("المنشور غير متاح (ربما حُذف)");
  }
  async function toggleFollowUser(userId) {
    if (followInfo?.iFollow) {
      await supabase.from("user_follows").delete().eq("user_id", profile.id).eq("target_id", userId);
      setFollowInfo((f) => ({ ...f, iFollow: false, followers: Math.max(0, (f.followers || 1) - 1) }));
    } else {
      await supabase.from("user_follows").insert({ user_id: profile.id, target_id: userId });
      await supabase.from("notifications").insert({ user_id: userId, actor_id: profile.id, type: "follow", post_id: null });
      setFollowInfo((f) => ({ ...f, iFollow: true, followers: (f.followers || 0) + 1 }));
    }
  }
  async function toggleCommentLike(commentId) {
    const mine = cLikesMine.includes(commentId);
    if (mine) {
      setCLikesMine((a) => a.filter((x) => x !== commentId));
      setCLikesCount((m) => ({ ...m, [commentId]: Math.max(0, (m[commentId] || 1) - 1) }));
      await supabase.from("comment_likes").delete().eq("user_id", profile.id).eq("comment_id", commentId);
    } else {
      setCLikesMine((a) => [...a, commentId]);
      setCLikesCount((m) => ({ ...m, [commentId]: (m[commentId] || 0) + 1 }));
      await supabase.from("comment_likes").insert({ user_id: profile.id, comment_id: commentId });
    }
  }
  async function saveEditPost() {
    if (!sheet || !sheet.post) return;
    await supabase.from("posts").update({ title: editTitle, body: editBody }).eq("id", sheet.post.id);
    flashNotice("تم تعديل المنشور ✏️");
    closeSheet(); loadPosts();
  }
  async function loadBlocks() {
    const { data } = await supabase.from("blocks").select("blocked_id").eq("user_id", profile.id);
    setBlockedIds(new Set((data || []).map((x) => x.blocked_id)));
  }
  async function toggleBlock(userId) {
    if (blockedIds.has(userId)) {
      await supabase.from("blocks").delete().eq("user_id", profile.id).eq("blocked_id", userId);
      const n = new Set(blockedIds); n.delete(userId); setBlockedIds(n);
      flashNotice("تم إلغاء الحظر");
    } else {
      await supabase.from("blocks").insert({ user_id: profile.id, blocked_id: userId });
      const n = new Set(blockedIds); n.add(userId); setBlockedIds(n);
      flashNotice("تم حظر المستخدم 🚫 لن ترى منشوراته");
    }
    loadPosts();
  }
  async function votePoll(optionId, postId) {
    if (myVotes.has(optionId)) { flashNotice("صوتّ بالفعل على هذا الاستطلاع"); return; }
    await supabase.from("poll_votes").insert({ option_id: optionId, user_id: profile.id });
    const n = new Set(myVotes); n.add(optionId); setMyVotes(n);
    setPosts((old) => old.map((p) => p.id === postId ? { ...p, poll_options: (p.poll_options || []).map((o) => o.id === optionId ? { ...o, poll_votes: [{ count: (o.poll_votes?.[0]?.count || 0) + 1 }] } : o) } : p));
  }
  async function loadStories() {
    const since = new Date(Date.now() - 86400000).toISOString();
    const [{ data: st }, { data: uf }] = await Promise.all([
      supabase.from("stories").select("*, profiles!stories_user_id_fkey(username, city_id)").gte("created_at", since).order("created_at", { ascending: false }).limit(60),
      supabase.from("user_follows").select("target_id").eq("user_id", profile.id)
    ]);
    const followUsers = new Set((uf || []).map((x) => x.target_id));
    const okCities = new Set([profile.city_id, ...follows]);
    const list = (st || []).filter((x) => x.user_id === profile.id || followUsers.has(x.user_id) || okCities.has(x.profiles?.city_id));
    const g = {};
    list.forEach((x) => { if (!g[x.user_id]) g[x.user_id] = { user: x.user_id, name: x.profiles?.username, items: [] }; g[x.user_id].items.push(x); });
    setStoryGroups(Object.values(g));
  }
  async function addStory(file, bodyText) {
    const blob = await compressImage(file);
    const path = profile.id + "/story-" + Date.now() + ".jpg";
    const { error: ue } = await supabase.storage.from("post-images").upload(path, blob, { contentType: "image/jpeg" });
    if (ue) { flashNotice("فشل رفع القصة: " + ue.message); return; }
    const url = supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
    await supabase.from("stories").insert({ user_id: profile.id, image_url: url, body: bodyText || null });
    flashNotice("تم نشر قصتك 📸");
    closeSheet(); loadStories();
  }
  function openStory(group) {
    const all = [];
    storyGroups.forEach((gg) => gg.items.forEach((it) => all.push(it)));
    all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const idx = all.findIndex((x) => x.id === group.items[0].id);
    setStoryView({ all, i: idx >= 0 ? idx : 0 });
    const seen = new Set(storySeen); group.items.forEach((it) => seen.add(it.id));
    setStorySeen(seen); localStorage.setItem("lamma-seen", JSON.stringify([...seen]));
  }
  async function loadEvents() {
    const { data } = await supabase.from("events").select("*").eq("city_id", selectedCityId).gte("event_date", new Date().toISOString()).order("event_date", { ascending: true }).limit(5);
    setEvents(data || []);
  }
  async function addEvent() {
    if (!evTitle.trim() || !evDate) { flashNotice("العنوان والتاريخ مطلوبان"); return; }
    await supabase.from("events").insert({ city_id: selectedCityId, user_id: profile.id, title: evTitle.trim(), body: evBody.trim() || null, location: evLoc.trim() || null, event_date: new Date(evDate).toISOString() });
    setEvTitle(""); setEvBody(""); setEvLoc(""); setEvDate("");
    closeSheet(); flashNotice("تم نشر الحدث 📅"); loadEvents();
  }
  async function deleteEvent(id) { await supabase.from("events").delete().eq("id", id); loadEvents(); }
  async function logout() { await supabase.auth.signOut(); }

  const cardProps = (p) => ({
    post: p, voted: votedIds.has(p.id) || optimisticLiked.has(p.id), useful: usefulCount(p), comments: commentCount(p),
    onLike: toggleUseful, onComments: () => setSheet({ type: "comments", post: p }),
    onShare: () => sharePost(p), onReport: () => setSheet({ type: "report", post: p }),
    saved: savedIds.has(p.id) || optimisticSaved.has(p.id), onSave: () => toggleSave(p),
    onPin: () => togglePin(p.id, p.is_pinned),
    onMessage: p.user_id !== profile.id ? () => openChatWith(p.user_id, p.profiles?.username) : null,
    canPin: profile.is_admin,
    onDelete: (p.user_id === profile.id || profile.is_admin) ? () => { if (delId === p.id) deletePost(p.id); else { setDelId(p.id); flashNotice("اضغط مرة أخرى لتأكيد الحذف"); setTimeout(() => setDelId(null), 2500); } } : null,
    onOpenProfile: () => openProfile(p.user_id), onZoom: () => setSheet({ type: "zoom", src: p.image_url }),
    onEdit: p.user_id === profile.id ? () => { setEditTitle(p.title); setEditBody(p.body); setSheet({ type: "edit", post: p }); } : null,
    city: cityName, cat: categoryLabel
  });

  const sortedPosts = sortBy === "top" ? [...posts].sort((a, b) => usefulCount(b) - usefulCount(a)) : posts;
  const skelRow = <div className="skpost"><div className="sk head" /><div className="sk img" /></div>;
  return (
    <div className="app">
      {!online && <div className="notice" style={{ background: "#fef2f2", color: "#991b1b", borderColor: "#fca5a5" }}>📴 لا يوجد اتصال بالإنترنت</div>}
      <header className="topbar2">
        <div className="logo">لَمّة</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="ibtn" onClick={() => setSheet({ type: "search" })}><Icon n="search" /></button>
          <button className="ibtn" onClick={() => { const d = document.body.classList.toggle("dark"); localStorage.setItem("lamma-dark", d ? "1" : "0"); }}><Icon n="moon" /></button>
          <button className="ibtn" onClick={openInbox} style={{ position: "relative" }}><Icon n="mail" />{unreadMsgs > 0 && <span className="nbadge">{unreadMsgs}</span>}</button>
          <button className="ibtn" onClick={openNotif} style={{ position: "relative" }}><Icon n="bell" />{unread > 0 && <span className="nbadge">{unread}</span>}</button>
          {profile.is_admin && <button className="ibtn" onClick={() => setTab("admin")}><Icon n="shield" /></button>}
          <button className="ibtn" onClick={() => { if (confirmLogout) logout(); else { setConfirmLogout(true); flashNotice("اضغط مرة أخرى لتأكيد الخروج"); setTimeout(() => setConfirmLogout(false), 2500); } }}><Icon n="out" /></button>
        </div>
      </header>
      {notice && <div className="notice">{notice}</div>}
      <UpdateNotice />
      {tab === "home" && (
        <div onTouchStart={ts} onTouchMove={tm} onTouchEnd={te}>
          <div className={"pull " + (pull > 10 ? "on" : "")}><Icon n="refresh" s={20} /></div>
          <div className="stories">
            <button className="story" onClick={() => setSheet({ type: "storynew" })}>
              <span className="ring"><span className="ava" style={{ background: "#fff", color: "#0f766e", border: "2px dashed #0f766e" }}>+</span></span>
              <span className="sname">قصتك</span>
            </button>
            {storyGroups.map((g) => (
              <button key={g.user} className="story" onClick={() => openStory(g)}>
                <span className="ring" style={{ border: g.items.some((it) => !storySeen.has(it.id)) ? "2px solid #f59e0b" : undefined }}>
                  <span className="ava">{avaLetter(g.name)}</span>
                </span>
                <span className="sname">{g.name}</span>
              </button>
            ))}
          </div>
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
              <button className="chip" onClick={() => toggleFollow(selectedCityId)}>{follows.includes(selectedCityId) ? "✓ متابَعة" : "+ متابعة"}</button>
            )}
          </div>
          <div className="chips" style={{ padding: "0 14px 8px" }}>
            <button className={!catFilter ? "on" : ""} onClick={() => setCatFilter(null)}>الكل</button>
            {categories.map((c) => (<button key={c.id} className={catFilter === c.id ? "on" : ""} onClick={() => setCatFilter(c.id)}>{c.label}</button>))}
          </div>
          <div className="chips" style={{ padding: "0 14px 8px" }}>
            <button className={sortBy === "new" ? "on" : ""} onClick={() => setSortBy("new")}>🕒 الأحدث</button>
            <button className={sortBy === "top" ? "on" : ""} onClick={() => setSortBy("top")}>🔥 الأكثر فائدة</button>
            <button onClick={() => setSheet({ type: "event" })}>📅 إضافة حدث</button>
          </div>
          {events.length > 0 && (
            <div className="card2" style={{ margin: "0 14px 10px" }}>
              <h3>📅 أحداث قادمة في {cityName(selectedCityId)}</h3>
              {events.map((ev) => (
                <div className="msg-item" key={ev.id}>
                  <div className="msg-name">{ev.title}<div className="muted" style={{ fontWeight: 400 }}>{new Date(ev.event_date).toLocaleString("ar-LY")}{ev.location ? " · " + ev.location : ""}</div>{ev.body && <div style={{ fontWeight: 400, fontSize: 13 }}>{ev.body}</div>}</div>
                  {(ev.user_id === profile.id || profile.is_admin) && <button className="ibtn" onClick={() => deleteEvent(ev.id)}><Icon n="trash" s={16} /></button>}
                </div>
              ))}
            </div>
          )}
          {skel && skelRow}{skel && skelRow}
          {!skel && posts.length === 0 && <div className="empty">لا منشورات بعد في {cityName(selectedCityId)}.<br />كن أول من ينشر!</div>}
          {!skel && sortedPosts.filter((p) => !blockedIds.has(p.user_id)).map((p) => (<PostCard key={p.id} {...cardProps(p)} />))}
        </div>
      )}
      {tab === "pulse" && <Pulse profile={profile} cities={cities} onOpen={(p) => setSheet({ type: "post", post: p })} />}
      {tab === "follows" && (
        <>
          {follows.length === 0 && <div className="empty">لم تتابع أي مدينة بعد.<br />من تبويب المدينة اضغط "+ متابعة".</div>}
          {skel && skelRow}
          {!skel && posts.filter((p) => !blockedIds.has(p.user_id)).map((p) => (<PostCard key={p.id} {...cardProps(p)} />))}
        </>
      )}
      {tab === "admin" && profile.is_admin && <Admin />}
      {tab === "me" && <Me profile={profile} cities={cities} onInvite={shareApp} onSaves={() => openSavesWrap()} onStats={() => { loadMyStats(); setSheet({ type: "mystats" }); }} onEditBio={() => setSheet({ type: "bio" })} onMyPosts={() => openProfile(profile.id)} />}
      {storyView && storyView.all[storyView.i] && (
        <div className="overlay" style={{ alignItems: "stretch" }} onClick={() => setStoryView((v) => (v && v.i < v.all.length - 1 ? { ...v, i: v.i + 1 } : null))}>
          <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
            <div style={{ position: "absolute", top: 8, left: 8, right: 8, display: "flex", gap: 3, zIndex: 3 }}>
              {storyView.all.map((x, i) => (<span key={x.id} style={{ flex: 1, height: 3, borderRadius: 9, background: i <= storyView.i ? "#fff" : "rgba(255,255,255,.35)" }} />))}
            </div>
            <img src={storyView.all[storyView.i].image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 14, background: "linear-gradient(transparent, rgba(0,0,0,.7))", color: "#fff", zIndex: 3 }}>
              <b>@{storyView.all[storyView.i].profiles?.username}</b> · {timeAgo(storyView.all[storyView.i].created_at)}
              {storyView.all[storyView.i].body && <div>{storyView.all[storyView.i].body}</div>}
              <button className="chip" style={{ marginTop: 6, background: "#fff" }} onClick={(e) => { e.stopPropagation(); const a = storyView.all[storyView.i]; setStoryView(null); openChatWith(a.user_id, a.profiles?.username); }}>💬 رد على القصة</button>
            </div>
            <button className="ibtn" style={{ position: "absolute", top: 18, right: 8, color: "#fff", zIndex: 4 }} onClick={(e) => { e.stopPropagation(); setStoryView(null); }}>✕</button>
            <button className="ibtn" style={{ position: "absolute", top: "45%", left: 8, color: "#fff", zIndex: 4 }} onClick={(e) => { e.stopPropagation(); setStoryView((v) => (v && v.i > 0 ? { ...v, i: v.i - 1 } : v)); }}>‹</button>
          </div>
        </div>
      )}
      {sheet && sheet.type === "storynew" && (
        <Sheet title="📸 قصة جديدة (24 ساعة)" onClose={closeSheet}>
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files[0]; if (f) addStory(f, storyBody); }} />
          <input placeholder="نص اختياري مع القصة..." value={storyBody} onChange={(e) => setStoryBody(e.target.value)} style={{ marginTop: 8 }} />
          <div className="muted">ستختفي قصتك تلقائيًا بعد 24 ساعة.</div>
        </Sheet>
      )}
      {tour && (
        <div className="overlay" style={{ alignItems: "center" }}>
          <div className="authcard" style={{ margin: 16 }}>
            <h2>👋 أهلًا بك في لَمّة</h2>
            <ul style={{ paddingRight: 18, lineHeight: 2, fontSize: 14 }}>
              <li>⭕ دوائر الأعلى: قصص تختفي بعد 24 ساعة، وبعدها مدن ليبيا.</li>
              <li>♥ اضغط مرتين على الصورة للإعجاب الفوري.</li>
              <li>📨 اضغط اسم أي مستخدم لفتح ملفه ومراسلته.</li>
            </ul>
            <button className="btn1" onClick={() => { setTour(false); localStorage.setItem("lamma-tour", "1"); }}>يلا نبدأ 🚀</button>
          </div>
        </div>
      )}
      {showTop && <button className="totop" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>⬆</button>}
      <nav className="bottom">
        <button className={tab === "home" ? "on" : ""} onClick={() => setTab("home")}><Icon n="home" /></button>
        <button className={tab === "pulse" ? "on" : ""} onClick={() => setTab("pulse")}><Icon n="comp" /></button>
        <button className="addbtn" onClick={() => { try { const d = JSON.parse(localStorage.getItem("lamma-draft") || "null"); if (d && !title && !body) { setTitle(d.t || ""); setBody(d.b || ""); } } catch (e2) {} setSheet({ type: "compose" }); }}><Icon n="plus" /></button>
        <button className={tab === "follows" ? "on" : ""} onClick={() => setTab("follows")}><Icon n="heart" /></button>
        <button className={tab === "me" ? "on" : ""} onClick={() => setTab("me")}><Icon n="user" /></button>
      </nav>

      {sheet && sheet.type === "notif" && (
        <Sheet title="الإشعارات" onClose={closeSheet}>
          {sheetLoading && skelRow}
          {!sheetLoading && nList.map((n) => (
            <div className="comment" key={n.id} style={{ cursor: "pointer" }} onClick={() => { const pid = n.post_id; closeSheet(); if (pid) openPostById(pid); }}>
              <span className="ava sm">{avaLetter(n.profiles?.username)}</span>
              <div>{n.type === "comment" ? "💬 علّق" : n.type === "follow" ? "👥 بدأ متابعتك" : "♥ أعجب"} <b>@{n.profiles?.username}</b> على: {n.posts?.title || "منشور"}<div className="muted">{timeAgo(n.created_at)}</div></div>
            </div>
          ))}
          {!sheetLoading && nList.length === 0 && <div className="empty">لا إشعارات بعد.</div>}
        </Sheet>
      )}
      {sheet && sheet.type === "inbox" && (
        <Sheet title="📨 الرسائل" onClose={closeSheet}>
          {sheetLoading && skelRow}
          {!sheetLoading && inbox.length === 0 && <div className="empty">لا رسائل بعد.</div>}
          {!sheetLoading && inbox.map((c) => (
            <div className="msg-item" key={c.peer} onClick={() => openChatWith(c.peer, c.peerName)}>
              <span className="ava sm">{avaLetter(c.peerName)}</span>
              <div className="msg-name">@{c.peerName}{c.unread > 0 && <span className="unread-dot" style={{ display: "inline-block", marginLeft: 6 }} />}</div>
              <div className="msg-time">{timeAgo(c.last.created_at)}</div>
            </div>
          ))}
        </Sheet>
      )}
      {sheet && sheet.type === "chat" && (
        <Sheet title={"💬 @" + sheet.peerName} onClose={closeSheet}>
          {sheetLoading && skelRow}
          <div style={{ maxHeight: 320, overflowY: "auto", padding: 8 }}>
            {(sheet.messages || []).map((m) => (
              <div key={m.id} style={{ textAlign: m.from_id === profile.id ? "left" : "right", margin: "6px 0" }}>
                <div style={{ display: "inline-block", padding: "8px 12px", borderRadius: 14, background: m.from_id === profile.id ? "#0f766e" : "#efefef", color: m.from_id === profile.id ? "#fff" : "#111", maxWidth: "80%" }}>
                  {m.body}<div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{timeAgo(m.created_at)} {m.from_id === profile.id && (m.read ? "✓✓" : "✓")}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="crow">
            <input placeholder="اكتب رسالة..." value={sheet.text || ""} onChange={(e) => setSheet((prev) => ({ ...prev, text: e.target.value }))} />
            <button onClick={() => sendMessage(sheet.peerId, sheet.text || "")}>إرسال</button>
          </div>
        </Sheet>
      )}
      {sheet && sheet.type === "saves" && (
        <Sheet title="محفوظاتي" onClose={closeSheet}>
          {sheetLoading && skelRow}
          {!sheetLoading && svList.length === 0 && <div className="empty">لا منشورات محفوظة.</div>}
          {!sheetLoading && svList.map((p) => (<PostCard key={p.id} {...cardProps(p)} />))}
        </Sheet>
      )}
      {sheet && sheet.type === "mystats" && (
        <Sheet title="📊 إحصائياتي" onClose={closeSheet}>
          <div className="mehead">
            <span className="ava" style={{ width: 72, height: 72, fontSize: 28 }}>{avaLetter(profile.username)}</span>
            <b>@{profile.username}</b>
            <div className="muted">عضو منذ {new Date(profile.joined_at || Date.now()).toLocaleDateString("ar-LY")}</div>
          </div>
          <div className="stat-grid">
            <div className="stat-cell"><b>{myStats?.posts || 0}</b><span>منشوراتي</span></div>
            <div className="stat-cell"><b>{myStats?.comments || 0}</b><span>تعليقاتي</span></div>
            <div className="stat-cell"><b>{myStats?.likes || 0}</b><span>إعجاباتي</span></div>
            <div className="stat-cell"><b>{myStats?.follows || 0}</b><span>مدن أتابعها</span></div>
          </div>
        </Sheet>
      )}
      {sheet && sheet.type === "bio" && (
        <Sheet title="✏️ تعديل السيرة الذاتية" onClose={closeSheet}>
          <textarea placeholder="اكتب عن نفسك (200 حرف)..." value={bioDraft} onChange={(e) => setBioDraft(e.target.value.slice(0, 200))} style={{ minHeight: 120 }} />
          <div className="muted">{bioDraft.length}/200</div>
          <button className="btn1" onClick={async () => { await supabase.from("profiles").update({ bio: bioDraft }).eq("id", profile.id); flashNotice("تم الحفظ ✔"); closeSheet(); }}>حفظ</button>
        </Sheet>
      )}
      {sheet && sheet.type === "search" && (
        <Sheet title="بحث في كل المدن" onClose={closeSheet}>
          <input placeholder="ابحث عن منشور..." value={sQ} onChange={(e) => { setSQ(e.target.value); if (debounceTimer.current) clearTimeout(debounceTimer.current); debounceTimer.current = setTimeout(() => doSearch(e.target.value), 400); }} />
          <button className="btn1" onClick={() => doSearch(sQ)}>{sBusy ? "جاري البحث..." : "بحث"}</button>
          {sRes.map((p) => (<PostCard key={p.id} {...cardProps(p)} />))}
          {peopleRes.length > 0 && (
            <div className="card2" style={{ margin: "10px 0" }}>
              <h3>👥 أشخاص</h3>
              {peopleRes.map((u) => (
                <div className="msg-item" key={u.id} onClick={() => { closeSheet(); openProfile(u.id); }}>
                  <span className="ava sm">{avaLetter(u.username)}</span>
                  <div className="msg-name">@{u.username}</div>
                  <div className="msg-time">{cityName(u.city_id)}</div>
                </div>
              ))}
            </div>
          )}
          {sRes.length === 0 && sQ && !sBusy && <div className="empty">لا نتائج.</div>}
        </Sheet>
      )}
      {sheet && sheet.type === "report" && (
        <Sheet title="إبلاغ عن المنشور" onClose={closeSheet}>
          <input placeholder="سبب البلاغ" value={rText} onChange={(e) => setRText(e.target.value)} />
          <button className="btn1" onClick={() => sendReport(sheet.post.id)}>إرسال البلاغ</button>
          <button className="btn2" onClick={closeSheet}>إلغاء</button>
        </Sheet>
      )}
      {sheet && sheet.type === "comments" && (
        <Sheet title={"التعليقات (" + cList.length + ")"} onClose={closeSheet}>
          {cList.map((c) => (
            <div className="comment" key={c.id}>
              <span className="ava sm">{avaLetter(c.profiles?.username)}</span>
              <div style={{ flex: 1 }}><b className="clickname" onClick={() => openProfile(c.user_id)}>@{c.profiles?.username}</b> {c.body} {c.user_id === profile.id && <button className="ibtn" style={{ padding: 2 }} onClick={() => deleteComment(c.id)}><Icon n="trash" s={14} /></button>} <button className="ibtn" style={{ padding: 2 }} onClick={() => toggleCommentLike(c.id)}><Icon n="heart" s={14} f={cLikesMine.includes(c.id)} /> {cLikesCount[c.id] || 0}</button></div>
            </div>
          ))}
          {cList.length === 0 && <div className="empty">لا تعليقات بعد. كن أول من يعلّق!</div>}
          <div className="crow">
            <input placeholder="أضف تعليقًا..." value={cText} onChange={(e) => setCText(e.target.value)} />
            <button onClick={() => addComment(sheet.post.id)}>إرسال</button>
          </div>
        </Sheet>
      )}
      {sheet && sheet.type === "zoom" && (
        <div className="overlay" onClick={closeSheet} style={{ alignItems: "center" }}>
          <img src={sheet.src} alt="" style={{ width: "100%", maxHeight: "92vh", objectFit: "contain" }} />
        </div>
      )}
      {sheet && sheet.type === "profile" && (
        <Sheet title={"ملف @" + (profView?.pr?.username || "...")} onClose={closeSheet}>
          {sheetLoading && skelRow}
          {!sheetLoading && profView && profView.pr && (
            <>
              <div className="mehead">
                <span className="ava">{avaLetter(profView.pr.username)}</span>
                <b>@{profView.pr.username}</b>
                <span className="muted">{cityName(profView.pr.city_id)} • عضو منذ {new Date(profView.pr.joined_at || Date.now()).toLocaleDateString("ar-LY")}</span>
                {profView.pr.bio && <div style={{ fontSize: 14, color: "#444", textAlign: "center" }}>{profView.pr.bio}</div>}
              </div>
              <div className="cityline" style={{ padding: "4px 0" }}>
                <span className="muted">{followInfo?.followers || 0} متابع {followInfo?.followsMe && <span className="badge2">يتابعك</span>}</span>
                {profView.pr.id !== profile.id && (
                  <>
                    <button className="chip" onClick={() => toggleFollowUser(profView.pr.id)}>{followInfo?.iFollow ? "✓ تتابعه" : "+ متابعة"}</button>
                    <button className="chip" style={{ borderColor: "#b91c1c", color: "#b91c1c", marginRight: 6 }} onClick={() => toggleBlock(profView.pr.id)}>{blockedIds.has(profView.pr.id) ? "إلغاء الحظر" : "🚫 حظر"}</button>
                  </>
                )}
              </div>
              <div className="muted" style={{ textAlign: "center" }}>{activityBadge(profView.ps.length)}</div>
              <div className="stat-grid">
                <div className="stat-cell"><b>{profView.ps.length}</b><span>منشور</span></div>
                <div className="stat-cell"><b>{profView.cCount}</b><span>تعليق</span></div>
              </div>
              {profView.pr.id !== profile.id && (
                <button className="btn1" onClick={() => openChatWith(profView.pr.id, profView.pr.username)}>📨 مراسلة</button>
              )}
              {profView.ps.map((p) => (<PostCard key={p.id} {...cardProps(p)} />))}
              {profView.ps.length === 0 && <div className="empty">لا منشورات بعد.</div>}
            </>
          )}
        </Sheet>
      )}
      {sheet && sheet.type === "edit" && (
        <Sheet title="✏️ تعديل المنشور" onClose={closeSheet}>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120} />
          <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} maxLength={1000} style={{ marginTop: 8, minHeight: 120 }} />
          <button className="btn1" onClick={saveEditPost}>حفظ التعديلات</button>
        </Sheet>
      )}
      {sheet && sheet.type === "event" && (
        <Sheet title={"📅 حدث جديد في " + cityName(selectedCityId)} onClose={closeSheet}>
          <input placeholder="عنوان الحدث" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} maxLength={120} />
          <input placeholder="المكان (اختياري)" value={evLoc} onChange={(e) => setEvLoc(e.target.value)} style={{ marginTop: 8 }} />
          <input type="datetime-local" value={evDate} onChange={(e) => setEvDate(e.target.value)} style={{ marginTop: 8 }} />
          <textarea placeholder="تفاصيل (اختياري)" value={evBody} onChange={(e) => setEvBody(e.target.value)} maxLength={600} style={{ marginTop: 8 }} />
          <button className="btn1" onClick={addEvent}>نشر الحدث</button>
        </Sheet>
      )}
      {sheet && sheet.type === "compose" && (
        <Sheet title="منشور جديد" onClose={closeSheet}>
          <div className="chips">{categories.map((c) => (<button key={c.id} className={category === c.id ? "on" : ""} onClick={() => setCategory(c.id)}>{c.label}</button>))}</div>
          {category === "market" && <input placeholder="السعر (مثال: 25 د.ل)" value={price} onChange={(e) => setPrice(e.target.value)} style={{ marginBottom: 8 }} />}
          <input placeholder="العنوان" value={title} onChange={(e) => { setTitle(e.target.value); try { localStorage.setItem("lamma-draft", JSON.stringify({ t: e.target.value, b: body })); } catch (e2) {} }} maxLength={120} />
          <textarea placeholder="اكتب التفاصيل..." value={body} onChange={(e) => { setBody(e.target.value); try { localStorage.setItem("lamma-draft", JSON.stringify({ t: title, b: e.target.value })); } catch (e2) {} }} maxLength={1000} style={{ marginTop: 8 }} />
          <input type="file" accept="image/*" onChange={(e) => pickImage(e.target.files[0] || null)} style={{ marginTop: 8 }} />
          {imgPrev && <img className="imgprev" src={imgPrev} alt="" />}
          <button className="btn2" onClick={() => setAddPoll(!addPoll)}>{addPoll ? "− إزالة الاستطلاع" : "📊 إضافة استطلاع"}</button>
          {addPoll && pollOpts.map((t, i) => (
            <input key={i} placeholder={"الخيار " + (i + 1)} value={t} onChange={(e) => setPollOpts((a) => a.map((x, j) => (j === i ? e.target.value : x)))} style={{ marginTop: 6 }} />
          ))}
          <div className="muted">سيُنشر في: {cityName(selectedCityId)}</div>
          <button className="btn1" disabled={busy || !title || !body} onClick={createPost}>نشر</button>
          {message && <div className="error">{message}</div>}
        </Sheet>
      )}
      {sheet && sheet.type === "post" && (
        <Sheet title="منشور" onClose={closeSheet}>
          <PostCard {...cardProps(sheet.post)} />
        </Sheet>
      )}
    </div>
  );
}

function Pulse({ profile, cities, onOpen }) {
  const [items, setItems] = useState([]);
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from("posts").select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count)").order("created_at", { ascending: false }).limit(100);
    const list = (data || []).map((p) => ({ ...p, vc: p.useful_votes?.[0]?.count || 0 })).filter((p) => p.vc > 0 && p.city_id !== profile.city_id).sort((a, b) => b.vc - a.vc).slice(0, 30);
    setItems(list);
    const cnt = {};
    (data || []).forEach((p) => { cnt[p.user_id] = cnt[p.user_id] || { n: 0, u: p.profiles?.username }; cnt[p.user_id].n++; });
    setBoard(Object.values(cnt).sort((a, b) => b.n - a.n).slice(0, 5));
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
      <div className="card2" style={{ margin: 10 }}>
        <h3>🏆 أنشط الأعضاء</h3>
        {board.map((b, i) => (
          <div className="msg-item" key={i}>
            <span className="ava sm">{avaLetter(b.u)}</span>
            <div className="msg-name">{i + 1}. @{b.u}</div>
            <div className="msg-time">{b.n} منشور</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Admin() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
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

function Me({ profile, cities, onInvite, onSaves, onStats, onEditBio, onMyPosts }) {
  const [copied, setCopied] = useState(false);
  function cityName(id) { return cities.find((c) => c.id === Number(id))?.name || ""; }
  async function invite() { await onInvite(); setCopied(true); setTimeout(() => setCopied(false), 2500); }
  return (
    <div>
      <div className="mehead">
        <span className="ava">{avaLetter(profile.username)}</span>
        <b style={{ fontSize: 18 }}>@{profile.username} {profile.is_admin ? "👑" : ""}</b>
        <span className="muted">{cityName(profile.city_id)}</span>
        {profile.bio && <div style={{ fontSize: 14, color: "#444", textAlign: "center", marginTop: 6 }}>{profile.bio}</div>}
      </div>
      <div className="stats"><span>ليبي 100%</span><span>بدون إعلانات</span><span>مجتمع حقيقي</span></div>
      <div className="card2">
        <h3>عن لَمّة</h3>
        <p className="muted">شبكة اجتماعية ليبية بسيطة تجمع أهل المدينة الواحدة: خدمات، تنبيهات، سوق، سوالف، وتواصل بين المدن.</p>
        <span className="badge2">الإصدار 2.0</span> <span className="badge2">بناء: {String(BUILD_SHA).slice(0, 7)}</span>
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
        <button className="btn2" onClick={onMyPosts}>📄 منشوراتي</button>
        <button className="btn2" onClick={onSaves}>🔖 محفوظاتي</button>
        <button className="btn2" onClick={onStats} style={{ marginTop: 8 }}>📊 إحصائياتي</button>
        <button className="btn2" onClick={onEditBio} style={{ marginTop: 8 }}>✏️ تعديل السيرة</button>
      </div>
      <div className="card2">
        <button className="btn1" onClick={invite}>{copied ? "تم النسخ ✔" : "📤 دعوة جيرانك"}</button>
      </div>
    </div>
  );
}

function UpdateNotice() {
  const [info, setInfo] = useState(null);
  useEffect(() => { check(); }, []);
  async function check() {
    try {
      const r = await fetch("https://api.github.com/repos/abdo15542/lamma/releases/tags/latest", { cache: "no-store" });
      if (!r.ok) { setInfo(null); return; }
      const d = await r.json();
      const bm = String(d.body || "").match(/commit ([0-9a-f]{7,40})/);
      const sha = String(bm ? bm[1] : (d.target_commitish || "")).slice(0, 7);
      const mine = String(BUILD_SHA).slice(0, 7);
      if (sha && mine !== "dev" && sha !== mine) {
        const asset = (d.assets || []).find((a) => a.name.endsWith(".apk"));
        setInfo({ url: asset ? asset.browser_download_url : d.html_url, sha, mine });
      } else setInfo(null);
    } catch (e) { setInfo(null); }
  }
  if (!info) return null;
  return (
    <div className="notice">
      🔄 يتوفر تحديث جديد للَمّة! (نسختك: {info.mine} — المتاح: {info.sha})
      <button className="btn1" onClick={() => { const a = document.createElement("a"); a.href = info.url; a.target = "_blank"; a.click(); }}>⬇️ حدّث الآن</button>
    </div>
  );
}

async function shareApp() {
  const text = "📱 انضم إلى تطبيق لَمّة - مجتمع مدينتك في ليبيا:\nhttps://github.com/abdo15542/lamma/releases/tag/latest";
  try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) {}
  try { await navigator.clipboard.writeText(text); } catch (e) {}
}

class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  render() {
    if (this.state.err) return (
      <div className="center"><div className="authcard">
        <h2>😵 حدث خطأ غير متوقع</h2>
        <p className="muted">{String(this.state.err && this.state.err.message ? this.state.err.message : this.state.err)}</p>
        <button className="btn1" onClick={() => location.reload()}>إعادة التشغيل</button>
      </div></div>
    );
    return this.props.children;
  }
}

export default function App() {
  return <ErrorBoundary><AppInner /></ErrorBoundary>;
}
