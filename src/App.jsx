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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });
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
    e.preventDefault();
    setBusy(true);
    setMessage("");
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    } else {
      if (!username || !cityId) { setMessage("يجب اختيار اسم مستخدم ومدينة."); setBusy(false); return; }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setMessage(error.message); setBusy(false); return; }
      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: data.user.id, username, city_id: Number(cityId)
        });
        if (profileError) setMessage(profileError.message);
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
                  {cities.map((city) => (<option key={city.id} value={city.id}>{city.name}</option>))}
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

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("profiles").insert({
      id: user.id, username, city_id: Number(cityId)
    });
    if (error) setMessage(error.message);
    else onDone();
    setBusy(false);
  }

  return (
    <div className="center">
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="card">
          <h2>أكمل ملفك الشخصي</h2>
          <form onSubmit={saveProfile}>
            <input type="text" placeholder="اسم المستخدم" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} maxLength={30} />
            <select value={cityId} onChange={(e) => setCityId(e.target.value)} required>
              <option value="">اختر مدينتك</option>
              {cities.map((city) => (<option key={city.id} value={city.id}>{city.name}</option>))}
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
  const [selectedCityId, setSelectedCityId] = useState(profile.city_id);
  const [posts, setPosts] = useState([]);
  const [votedIds, setVotedIds] = useState(new Set());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("services");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadPosts(); loadVotes(); }, [selectedCityId]);

  async function loadPosts() {
    const { data, error } = await supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(username), useful_votes!useful_votes_post_id_fkey(count)")
      .eq("city_id", selectedCityId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { setMessage("خطأ جلب: " + error.message); setPosts([]); }
    else { setPosts(data || []); }
  }

  async function loadVotes() {
    const { data } = await supabase.from("useful_votes").select("post_id").eq("user_id", profile.id);
    setVotedIds(new Set((data || []).map((item) => item.post_id)));
  }

  async function createPost(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("posts").insert({
      user_id: profile.id, city_id: selectedCityId, category, title, body
    });
    if (error) setMessage("خطأ نشر: " + error.message);
    else { setMessage("تم النشر بنجاح ✅"); setTitle(""); setBody(""); setCategory("services"); await loadPosts(); }
    setBusy(false);
  }

  async function toggleUseful(postId) {
    if (votedIds.has(postId)) {
      await supabase.from("useful_votes").delete().eq("post_id", postId).eq("user_id", profile.id);
      const next = new Set(votedIds); next.delete(postId); setVotedIds(next);
    } else {
      await supabase.from("useful_votes").insert({ post_id: postId, user_id: profile.id });
      const next = new Set(votedIds); next.add(postId); setVotedIds(next);
    }
    await loadPosts();
  }

  async function logout() { await supabase.auth.signOut(); }
  function cityName(id) { return cities.find((c) => c.id === Number(id))?.name || ""; }
  function categoryLabel(id) { return categories.find((i) => i.id === id)?.label || id; }
  function usefulCount(post) { return post.useful_votes?.[0]?.count || 0; }

  return (
    <div className="container">
      <div className="topbar">
        <div>
          <h2 style={{ margin: 0 }}>لَمّة</h2>
          <div className="muted">مرحبًا @{profile.username}</div>
        </div>
        <button className="logout-btn" onClick={logout}>خروج</button>
      </div>

      <div className="card">
        <label>المدينة</label>
        <select value={selectedCityId} onChange={(e) => setSelectedCityId(Number(e.target.value))}>
          {cities.map((city) => (<option key={city.id} value={city.id}>{city.name}</option>))}
        </select>
        <div className="muted">أنت الآن تشاهد منشورات مدينة: {cityName(selectedCityId)}</div>
      </div>

      <div className="card">
        <h3>أضف منشورًا</h3>
        <form onSubmit={createPost}>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((item) => (<option key={item.id} value={item.id}>{item.label}</option>))}
          </select>
          <input type="text" placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
          <textarea placeholder="اكتب التفاصيل..." value={body} onChange={(e) => setBody(e.target.value)} required maxLength={1000} />
          <button disabled={busy || !title || !body}>{busy ? "جاري النشر..." : "نشر"}</button>
          {message && <div className="error">{message}</div>}
        </form>
      </div>

      {posts.length === 0 && <div className="card">لا توجد منشورات بعد في هذه المدينة.</div>}

      {posts.map((post) => (
        <div className="card" key={post.id}>
          <div className="post-title">{post.title}</div>
          <div className="post-body">{post.body}</div>
          <div className="post-meta">
            <span className="badge">{categoryLabel(post.category)}</span>
            <span className="badge">{cityName(post.city_id)}</span>
            <span className="badge">@{post.profiles?.username}</span>
            <span className="badge">{new Date(post.created_at).toLocaleString("ar-LY")}</span>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className={`useful-btn ${votedIds.has(post.id) ? "active" : ""}`} onClick={() => toggleUseful(post.id)}>
              {votedIds.has(post.id) ? "مفيد ✓" : "مفيد"} ({usefulCount(post)})
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
