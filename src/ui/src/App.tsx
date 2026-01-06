import { useState, useEffect, useRef } from "react";
import "./App.css";

const API = "http://" + window.location.hostname + ":8086";
const COORDINATOR_API = "http://" + window.location.hostname + ":8087";

function App() {
  const [storages, setStorages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState({ iso: [], vztmpl: [], backup: [] });
  const [tab, setTab] = useState("iso");
  const [checkedItems, setCheckedItems] = useState([]);
  const [drawerItem, setDrawerItem] = useState(null);
  const [modalOp, setModalOp] = useState(null);
  const [modalTarget, setModalTarget] = useState("");
  const [progress, setProgress] = useState(null);
  const [nodeInfo, setNodeInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [token, setToken] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Fetch token from coordinator first
    fetch(COORDINATOR_API + "/api/config")
      .then((r) => r.json())
      .then((data) => {
        setToken(data.token);
        return data.token;
      })
      .then((tkn) => {
        // Load initial data with token
        fetch(API + "/api/storages", { headers: { Authorization: "Bearer " + tkn } })
          .then((r) => r.json())
          .then(setStorages)
          .catch(console.error);

        fetch(API + "/api/node", { headers: { Authorization: "Bearer " + tkn } })
          .then((r) => r.json())
          .then(setNodeInfo)
          .catch(console.error);

        const loadStats = () => {
          fetch(API + "/api/stats", { headers: { Authorization: "Bearer " + tkn } })
            .then((r) => r.json())
            .then(setStats)
            .catch(console.error);
        };
        loadStats();
        const statsInterval = setInterval(loadStats, 2000);
        return () => clearInterval(statsInterval);
      })
      .catch(console.error);
  }, []);

  const loadContent = (st) => {
    setSelected(st);
    setCheckedItems([]);
    ["iso", "vztmpl", "backup"].forEach((t) => {
      fetch(API + "/api/content?storage=" + st.ID + "&type=" + t, {
        headers: { Authorization: "Bearer " + token },
      })
        .then((r) => r.json())
        .then((d) => setContent((prev) => ({ ...prev, [t]: d.items || [] })))
        .catch(console.error);
    });
  };

  const refreshContent = () => {
    if (selected) loadContent(selected);
  };

  const toggleCheck = (item) => {
    setCheckedItems((prev) =>
      prev.find((x) => x.path === item.path)
        ? prev.filter((x) => x.path !== item.path)
        : [...prev, item]
    );
  };

  const executeOp = async () => {
    if (!modalOp || checkedItems.length === 0) return;

    const opName = modalOp;
    const targetStorage = modalTarget;
    const targetDir = tab === "iso" ? "template/iso" : tab === "vztmpl" ? "template/cache" : "dump";

    setModalOp(null);
    setModalTarget("");

    const jobItems = checkedItems.map((it) => ({ path: it.path, size: it.size }));

    try {
      const res = await fetch(API + "/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ op: opName, items: jobItems, target: { storage: targetStorage, dir: targetDir } }),
      });
      const data = await res.json();

      if (data.job_id) {
        setProgress({ jobId: data.job_id, status: "running", progress: 0, total: 1, current: "Starting...", failed: [] });
        pollJob(data.job_id);
      }
    } catch (e) {
      alert("Error starting job: " + (e as any).message);
    }
  };

  const handleUpload = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !selected) return;

    setProgress({ jobId: "uploading", status: "uploading", progress: 0, total: 0, current: "Uploading to server...", failed: [] });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("storage", (selected as any)?.ID);
    formData.append("type", tab);

    try {
      const res = await fetch(API + "/api/upload", { method: "POST", headers: { Authorization: "Bearer " + token }, body: formData });
      const data = await res.json();
      if (data.job_id) {
        setProgress({ jobId: data.job_id, status: "running", progress: 0, total: file.size, current: file.name, failed: [] });
        pollJob(data.job_id);
      }
    } catch (e) {
      setProgress(null);
      alert("Upload error: " + (e as any).message);
    }
    (e.target as HTMLInputElement).value = "";
  };

  const pollJob = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(API + "/api/jobs/" + jobId, { headers: { Authorization: "Bearer " + token } });
        const data = await res.json();
        setProgress({ jobId, status: data.status, progress: data.progress, total: data.total, current: data.current || "", failed: data.failed || [] });
        if (data.status === "completed" || data.status === "failed") clearInterval(interval);
      } catch (e) {
        console.error("Poll error:", e);
        clearInterval(interval);
        setProgress((prev) => (prev ? { ...prev, status: "failed", failed: ["Progress tracking error"] } : null));
      }
    }, 500);
  };

  const closeProgress = () => {
    setProgress(null);
    if (selected) loadContent(selected);
  };

  const downloadFile = (item) => {
    const link = document.createElement("a");
    link.href = API + "/api/download?path=" + encodeURIComponent(item.path) + "&token=" + token;
    link.download = item.name;
    link.click();
  };

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const sortItems = (arr) => {
    const items = [...arr];
    return items.sort((a, b) => {
      let valA: any, valB: any;
      if (sortBy === "name") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === "size") {
        valA = a.size;
        valB = b.size;
      } else {
        valA = new Date(a.mtime_formatted).getTime();
        valB = new Date(b.mtime_formatted).getTime();
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  };

  const items = sortItems((content as any)[tab] || []).filter((it: any) => it.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const progressPercent = progress && progress.total > 0 ? (progress.progress / progress.total) * 100 : 0;
  const isDone = progress && (progress.status === "completed" || progress.status === "failed");
  const isUploading = progress && progress.status === "uploading";

  const sortIndicator = (field: string) => (sortBy === field ? (sortDir === "asc" ? " ^" : " v") : "");

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: "#faf7f2" }}>
      <div style={{ width: 280, background: "linear-gradient(180deg, #2d2d2d 0%, #3d3d3d 100%)", color: "#fff", padding: "24px 16px", overflowY: "auto", boxShadow: "4px 0 20px rgba(0,0,0,0.15)", borderRight: "1px solid rgba(229, 112, 0, 0.1)" }}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: 16, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", opacity: 0.9, borderBottom: "2px solid rgba(229, 112, 0, 0.3)", paddingBottom: 12 }}>Storages</h2>
        {storages.map((s: any) => (
          <div key={s.ID} onClick={() => loadContent(s)}
            style={{ padding: "14px 16px", cursor: "pointer", background: selected?.ID === s.ID ? "rgba(229, 112, 0, 0.15)" : "transparent", borderRadius: 10, marginBottom: 10, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", border: selected?.ID === s.ID ? "2px solid #E57000" : "2px solid transparent", transform: selected?.ID === s.ID ? "translateX(4px)" : "translateX(0)", boxShadow: selected?.ID === s.ID ? "0 4px 12px rgba(229, 112, 0, 0.2)" : "none" }}
          >
            <div style={{ fontWeight: 600, fontSize: 14 }}>{s.ID}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{s.type}</div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", marginRight: drawerItem ? 420 : 0, transition: "margin-right 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}>
        <div style={{ background: "linear-gradient(135deg, #E57000 0%, #ff8c1a 100%)", padding: "20px 32px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="/proxmox-logo.svg" alt="Proxmox" style={{ height: 50 }} />
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: "#fff", letterSpacing: "0.3px" }}>Proxmox Storage Management</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 8 }}>
            {nodeInfo && <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 400 }}>Connected to {window.location.hostname} ({(nodeInfo as any).hostname})</div>}
            {stats && (
              <div style={{ display: "flex", gap: 24, fontSize: 13, opacity: 0.95 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontWeight: 600 }}>CPU:</div><div>{(stats as any).cpu.usage}</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontWeight: 600 }}>Memory:</div><div>{(stats as any).memory.used_gb} GB / {(stats as any).memory.total_gb} GB ({(stats as any).memory.usage})</div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ fontWeight: 600 }}>Storage:</div><div>{(stats as any).storage.used} {(stats as any).storage.unit} / {(stats as any).storage.total} {(stats as any).storage.unit} ({(stats as any).storage.usage})</div></div>
              </div>
            )}
          </div>
        </div>
        {selected && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", gap: 12, padding: "16px 32px", background: "#fff", borderBottom: "1px solid #e9ecef" }}>
              {["iso", "vztmpl", "backup"].map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ padding: "10px 20px", border: "none", background: tab === t ? "#E57000" : "#f5f0e8", color: tab === t ? "#000" : "#2c3e50", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.3s ease", textTransform: "uppercase", letterSpacing: "0.5px" }}
                >
                  {t === "vztmpl" ? "Templates" : t.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ padding: "12px 32px", background: "#fff", borderBottom: "1px solid #e9ecef", display: "flex", gap: 12, alignItems: "center" }}>
              <input type="text" placeholder="Search files..." value={searchQuery} onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                style={{ flex: 1, padding: "10px 14px", border: "2px solid #e9ecef", borderRadius: 8, fontSize: 14 }} />
              <button onClick={refreshContent} style={{ padding: "10px 16px", border: "none", background: "#ff8c1a", color: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "transform 0.2s ease" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)")}
              >
                Refresh
              </button>
            </div>
            <div style={{ padding: "16px 32px", background: "#fff", borderBottom: "1px solid #e9ecef", display: "flex", gap: 12, alignItems: "center" }}>
              <input ref={fileInputRef} type="file" onChange={handleUpload} style={{ display: "none" }} />
              <button onClick={() => (fileInputRef.current as any)?.click()} style={{ padding: "8px 18px", border: "none", background: "#E57000", color: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "transform 0.2s ease", letterSpacing: "0.3px" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)")}
              >
                Upload File
              </button>
              <span style={{ fontSize: 13, color: "#2c3e50", fontWeight: 500 }}>to {(selected as any)?.ID} / {tab}</span>
            </div>
            {checkedItems.length > 0 && (
              <div style={{ padding: "14px 32px", background: "#fff4e6", borderBottom: "1px solid #e9ecef", display: "flex", gap: 12, alignItems: "center", animation: "slideDown 0.3s ease" }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#E57000" }}>{checkedItems.length} selected</span>
                <button onClick={() => { setModalOp("copy"); setModalTarget(((storages as any)[0]?.ID ?? (selected as any)?.ID ?? "")); }} style={{ padding: "6px 14px", border: "none", background: "#E57000", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, transition: "all 0.2s ease" }}>Copy</button>
                <button onClick={() => { setModalOp("move"); setModalTarget(((storages as any)[0]?.ID ?? (selected as any)?.ID ?? "")); }} style={{ padding: "6px 14px", border: "none", background: "#ff8c1a", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, transition: "all 0.2s ease" }}>Move</button>
                <button onClick={() => setModalOp("delete")} style={{ padding: "6px 14px", border: "none", background: "#ff4d4f", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12, transition: "all 0.2s ease" }}>Delete</button>
              </div>
            )}
            <div style={{ flex: 1, overflow: "auto", padding: 32, background: "#faf7f2" }}>
              <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(135deg, #E57000 0%, #ff8c1a 100%)", color: "#fff" }}>
                      <th style={{ padding: 14, textAlign: "left", width: 40, fontWeight: 600, fontSize: 12 }}></th>
                      <th onClick={() => toggleSort("name")} style={{ padding: 14, textAlign: "left", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" }}>
                        NAME{sortIndicator("name")}
                      </th>
                      <th style={{ padding: 14, textAlign: "left", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px" }}>TYPE</th>
                      <th onClick={() => toggleSort("size")} style={{ padding: 14, textAlign: "left", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" }}>
                        SIZE{sortIndicator("size")}
                      </th>
                      <th onClick={() => toggleSort("mtime")} style={{ padding: 14, textAlign: "left", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" }}>
                        MODIFIED{sortIndicator("mtime")}
                      </th>
                      <th style={{ padding: 14, textAlign: "center", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px", width: 120 }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any, idx: number) => (
                      <tr key={it.path} style={{ borderBottom: "1px solid #f1f3f5", cursor: "pointer", transition: "background 0.2s ease", animation: "fadeIn 0.3s ease " + idx * 0.05 + "s both" }}
                        onClick={() => setDrawerItem(it)}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "#faf7f2")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")}
                      >
                        <td style={{ padding: 12 }} onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={!!(checkedItems as any).find((x: any) => x.path === it.path)} onChange={() => toggleCheck(it)} style={{ cursor: "pointer", width: 16, height: 16 }} />
                        </td>
                        <td style={{ padding: 12, fontSize: 13, fontWeight: 500, color: "#2c3e50" }}>{it.name}</td>
                        <td style={{ padding: 12, fontSize: 12, color: "#34495e" }}>{it.type}</td>
                        <td style={{ padding: 12, fontSize: 12, color: "#34495e" }}>{it.size_formatted}</td>
                        <td style={{ padding: 12, fontSize: 12, color: "#34495e" }}>{it.mtime_formatted}</td>
                        <td style={{ padding: 12, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => downloadFile(it)} style={{ padding: "6px 12px", border: "none", background: "#ff8c1a", color: "#fff", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
      {drawerItem && (
        <div style={{ position: "fixed", right: 0, top: 0, bottom: 0, width: 420, background: "#fff", boxShadow: "-4px 0 20px rgba(0,0,0,0.1)", padding: 32, overflowY: "auto", zIndex: 1000, animation: "slideInRight 0.3s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#2c3e50" }}>File Details</h2>
            <button onClick={() => setDrawerItem(null)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#adb5bd", transition: "color 0.2s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#2c3e50")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#adb5bd")}
            >X</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ padding: 16, background: "#faf7f2", borderRadius: 8, borderLeft: "4px solid #E57000" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#adb5bd", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Name</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#2c3e50", wordBreak: "break-all" }}>{(drawerItem as any).name}</div>
            </div>
            <div style={{ padding: 16, background: "#faf7f2", borderRadius: 8, borderLeft: "4px solid #f0e6d6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#adb5bd", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Type</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#2c3e50" }}>{(drawerItem as any).type}</div>
            </div>
            <div style={{ padding: 16, background: "#faf7f2", borderRadius: 8, borderLeft: "4px solid #E57000" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#adb5bd", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Size</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#2c3e50" }}>{(drawerItem as any).size_formatted}</div>
            </div>
            <div style={{ padding: 16, background: "#faf7f2", borderRadius: 8, borderLeft: "4px solid #f0e6d6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#adb5bd", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Modified</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#2c3e50" }}>{(drawerItem as any).mtime_formatted}</div>
            </div>
            <div style={{ padding: 16, background: "#faf7f2", borderRadius: 8, borderLeft: "4px solid #E57000" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#adb5bd", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Path</div>
              <div style={{ fontSize: 13, fontWeight: 400, color: "#34495e", wordBreak: "break-all", fontFamily: "monospace" }}>{(drawerItem as any).path}</div>
            </div>
            <div style={{ padding: 16, background: "#faf7f2", borderRadius: 8, borderLeft: "4px solid #f0e6d6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#adb5bd", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Storage</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#2c3e50" }}>{(drawerItem as any).storage}</div>
            </div>
          </div>
        </div>
      )}

      {modalOp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", padding: 36, borderRadius: 16, minWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 24px 0", fontSize: 22, fontWeight: 600, color: "#2c3e50" }}>{modalOp === "delete" ? "Delete Files" : modalOp === "copy" ? "Copy Files" : "Move Files"}</h2>
            {modalOp !== "delete" && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", marginBottom: 10, fontSize: 13, fontWeight: 600, color: "#34495e" }}>Target Storage:</label>
                <select value={modalTarget} onChange={(e) => setModalTarget((e.target as HTMLSelectElement).value)} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e9ecef", borderRadius: 8, fontSize: 14 }}>
                  {storages.map((s: any) => (
                    <option key={s.ID} value={s.ID}>{s.ID}</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button onClick={executeOp} style={{ padding: "10px 24px", border: "none", background: "#E57000", color: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Execute</button>
              <button onClick={() => { setModalOp(null); setModalTarget(""); }} style={{ padding: "10px 24px", border: "2px solid #e9ecef", background: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 14, color: "#34495e" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {progress && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, backdropFilter: "blur(6px)", animation: "fadeIn 0.2s ease" }}>
          <div style={{ background: "#fff", padding: 44, borderRadius: 20, minWidth: 540, boxShadow: "0 25px 80px rgba(0,0,0,0.4)", animation: "scaleIn 0.3s ease" }}>
            <h2 style={{ margin: 0, marginBottom: 24, textAlign: "center", fontSize: 24, fontWeight: 600, color: progress.status === "completed" ? "#2f9e44" : progress.status === "failed" ? "#ff4d4f" : "#E57000" }}>
              {progress.status === "completed" ? "Completed!" : progress.status === "failed" ? "Failed" : isUploading ? "Uploading..." : "Processing..."}
            </h2>
            <div style={{ marginBottom: 20, fontSize: 14, color: "#34495e", textAlign: "center", minHeight: 20, fontWeight: 500 }}>{progress.current}</div>
            {!isUploading && (
              <div>
                <div style={{ background: "#f1f3f5", borderRadius: 12, height: 36, overflow: "hidden", marginBottom: 14, boxShadow: "inset 0 2px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ background: progress.status === "failed" ? "linear-gradient(90deg, #ff4d4f, #ff7875)" : "linear-gradient(90deg, #E57000, #ff8c1a)", height: "100%", width: progressPercent + "%", transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, minWidth: progressPercent > 0 ? "60px" : "0", boxShadow: "0 2px 8px rgba(229, 112, 0, 0.4)" }}>
                    {Math.round(progressPercent)}%
                  </div>
                </div>
                <div style={{ textAlign: "center", fontSize: 13, color: "#adb5bd", marginBottom: 24, fontWeight: 500 }}>
                  {(progress.progress / 1e9).toFixed(2)} GB / {(progress.total / 1e9).toFixed(2)} GB
                </div>
              </div>
            )}
            {progress.failed && progress.failed.length > 0 && (
              <div style={{ background: "#fff5f5", border: "1px solid #ff4d4f", padding: 14, borderRadius: 10, marginBottom: 24, fontSize: 12, maxHeight: 120, overflow: "auto" }}>
                <strong style={{ color: "#d63031" }}>Errors:</strong>
                <ul style={{ margin: "8px 0 0 0", paddingLeft: 20, color: "#34495e" }}>
                  {progress.failed.map((f, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {isDone && (
              <div style={{ textAlign: "center" }}>
                <button onClick={closeProgress} style={{ padding: "12px 36px", border: "none", background: "#E57000", color: "#fff", borderRadius: 10, cursor: "pointer", fontSize: 16, fontWeight: 700, transition: "transform 0.2s", boxShadow: "0 4px 12px rgba(229, 112, 0, 0.4)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)")}
                >
                  OK
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 768px) {
          body { font-size: 14px; }
          h1 { font-size: 20px !important; }
          .sidebar { width: 200px !important; }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes slideDown { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

export default App;
