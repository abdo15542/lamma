import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

const categories = [
  { id: "services", label: "خدمات" },
  { id: "alerts", label: "تنبيهات" },
  { id: "market", label: "سوق" },
  { id: "talk", label: "سوالف" },
  { id: "travel", label: "بين المدن" }
];

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
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="card">
          <h2>لَمّة</h2>
          <p className="muted">مجتمع محلي ليبي: خدمات، تنبيهات، سوق، سوالف، وتواصل بين المدن.</p>
          <div className="row">
            <button type="button" className={mode === "login" ? "" : "secondary"} onClick={() => setMode("login")}>تسجيل دخول</button>
            <button type="button" className={mode === "register" ? "" : "secondary"} onClick={() => setMode("register")}>حساب جديد</button>
          </div>
          <form onSubmit={handleSubmit}>
            <input type="email" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            {mode === "register" && (
              <>
                <input type="text" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30} />
                <select value={cityId} onChange={(e) => setCityId(e.target.value)} required>
                  <option value="">اختر مدينتك</option>
                  {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </>
            )}
            <button disabled={busy}>{busy ? "جاري التنفيذ..." : mode === "login" ? "دخول" : "إنشاء حساب"}</button>
            {message && <div className="error">{message}</div>}
          </form>
        </div>
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
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="card">
          <h2>أكمل ملفك الشخصي</h2>
          <form onSubmit={save}>
            <input type="text" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30} />
            <select value={cityId} onChange={(e) => setCityId(e.target.value)} required>
              <option value="">اختر مدينتك</option>
              {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            <button disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ"}</button>
            {message && <div className="error">{message}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}


function Feed({ profile, cities }) {
  const [tab, setTab] = useState("city");
  const [selectedCityId, setSelectedCityId] = useState(profile.city_id);
  const [posts, setPosts] = useState([]);
  const [votedIds, setVotedIds] = useState(new Set());
  const [follows, setFollows] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("services");
  const [imageFile, setImageFile] = useState(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [commentsMap, setCommentsMap] = useState({});
  const [commentText, setCommentText] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [reportingId, setReportingId] = useState(null);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => { loadFollows(); }, []);
  useEffect(() => { if (tab === "city") loadPosts(); }, [selectedCityId, tab]);

  async function loadFollows() {
    const { data } = await supabase.from("city_follows").select("city_id").eq("user_id", profile.id);
    setFollows((data || []).map((x) => x.city_id));
  }
  async function loadPosts() {
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count), comments!comments_post_id_fkey(count)")
      .eq("city_id", selectedCityId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) setMessage("خطأ جلب: " + error.message);
    else setPosts(data || []);
    const { data: v } = await supabase.from("useful_votes").select("post_id").eq("user_id", profile.id);
    setVotedIds(new Set((v || []).map((x) => x.post_id)));
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
  async function createPost(e) {
    e.preventDefault(); setBusy(true); setMessage("");
    let imageUrl = null;
    if (imageFile) {
      const path = profile.id + "/" + Date.now() + "_" + imageFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const { error: ue } = await supabase.storage.from("post-images").upload(path, imageFile, { contentType: imageFile.type });
      if (ue) { setMessage("فشل رفع الصورة: " + ue.message); setBusy(false); return; }
      imageUrl = supabase.storage.from("post-images").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("posts").insert({
      user_id: profile.id, city_id: selectedCityId, category, title, body, image_url: imageUrl
    });
    if (error) setMessage("خطأ نشر: " + error.message);
    else { setTitle(""); setBody(""); setImageFile(null); setNotice("تم النشر بنجاح ✅"); loadPosts(); }
    setBusy(false);
  }
  async function toggleUseful(postId) {
    if (votedIds.has(postId)) {
      await supabase.from("useful_votes").delete().eq("post_id", postId).eq("user_id", profile.id);
      const n = new Set(votedIds); n.delete(postId); setVotedIds(n);
    } else {
      await supabase.from("useful_votes").insert({ post_id: postId, user_id: profile.id });
      const n = new Set(votedIds); n.add(postId); setVotedIds(n);
    }
    loadPosts();
  }
  async function toggleComments(postId) {
    if (openComments[postId]) { setOpenComments((m) => ({ ...m, [postId]: false })); return; }
    setOpenComments((m) => ({ ...m, [postId]: true }));
    const { data } = await supabase.from("comments").select("*, profiles!comments_user_id_fkey(username)").eq("post_id", postId).order("created_at", { ascending: true });
    setCommentsMap((m) => ({ ...m, [postId]: data || [] }));
  }
  async function addComment(postId) {
    const text = (commentText[postId] || "").trim();
    if (!text) return;
    await supabase.from("comments").insert({ post_id: postId, user_id: profile.id, body: text });
    setCommentText((m) => ({ ...m, [postId]: "" }));
    const { data } = await supabase.from("comments").select("*, profiles!comments_user_id_fkey(username)").eq("post_id", postId).order("created_at", { ascending: true });
    setCommentsMap((m) => ({ ...m, [postId]: data || [] }));
    loadPosts();
  }
  async function sendReport(postId) {
    if (!reportReason.trim()) return;
    await supabase.from("reports").insert({ post_id: postId, user_id: profile.id, reason: reportReason.trim() });
    setReportingId(null); setReportReason(""); setNotice("تم إرسال البلاغ إلى الإدارة ✔");
  }
  async function sharePost(post) {
    const text =
      "📱 لَمّة | " + categoryLabel(post.category) + "\n" +
      "🏙 المدينة: " + cityName(post.city_id) + "\n" +
      "📌 " + post.title + "\n" +
      "📝 " + post.body + "\n" +
      "— بواسطة @" + (post.profiles?.username || "") + "\n" +
      "👍 مفيد: " + usefulCount(post);
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) {}
    try {
      await navigator.clipboard.writeText(text);
      setNotice("تم نسخ بطاقة المنشور ✔ الصقها في واتساب أو فيسبوك");
    } catch (e) { setNotice(text); }
  }
  async function logout() { await supabase.auth.signOut(); }
  function cityName(id) { return cities.find((c) => c.id === Number(id))?.name || ""; }
  function categoryLabel(id) { return categories.find((i) => i.id === id)?.label || id; }
  function usefulCount(p) { return p.useful_votes?.[0]?.count || 0; }
  function commentCount(p) { return p.comments?.[0]?.count || 0; }

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>لَمّة</h2>
          <div className="muted">مرحبًا @{profile.username}{profile.is_admin ? " 👑" : ""}</div>
        </div>
        <button className="logout-btn" onClick={logout}>خروج</button>
      </div>

      <div className="row tabs">
        <button className={tab === "city" ? "tab active" : "tab"} onClick={() => setTab("city")}>المدينة</button>
        <button className={tab === "pulse" ? "tab active" : "tab"} onClick={() => setTab("pulse")}>نبض المدن</button>
        <button className={tab === "follows" ? "tab active" : "tab"} onClick={() => setTab("follows")}>أتابعها</button>
        {profile.is_admin && <button className={tab === "admin" ? "tab active" : "tab"} onClick={() => setTab("admin")}>الإدارة</button>}
        <button className={tab === "about" ? "tab active" : "tab"} onClick={() => setTab("about")}>عن التطبيق</button>
      </div>

      {notice && <div className="notice">{notice}</div>}

      {tab === "city" && (
        <>
          <div className="card">
            <label>المدينة</label>
            <select value={selectedCityId} onChange={(e) => setSelectedCityId(Number(e.target.value))}>
              {cities.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            <div className="muted">أنت الآن تشاهد منشورات مدينة: {cityName(selectedCityId)}</div>
            {selectedCityId !== profile.city_id && (
              <button className="secondary" onClick={() => toggleFollow(selectedCityId)}>
                {follows.includes(selectedCityId) ? "إلغاء متابعة هذه المدينة" : "➕ متابعة هذه المدينة (متبقي " + (2 - follows.length) + ")"}
              </button>
            )}
          </div>

          <div className="card">
            <h3>أضف منشورًا</h3>
            <form onSubmit={createPost}>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((i) => (<option key={i.id} value={i.id}>{i.label}</option>))}
              </select>
              <input type="text" placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
              <textarea placeholder="اكتب التفاصيل..." value={body} onChange={(e) => setBody(e.target.value)} required maxLength={1000} />
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0] || null)} />
              <button disabled={busy || !title || !body}>{busy ? "جاري النشر..." : "نشر"}</button>
              {message && <div className="error">{message}</div>}
            </form>
          </div>

          {posts.length === 0 && <div className="card">لا توجد منشورات بعد في هذه المدينة.</div>}

          {posts.map((post) => (
            <div className="card" key={post.id}>
              <div className="post-title">{post.title}</div>
              <div className="post-body">{post.body}</div>
              {post.image_url && <img className="imgpost" src={post.image_url} alt="" />}
              <div className="post-meta">
                <span className="badge">{categoryLabel(post.category)}</span>
                <span className="badge">{cityName(post.city_id)}</span>
                <span className="badge">@{post.profiles?.username}</span>
                <span className="badge">{new Date(post.created_at).toLocaleString("ar-LY")}</span>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className={"useful-btn " + (votedIds.has(post.id) ? "active" : "")} onClick={() => toggleUseful(post.id)}>
                  {votedIds.has(post.id) ? "مفيد ✓" : "مفيد"} ({usefulCount(post)})
                </button>
                <button className="useful-btn" onClick={() => toggleComments(post.id)}>💬 ({commentCount(post)})</button>
                <button className="useful-btn" onClick={() => sharePost(post)}>📤 مشاركة</button>
                <button className="useful-btn" onClick={() => { setReportingId(post.id); setReportReason(""); }}>🚨 بلاغ</button>
              </div>
              {reportingId === post.id && (
                <div className="row">
                  <input placeholder="سبب البلاغ" value={reportReason} onChange={(e) => setReportReason(e.target.value)} />
                  <button onClick={() => sendReport(post.id)}>إرسال</button>
                  <button className="secondary" onClick={() => setReportingId(null)}>إلغاء</button>
                </div>
              )}
              {openComments[post.id] && (
                <div>
                  {(commentsMap[post.id] || []).map((c) => (
                    <div className="comment" key={c.id}><b>@{c.profiles?.username}</b> : {c.body}</div>
                  ))}
                  <div className="row">
                    <input placeholder="اكتب تعليقًا" value={commentText[post.id] || ""} onChange={(e) => setCommentText((m) => ({ ...m, [post.id]: e.target.value }))} />
                    <button onClick={() => addComment(post.id)}>تعليق</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === "pulse" && <Pulse profile={profile} cities={cities} />}
      {tab === "follows" && <Follows follows={follows} cities={cities} />}
      {tab === "admin" && profile.is_admin && <Admin />}
      {tab === "about" && <About />}
    </div>
  );
}


function Pulse({ profile, cities }) {
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
      .slice(0, 10);
    setItems(list);
  }
  function cityName(id) { return cities.find((c) => c.id === Number(id))?.name || ""; }
  return (
    <div>
      <div className="card"><h3>🔥 نبض المدن</h3><div className="muted">أكثر المنشورات فائدة في المدن الأخرى (غير مدينتك)</div></div>
      {items.length === 0 && <div className="card">لا يوجد نبض بعد. كن أول من يصنع نبضًا!</div>}
      {items.map((p) => (
        <div className="card" key={p.id}>
          <div className="post-title">{p.title}</div>
          <div className="post-body">{p.body}</div>
          {p.image_url && <img className="imgpost" src={p.image_url} alt="" />}
          <div className="post-meta">
            <span className="badge"> {cityName(p.city_id)}</span>
            <span className="badge">@{p.profiles?.username}</span>
            <span className="badge">👍 {p.vc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Follows({ follows, cities }) {
  const [items, setItems] = useState([]);
  useEffect(() => { if (follows.length) load(); else setItems([]); }, [follows]);
  async function load() {
    const { data } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count)")
      .in("city_id", follows)
      .order("created_at", { ascending: false }).limit(50);
    setItems(data || []);
  }
  function cityName(id) { return cities.find((c) => c.id === Number(id))?.name || ""; }
  if (follows.length === 0) return <div className="card">لم تتابع أي مدينة بعد. افتح تبويب "المدينة" واختر مدينة ثم اضغط "متابعة".</div>;
  return (
    <div>
      <div className="card"><h3>🏙 مدن أتابعها</h3></div>
      {items.length === 0 && <div className="card">لا منشورات في مدنك المتابَعة بعد.</div>}
      {items.map((p) => (
        <div className="card" key={p.id}>
          <div className="post-title">{p.title}</div>
          <div className="post-body">{p.body}</div>
          {p.image_url && <img className="imgpost" src={p.image_url} alt="" />}
          <div className="post-meta">
            <span className="badge">🏙 {cityName(p.city_id)}</span>
            <span className="badge">@{p.profiles?.username}</span>
            <span className="badge">👍 {p.useful_votes?.[0]?.count || 0}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Admin() {
  const [reports, setReports] = useState([]);
  const [confirmId, setConfirmId] = useState(null);
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase
      .from("reports")
      .select("*, posts(title, body), profiles!reports_user_id_fkey(username)")
      .order("created_at", { ascending: false });
    setReports(data || []);
  }
  async function deletePost(postId) {
    await supabase.from("posts").delete().eq("id", postId);
    setConfirmId(null);
    load();
  }
  async function dismiss(reportId) {
    await supabase.from("reports").delete().eq("id", reportId);
    load();
  }
  return (
    <div>
      <div className="card"><h3>👑 لوحة الإدارة</h3><div className="muted">البلاغات الواردة من المستخدمين</div></div>
      {reports.length === 0 && <div className="card">لا توجد بلاغات. المجتمع نظيف ✔</div>}
      {reports.map((r) => (
        <div className="card" key={r.id}>
          <div className="badge">🚨 سبب البلاغ: {r.reason}</div>
          <div className="post-title" style={{ marginTop: 8 }}>{r.posts?.title || "(منشور محذوف)"}</div>
          <div className="post-body">{r.posts?.body}</div>
          <div className="post-meta"><span className="badge">المبلِّغ: @{r.profiles?.username}</span></div>
          {r.posts && (
            <div className="row" style={{ marginTop: 10 }}>
              {confirmId === r.post_id ? (
                <button onClick={() => deletePost(r.post_id)}>⚠️ تأكيد حذف المنشور نهائيًا</button>
              ) : (
                <button onClick={() => setConfirmId(r.post_id)}>🗑 حذف المنشور</button>
              )}
            </div>
          )}
          <div className="row"><button className="secondary" onClick={() => dismiss(r.id)}>تجاهل البلاغ</button></div>
        </div>
      ))}
    </div>
  );
}


function About() {
  const [copied, setCopied] = useState(false);
  async function invite() {
    const text = "📱 انضم إلى تطبيق لَمّة - مجتمع مدينتك في ليبيا:\nhttps://github.com/abdo15542/lamma/releases";
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch (e) {}
  }
  return (
    <div>
      <div className="card">
        <h3>عن لَمّة</h3>
        <p className="post-body">لَمّة شبكة اجتماعية ليبية بسيطة تجمع أهل المدينة الواحدة: خدمات، تنبيهات، سوق، سوالف، وتواصل بين المدن. بدون إعلانات مزعجة وبدون خوارزميات معقدة.</p>
        <div className="badge">الإصدار 1.0</div>
      </div>
      <div className="card">
        <h3>شروط الاستخدام</h3>
        <ul className="post-body" style={{ paddingRight: 18 }}>
          <li>الاحترام أولًا: لا سبّ ولا قذف ولا خطاب كراهية.</li>
          <li>لا لنشر الشائعات: تحقق قبل نشر أي خبر خدمي أو أمني.</li>
          <li>المنشورات مسؤولية أصحابها، وللإدارة حذف أي محتوى مخالف.</li>
          <li>البلاغات سرية وتراجعها الإدارة فقط.</li>
          <li>يُمنع الإعلان التجاري المكرر خارج تصنيف "سوق".</li>
        </ul>
      </div>
      <div className="card">
        <h3>ادعُ جيرانك</h3>
        <button onClick={invite}>{copied ? "تم نسخ رابط الدعوة ✔" : "📤 نسخ رابط الدعوة"}</button>
      </div>
    </div>
  );
}
