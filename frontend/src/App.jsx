import { useState, useEffect } from "react"
import axios from "axios"

const API = import.meta.env.VITE_API_URL || "http://localhost:8080"

export default function App() {
  const [tab, setTab] = useState("register")
  const [queues, setQueues] = useState([])
  const [form, setForm] = useState({ name: "", nik: "", complaint: "", file: null })
  const [alert, setAlert] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchQueues = async () => {
    try {
      const res = await axios.get(`${API}/queues`)
      setQueues(res.data)
    } catch {
      showAlert("Gagal memuat data antrian", "error")
    }
  }

  useEffect(() => {
    if (tab === "admin") fetchQueues()
  }, [tab])

  const showAlert = (msg, type = "success") => {
    setAlert({ msg, type })
    setTimeout(() => setAlert(null), 3000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append("name", form.name)
      fd.append("nik", form.nik)
      fd.append("complaint", form.complaint)
      if (form.file) fd.append("file", form.file)

      await axios.post(`${API}/queues`, fd)
      setForm({ name: "", nik: "", complaint: "", file: null })
      showAlert("Pendaftaran berhasil! Silakan tunggu giliran Anda.")
    } catch {
      showAlert("Pendaftaran gagal, coba lagi.", "error")
    } finally {
      setLoading(false)
    }
  }

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/queues/${id}/status`, { status })
      fetchQueues()
    } catch {
      showAlert("Gagal update status", "error")
    }
  }

  return (
    <div className="container">
      <h1>MariAntri — Sistem Antrian Puskesmas</h1>

      <div className="tabs">
        <button className={`tab ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
          Daftar Antrian
        </button>
        <button className={`tab ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>
          Dashboard Admin
        </button>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {tab === "register" && (
        <div className="card">
          <h2>Formulir Pendaftaran Antrian</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Nama Lengkap</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Masukkan nama lengkap"
                required
              />
            </div>
            <div className="form-group">
              <label>NIK</label>
              <input
                type="text"
                value={form.nik}
                onChange={e => setForm({ ...form, nik: e.target.value })}
                placeholder="16 digit NIK"
                maxLength={16}
                required
              />
            </div>
            <div className="form-group">
              <label>Keluhan</label>
              <textarea
                rows={3}
                value={form.complaint}
                onChange={e => setForm({ ...form, complaint: e.target.value })}
                placeholder="Deskripsikan keluhan Anda"
                required
              />
            </div>
            <div className="form-group">
              <label>Upload Dokumen (opsional)</label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={e => setForm({ ...form, file: e.target.files[0] })}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Mendaftarkan..." : "Daftar Antrian"}
            </button>
          </form>
        </div>
      )}

      {tab === "admin" && (
        <div className="card">
          <h2>Dashboard Admin — Daftar Antrian</h2>
          <button className="btn btn-primary btn-sm" onClick={fetchQueues} style={{ marginBottom: 16 }}>
            Refresh
          </button>
          {queues.length === 0 ? (
            <p style={{ color: "#888" }}>Belum ada antrian.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama</th>
                  <th>NIK</th>
                  <th>Keluhan</th>
                  <th>Dokumen</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {queues.map((q, i) => (
                  <tr key={q.id}>
                    <td>{i + 1}</td>
                    <td>{q.name}</td>
                    <td>{q.nik}</td>
                    <td>{q.complaint}</td>
                    <td>
                      {q.file_url
                        ? <a href={q.file_url} target="_blank" rel="noreferrer">Lihat</a>
                        : "-"}
                    </td>
                    <td>
                      <span className={`badge badge-${q.status}`}>{q.status}</span>
                    </td>
                    <td style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-sm btn-in-progress" onClick={() => updateStatus(q.id, "in_progress")}>Proses</button>
                      <button className="btn btn-sm btn-done" onClick={() => updateStatus(q.id, "done")}>Selesai</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}